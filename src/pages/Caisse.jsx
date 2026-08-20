import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getBoutiqueId } from '../lib/boutique'

function Caisse() {
  const employe = JSON.parse(localStorage.getItem('employeConnecte'))
  const boutiqueId = getBoutiqueId()

  const [produits, setProduits] = useState([])
  const [panier, setPanier] = useState([])
  const [remise, setRemise] = useState(0)
  const [modePaiement, setModePaiement] = useState('Espèces')
  const [montantRecu, setMontantRecu] = useState('')
  const [recherche, setRecherche] = useState('')
  const [venteReussie, setVenteReussie] = useState(false)
  const [nomBoutique, setNomBoutique] = useState('')
  const [dernierRecu, setDernierRecu] = useState(null)

  // --- Nouveau : gestion du client pour les ventes à crédit ---
  const [clients, setClients] = useState([])
  const [clientSelectionneId, setClientSelectionneId] = useState('')
  const [ajoutNouveauClient, setAjoutNouveauClient] = useState(false)
  const [nouveauNomClient, setNouveauNomClient] = useState('')

  async function chargerProduits() {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('boutique_id', boutiqueId)
    if (!error) setProduits(data)
  }

  async function chargerNomBoutique() {
    const { data, error } = await supabase
      .from('boutiques')
      .select('nom')
      .eq('id', boutiqueId)
      .single()
    if (!error && data) setNomBoutique(data.nom)
  }

  async function chargerClients() {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('boutique_id', boutiqueId)
      .order('nom', { ascending: true })
    if (!error) setClients(data)
  }

  useEffect(() => {
    chargerProduits()
    chargerNomBoutique()
    chargerClients()
  }, [])

  function ajouterAuPanier(produit) {
    const existe = panier.find((item) => item.id === produit.id)
    if (existe) {
      if (existe.quantiteVente >= produit.quantite) {
        alert('Stock insuffisant pour ce produit.')
        return
      }
      setPanier(
        panier.map((item) =>
          item.id === produit.id ? { ...item, quantiteVente: item.quantiteVente + 1 } : item
        )
      )
    } else {
      if (produit.quantite < 1) {
        alert('Ce produit est en rupture de stock.')
        return
      }
      setPanier([...panier, { ...produit, quantiteVente: 1 }])
    }
  }

  function changerQuantite(id, nouvelleQuantite) {
    if (nouvelleQuantite < 1) return
    const produit = produits.find((p) => p.id === id)
    if (nouvelleQuantite > produit.quantite) {
      alert('Stock insuffisant.')
      return
    }
    setPanier(panier.map((item) => (item.id === id ? { ...item, quantiteVente: nouvelleQuantite } : item)))
  }

  function retirerDuPanier(id) {
    setPanier(panier.filter((item) => item.id !== id))
  }

  const totalBrut = panier.reduce((somme, item) => somme + item.prix_vente * item.quantiteVente, 0)
  const totalFinal = totalBrut - remise
  const monnaieRendue = montantRecu !== '' ? parseFloat(montantRecu) - totalFinal : null

  const produitsFiltres = produits.filter((p) =>
    p.nom.toLowerCase().includes(recherche.toLowerCase())
  )

  async function validerVente() {
    if (panier.length === 0) {
      alert('Le panier est vide.')
      return
    }

    // --- Nouveau : détermination du client en cas de vente à crédit ---
    let idClientCredit = null

    if (modePaiement === 'Crédit client') {
      if (ajoutNouveauClient) {
        if (!nouveauNomClient.trim()) {
          alert('Entrez le nom du nouveau client.')
          return
        }
        const { data: nouveauClient, error: erreurNouveauClient } = await supabase
          .from('clients')
          .insert([{ nom: nouveauNomClient.trim(), boutique_id: boutiqueId }])
          .select()
          .single()

        if (erreurNouveauClient) {
          alert('Erreur lors de la création du client : ' + erreurNouveauClient.message)
          return
        }
        idClientCredit = nouveauClient.id
      } else {
        if (!clientSelectionneId) {
          alert('Sélectionnez un client pour la vente à crédit.')
          return
        }
        idClientCredit = clientSelectionneId
      }
    }

    const { data: vente, error: erreurVente } = await supabase
      .from('sales')
      .insert([{
        total: totalFinal,
        mode_paiement: modePaiement,
        boutique_id: boutiqueId,
        employe_id: employe?.id,
        client_id: idClientCredit,
      }])
      .select()
      .single()

    if (erreurVente) {
      alert('Erreur lors de la vente : ' + erreurVente.message)
      return
    }

    const lignes = panier.map((item) => ({
      sale_id: vente.id,
      product_id: item.id,
      nom_produit: item.nom,
      quantite: item.quantiteVente,
      prix_unitaire: item.prix_vente,
      boutique_id: boutiqueId,
    }))

    const { error: erreurItems } = await supabase.from('sale_items').insert(lignes)

    if (erreurItems) {
      alert('Erreur lors de l\'enregistrement du détail : ' + erreurItems.message)
      return
    }

    for (const item of panier) {
      const nouvelleQuantite = item.quantite - item.quantiteVente
      await supabase.from('products').update({ quantite: nouvelleQuantite }).eq('id', item.id)

      await supabase.from('stock_mouvements').insert({
        boutique_id: boutiqueId,
        produit_id: item.id,
        employe_id: employe?.id,
        type_mouvement: 'Sortie',
        quantite: -item.quantiteVente,
        motif: `Vente n°${vente.id}`,
      })
    }

    // --- Nouveau : création automatique de la dette en cas de vente à crédit ---
    if (modePaiement === 'Crédit client' && idClientCredit) {
      const { error: erreurCredit } = await supabase.from('credits').insert({
        client_id: idClientCredit,
        montant_total: totalFinal,
        montant_paye: 0,
        statut: 'en cours',
        boutique_id: boutiqueId,
      })
      if (erreurCredit) {
        alert('La vente est enregistrée, mais le crédit n\'a pas pu être créé : ' + erreurCredit.message)
      }
    }

    // On garde une copie des infos de la vente pour générer le reçu
        // --- Nouveau : nom du client pour le reçu (vente à crédit uniquement) ---
    let nomClientRecu = ''
    if (modePaiement === 'Crédit client') {
      if (ajoutNouveauClient) {
        nomClientRecu = nouveauNomClient.trim()
      } else {
        const clientTrouve = clients.find((c) => c.id === idClientCredit)
        nomClientRecu = clientTrouve ? clientTrouve.nom : ''
      }
    }

    // On garde une copie des infos de la vente pour générer le reçu
    setDernierRecu({
      numero: vente.id,
      date: new Date(),
      vendeur: employe?.nom || '',
      client: nomClientRecu,
      articles: panier.map((item) => ({
        nom: item.nom,
        quantite: item.quantiteVente,
        prixUnitaire: item.prix_vente,
        sousTotal: item.prix_vente * item.quantiteVente,
      })),
      remise,
      total: totalFinal,
      modePaiement,
      montantRecu: montantRecu !== '' ? parseFloat(montantRecu) : null,
      monnaieRendue: monnaieRendue,
    })

    setPanier([])
    setRemise(0)
    setModePaiement('Espèces')
    setMontantRecu('')
    setClientSelectionneId('')
    setAjoutNouveauClient(false)
    setNouveauNomClient('')
    setVenteReussie(true)
    chargerProduits()
    chargerClients()

    setTimeout(() => setVenteReussie(false), 3000)
  }

  function texteRecu(recu) {
    let texte = `🧾 ${nomBoutique || 'Reçu de vente'}\n`
    texte += `Vente n°${recu.numero}\n`
    texte += `${recu.date.toLocaleDateString('fr-FR')} ${recu.date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}\n`
        if (recu.vendeur) texte += `Vendeur : ${recu.vendeur}\n`
            if (recu.client) texte += `Client : ${recu.client}\n`
    texte += `--------------------------\n`
    recu.articles.forEach((a) => {
      texte += `${a.nom} x${a.quantite} = ${a.sousTotal} FCFA\n`
    })
    texte += `--------------------------\n`
    if (recu.remise > 0) texte += `Remise : -${recu.remise} FCFA\n`
    texte += `TOTAL : ${recu.total} FCFA\n`
    texte += `Paiement : ${recu.modePaiement}\n`
    if (recu.montantRecu !== null && recu.montantRecu !== undefined) {
      texte += `Montant reçu : ${recu.montantRecu} FCFA\n`
      texte += `Monnaie rendue : ${recu.monnaieRendue} FCFA\n`
    }
    texte += `\n`
    texte += `Merci pour votre achat !`
    return texte
  }

  function partagerWhatsApp() {
    const texte = encodeURIComponent(texteRecu(dernierRecu))
    window.open(`https://wa.me/?text=${texte}`, '_blank')
  }

  function imprimerRecu() {
    const contenu = texteRecu(dernierRecu)
    const fenetre = window.open('', '_blank', 'width=380,height=600')
    fenetre.document.write(`
      <html>
        <head>
          <title>Reçu ${dernierRecu.numero}</title>
          <style>
            body { font-family: monospace; font-size: 14px; padding: 20px; white-space: pre-wrap; }
          </style>
        </head>
        <body>${contenu}</body>
      </html>
    `)
    fenetre.document.close()
    fenetre.focus()
    fenetre.print()
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'Poppins, Arial, sans-serif' }}>
      <h1>💰 Vente</h1>

      {venteReussie && (
        <div style={{ backgroundColor: '#EAF5EC', color: '#2E7D32', padding: '12px', marginBottom: '15px', borderRadius: '8px', fontWeight: 500 }}>
          ✅ Vente enregistrée avec succès !
        </div>
      )}

      {dernierRecu && (
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E6E0D6',
            borderRadius: '10px',
            boxShadow: '0 2px 8px rgba(43, 38, 32, 0.06)',
            padding: '18px',
            marginBottom: '20px',
            maxWidth: '350px',
          }}
        >
          <h3 style={{ marginTop: 0 }}>Reçu de la dernière vente</h3>
          <p style={{ margin: '4px 0', color: '#6B6357' }}>Vente n°{dernierRecu.numero} — <strong style={{ color: '#2B2620' }}>{dernierRecu.total} FCFA</strong></p>
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <button
              onClick={partagerWhatsApp}
              style={{ padding: '9px 14px', backgroundColor: '#25D366', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Poppins, Arial, sans-serif', fontWeight: 500 }}
            >
              📲 Partager WhatsApp
            </button>
            <button
              onClick={imprimerRecu}
              style={{ padding: '9px 14px', backgroundColor: '#C9822A', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Poppins, Arial, sans-serif', fontWeight: 500 }}
            >
              🖨️ Imprimer
            </button>
          </div>
        </div>
      )}

      <div className="caisse-layout" style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1', minWidth: '300px' }}>
          <h2>Produits disponibles</h2>
          <input
            placeholder="Rechercher un produit..."
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', marginBottom: '10px', border: '1px solid #E6E0D6', borderRadius: '8px', fontFamily: 'Poppins, Arial, sans-serif', fontSize: '14px' }}
          />
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {produitsFiltres.map((p) => (
              <div
                key={p.id}
                onClick={() => ajouterAuPanier(p)}
                style={{
                  padding: '12px',
                  border: '1px solid #E6E0D6',
                  borderRadius: '8px',
                  marginBottom: '8px',
                  cursor: 'pointer',
                  backgroundColor: p.quantite < 1 ? '#FBEAEA' : 'white',
                  transition: 'border-color 0.15s ease',
                }}
              >
                <strong>{p.nom}</strong> - {p.prix_vente} FCFA
                <br />
                <small style={{ color: '#6B6357' }}>Stock : {p.quantite}</small>
              </div>
            ))}
          </div>
        </div>

        <div style={{ flex: '1', minWidth: '300px' }}>
          <h2>Panier</h2>
          {panier.length === 0 ? (
            <p style={{ color: '#6B6357' }}>Panier vide. Cliquez sur un produit pour l'ajouter.</p>
          ) : (
            <table cellPadding="8" style={{ borderCollapse: 'collapse', width: '100%', backgroundColor: 'white', border: '1px solid #E6E0D6', borderRadius: '8px', overflow: 'hidden' }}>
              <thead>
                <tr style={{ backgroundColor: '#F7F5F2' }}>
                  <th style={{ textAlign: 'left', fontSize: '13px', color: '#6B6357' }}>Produit</th>
                  <th style={{ textAlign: 'left', fontSize: '13px', color: '#6B6357' }}>Qté</th>
                  <th style={{ textAlign: 'left', fontSize: '13px', color: '#6B6357' }}>Sous-total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {panier.map((item) => (
                  <tr key={item.id} style={{ borderTop: '1px solid #E6E0D6' }}>
                    <td>{item.nom}</td>
                    <td>
                      <input
                        type="number"
                        value={item.quantiteVente}
                        onChange={(e) => changerQuantite(item.id, parseInt(e.target.value))}
                        style={{ width: '50px', padding: '4px', border: '1px solid #E6E0D6', borderRadius: '6px' }}
                      />
                    </td>
                    <td>{item.prix_vente * item.quantiteVente} FCFA</td>
                    <td>
                      <button onClick={() => retirerDuPanier(item.id)} style={{ background: 'none', border: 'none', color: '#B71C1C', cursor: 'pointer', fontFamily: 'Poppins, Arial, sans-serif' }}>Retirer</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div style={{ marginTop: '15px' }}>
            <label>Remise (FCFA) : </label>
            <input
              type="number"
              value={remise}
              onChange={(e) => setRemise(parseFloat(e.target.value) || 0)}
              style={{ width: '100px', padding: '6px 8px', border: '1px solid #E6E0D6', borderRadius: '6px' }}
            />
          </div>

          <div style={{ marginTop: '10px' }}>
            <label>Mode de paiement : </label>
            <select value={modePaiement} onChange={(e) => setModePaiement(e.target.value)} style={{ padding: '6px 8px', border: '1px solid #E6E0D6', borderRadius: '6px', fontFamily: 'Poppins, Arial, sans-serif' }}>
              <option>Espèces</option>
              <option>Orange Money</option>
              <option>Moov Money</option>
              <option>Crédit client</option>
            </select>
          </div>

          <div style={{ marginTop: '10px' }}>
            <label>Montant reçu du client (FCFA) : </label>
            <input
              type="number"
              value={montantRecu}
              onChange={(e) => setMontantRecu(e.target.value)}
              style={{ width: '120px', padding: '6px 8px', border: '1px solid #E6E0D6', borderRadius: '6px' }}
            />
          </div>

          {montantRecu !== '' && (
            <p style={{ marginTop: '8px', fontWeight: 600, color: monnaieRendue < 0 ? '#C62828' : '#2E7D32' }}>
              {monnaieRendue < 0
                ? `Il manque ${Math.abs(monnaieRendue)} FCFA`
                : `Monnaie à rendre : ${monnaieRendue} FCFA`}
            </p>
          )}

          {modePaiement === 'Crédit client' && (
            <div style={{ marginTop: '10px' }}>
              <label>Client : </label>
              {!ajoutNouveauClient ? (
                <select
                  value={clientSelectionneId}
                  onChange={(e) => {
                    if (e.target.value === '__nouveau__') {
                      setAjoutNouveauClient(true)
                      setClientSelectionneId('')
                    } else {
                      setClientSelectionneId(e.target.value)
                    }
                  }}
                  style={{ padding: '6px 8px', border: '1px solid #E6E0D6', borderRadius: '6px', fontFamily: 'Poppins, Arial, sans-serif' }}
                >
                  <option value="">-- Choisir un client --</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.nom}</option>
                  ))}
                  <option value="__nouveau__">➕ Nouveau client</option>
                </select>
              ) : (
                <>
                  <input
                    placeholder="Nom du nouveau client"
                    value={nouveauNomClient}
                    onChange={(e) => setNouveauNomClient(e.target.value)}
                    style={{ padding: '6px 8px', border: '1px solid #E6E0D6', borderRadius: '6px', fontFamily: 'Poppins, Arial, sans-serif', marginRight: '8px' }}
                  />
                  <button
                    onClick={() => { setAjoutNouveauClient(false); setNouveauNomClient('') }}
                    style={{ background: 'none', border: 'none', color: '#B71C1C', cursor: 'pointer', fontFamily: 'Poppins, Arial, sans-serif' }}
                  >
                    Annuler
                  </button>
                </>
              )}
            </div>
          )}

          <h3 style={{ marginTop: '15px' }}>Total : {totalFinal} FCFA</h3>

          <button
            onClick={validerVente}
            style={{ padding: '11px 22px', fontSize: '15px', backgroundColor: '#C9822A', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Poppins, Arial, sans-serif', fontWeight: 500 }}
          >
            ✅ Valider la vente
          </button>
        </div>
      </div>
    </div>
  )
}

export default Caisse