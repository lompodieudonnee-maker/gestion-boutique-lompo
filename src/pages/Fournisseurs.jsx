import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getBoutiqueId } from '../lib/boutique'

function Fournisseurs() {
  const [fournisseurs, setFournisseurs] = useState([])
  const [fournisseurSelectionne, setFournisseurSelectionne] = useState(null)
  const [achats, setAchats] = useState([])

  const [nom, setNom] = useState('')
  const [telephone, setTelephone] = useState('')
  const [adresse, setAdresse] = useState('')

  const [descriptionAchat, setDescriptionAchat] = useState('')
  const [montantAchat, setMontantAchat] = useState('')
  const [montantPaiement, setMontantPaiement] = useState('')

  const [produits, setProduits] = useState([])
  const [produitAchatId, setProduitAchatId] = useState('')
  const [quantiteAchat, setQuantiteAchat] = useState('')
    const [rechercheProduit, setRechercheProduit] = useState('')

  const [panierAchats, setPanierAchats] = useState([])
  const [envoiFacture, setEnvoiFacture] = useState(false)

  const employe = JSON.parse(localStorage.getItem('employeConnecte'))
  const boutiqueId = getBoutiqueId()

  useEffect(() => {
    chargerFournisseurs()
    chargerProduits()
  }, [])

  async function chargerFournisseurs() {
    const { data, error } = await supabase
      .from('fournisseurs')
      .select('*')
      .eq('boutique_id', boutiqueId)
      .order('nom', { ascending: true })
    if (!error) setFournisseurs(data)
  }

  async function chargerProduits() {
    const { data, error } = await supabase
      .from('products')
      .select('id, nom')
      .eq('boutique_id', boutiqueId)
      .order('nom', { ascending: true })
    if (!error) setProduits(data)
  }

  async function chargerAchats(fournisseurId) {
    const { data, error } = await supabase
      .from('achats')
      .select('*')
      .eq('fournisseur_id', fournisseurId)
      .eq('boutique_id', boutiqueId)
      .order('created_at', { ascending: false })
    if (!error) setAchats(data)
  }

  async function ajouterFournisseur() {
    if (!nom) return

    const { error } = await supabase
      .from('fournisseurs')
      .insert([{ nom, telephone, adresse, boutique_id: boutiqueId }])

    if (error) {
      alert('Erreur : ' + error.message)
      return
    }
    setNom('')
    setTelephone('')
    setAdresse('')
    chargerFournisseurs()
  }

  function selectionnerFournisseur(fournisseur) {
    setFournisseurSelectionne(fournisseur)
    setPanierAchats([])
    chargerAchats(fournisseur.id)
  }

  // --- Ajouter une ligne au panier de la facture (pas encore enregistrée) ---
  function ajouterLigneAuPanier() {
    if (!montantAchat || Number(montantAchat) <= 0) {
      alert('Entrez un montant valide')
      return
    }
    if (!produitAchatId || !quantiteAchat || Number(quantiteAchat) <= 0) {
      alert('Sélectionnez un produit et une quantité valide')
      return
    }

    const produit = produits.find((p) => String(p.id) === String(produitAchatId))

    setPanierAchats([
      ...panierAchats,
      {
        produit_id: produitAchatId,
        nom_produit: produit?.nom || '',
        description: descriptionAchat,
        montant: Number(montantAchat),
        quantite: Number(quantiteAchat),
      },
    ])

    setDescriptionAchat('')
    setMontantAchat('')
    setProduitAchatId('')
    setQuantiteAchat('')
  }

  function retirerLigneDuPanier(index) {
    setPanierAchats(panierAchats.filter((_, i) => i !== index))
  }

  // --- Enregistrer toute la facture (toutes les lignes du panier d'un coup) ---
  async function enregistrerFacture() {
    if (panierAchats.length === 0) {
      alert('Ajoutez au moins un produit à la facture')
      return
    }

    setEnvoiFacture(true)

    for (const ligne of panierAchats) {
      const { error } = await supabase.from('achats').insert([
        {
          fournisseur_id: fournisseurSelectionne.id,
          description: ligne.description,
          montant_total: ligne.montant,
          montant_paye: 0,
          statut: 'en cours',
          boutique_id: boutiqueId,
          produit_id: ligne.produit_id,
          quantite: ligne.quantite,
        },
      ])

      if (error) {
        setEnvoiFacture(false)
        alert('Erreur sur ' + ligne.nom_produit + ' : ' + error.message)
        return
      }

      await supabase.from('stock_mouvements').insert({
        boutique_id: boutiqueId,
        produit_id: ligne.produit_id,
        employe_id: employe?.id,
        type_mouvement: 'Entrée',
        quantite: ligne.quantite,
        motif: `Achat fournisseur : ${fournisseurSelectionne.nom}`,
      })
    }

    setEnvoiFacture(false)
    setPanierAchats([])
    chargerAchats(fournisseurSelectionne.id)
    alert(`Facture enregistrée : ${panierAchats.length} produit(s) ajouté(s).`)
  }

  async function enregistrerPaiement(achat) {
    if (!montantPaiement || Number(montantPaiement) <= 0) {
      alert('Entrez un montant valide')
      return
    }
    const nouveauMontantPaye = Number(achat.montant_paye) + Number(montantPaiement)
    const nouveauStatut = nouveauMontantPaye >= Number(achat.montant_total) ? 'solde' : 'en cours'

    const { error } = await supabase
      .from('achats')
      .update({ montant_paye: nouveauMontantPaye, statut: nouveauStatut })
      .eq('id', achat.id)

    if (error) {
      alert('Erreur : ' + error.message)
      return
    }
    setMontantPaiement('')
    chargerAchats(fournisseurSelectionne.id)
  }

  const styleBouton = {
    padding: '9px 16px',
    backgroundColor: '#C9822A',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
    fontFamily: 'Poppins, Arial, sans-serif',
  }

  const styleInput = {
    padding: '9px 12px',
    marginRight: '8px',
    marginBottom: '8px',
    border: '1px solid #E6E0D6',
    borderRadius: '8px',
    fontSize: '14px',
    fontFamily: 'Poppins, Arial, sans-serif',
  }

  const styleCarteFormulaire = {
    marginBottom: '20px',
    padding: '18px',
    backgroundColor: 'white',
    border: '1px solid #E6E0D6',
    borderRadius: '10px',
    boxShadow: '0 2px 8px rgba(43, 38, 32, 0.06)',
  }

  const montantTotalPanier = panierAchats.reduce((s, l) => s + l.montant, 0)

  return (
    <div style={{ display: 'flex', padding: '20px', gap: '30px', fontFamily: 'Poppins, Arial, sans-serif' }}>
      <div style={{ flex: 1 }}>
        <h2>🚚 Fournisseurs</h2>

        <div style={styleCarteFormulaire}>
          <h4>Ajouter un fournisseur</h4>
          <input style={styleInput} placeholder="Nom" value={nom} onChange={(e) => setNom(e.target.value)} />
          <input style={styleInput} placeholder="Téléphone" value={telephone} onChange={(e) => setTelephone(e.target.value)} />
          <input style={styleInput} placeholder="Adresse" value={adresse} onChange={(e) => setAdresse(e.target.value)} />
          <br />
          <button style={styleBouton} onClick={ajouterFournisseur}>+ Ajouter</button>
        </div>

        <div>
          {fournisseurs.map((fournisseur) => (
            <div
              key={fournisseur.id}
              onClick={() => selectionnerFournisseur(fournisseur)}
              style={{
                padding: '12px',
                marginBottom: '8px',
                backgroundColor: fournisseurSelectionne?.id === fournisseur.id ? '#C9822A' : 'white',
                color: fournisseurSelectionne?.id === fournisseur.id ? 'white' : '#2B2620',
                border: '1px solid #E6E0D6',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              <strong>{fournisseur.nom}</strong>
              {fournisseur.telephone && (
                <div style={{ fontSize: '13px', opacity: 0.85 }}>{fournisseur.telephone}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 2 }}>
        {!fournisseurSelectionne && <p style={{ color: '#6B6357' }}>Sélectionnez un fournisseur pour voir ses achats.</p>}

        {fournisseurSelectionne && (
          <>
            <h2>📦 Achats chez {fournisseurSelectionne.nom}</h2>

            <div style={styleCarteFormulaire}>
              <h4>Nouvelle facture (plusieurs produits possibles)</h4>

              <input
                style={styleInput}
                placeholder="Description (ex: 50 blocs notes)"
                value={descriptionAchat}
                onChange={(e) => setDescriptionAchat(e.target.value)}
              />
              <input
                style={styleInput}
                placeholder="Montant"
                type="number"
                value={montantAchat}
                onChange={(e) => setMontantAchat(e.target.value)}
              />
                           <input
                style={styleInput}
                placeholder="🔍 Rechercher un produit..."
                value={rechercheProduit}
                onChange={(e) => setRechercheProduit(e.target.value)}
              />
              <select
                style={styleInput}
                value={produitAchatId}
                onChange={(e) => setProduitAchatId(e.target.value)}
              >
                <option value="">-- Choisir un produit --</option>
                {produits
                  .filter((p) => p.nom.toLowerCase().includes(rechercheProduit.toLowerCase()))
                  .map((p) => (
                    <option key={p.id} value={p.id}>{p.nom}</option>
                  ))}
              </select>
              <input
                style={styleInput}
                placeholder="Quantité achetée"
                type="number"
                value={quantiteAchat}
                onChange={(e) => setQuantiteAchat(e.target.value)}
              />
              <br />
              <button style={styleBouton} onClick={ajouterLigneAuPanier}>+ Ajouter à la facture</button>

              {panierAchats.length > 0 && (
                <div style={{ marginTop: '15px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#F7F5F2' }}>
                        <th style={{ textAlign: 'left', padding: '6px', fontSize: '13px', color: '#6B6357' }}>Produit</th>
                        <th style={{ textAlign: 'left', padding: '6px', fontSize: '13px', color: '#6B6357' }}>Qté</th>
                        <th style={{ textAlign: 'left', padding: '6px', fontSize: '13px', color: '#6B6357' }}>Montant</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {panierAchats.map((ligne, index) => (
                        <tr key={index} style={{ borderTop: '1px solid #E6E0D6' }}>
                          <td style={{ padding: '6px' }}>{ligne.nom_produit}</td>
                          <td style={{ padding: '6px' }}>{ligne.quantite}</td>
                          <td style={{ padding: '6px' }}>{ligne.montant.toLocaleString('fr-FR')} FCFA</td>
                          <td style={{ padding: '6px' }}>
                            <button
                              onClick={() => retirerLigneDuPanier(index)}
                              style={{ color: 'red', border: 'none', background: 'none', cursor: 'pointer', fontSize: '13px' }}
                            >
                              Retirer
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p style={{ fontWeight: 600, marginBottom: '10px' }}>
                    Total de la facture : {montantTotalPanier.toLocaleString('fr-FR')} FCFA ({panierAchats.length} produit{panierAchats.length > 1 ? 's' : ''})
                  </p>
                  <button
                    onClick={enregistrerFacture}
                    disabled={envoiFacture}
                    style={{ ...styleBouton, backgroundColor: '#2E7D32' }}
                  >
                    {envoiFacture ? 'Enregistrement...' : '✅ Enregistrer la facture complète'}
                  </button>
                </div>
              )}
            </div>

            {achats.length === 0 && <p style={{ color: '#6B6357' }}>Aucun achat pour ce fournisseur.</p>}

            {achats.map((achat) => {
              const resteAPayer = Number(achat.montant_total) - Number(achat.montant_paye)
              return (
                <div
                  key={achat.id}
                  style={{
                    padding: '14px',
                    marginBottom: '10px',
                    border: '1px solid #E6E0D6',
                    borderRadius: '10px',
                    backgroundColor: achat.statut === 'solde' ? '#EAF5EC' : '#FDECE1',
                  }}
                >
                  {achat.description && <div style={{ fontStyle: 'italic', marginBottom: '4px', color: '#6B6357' }}>{achat.description}</div>}
                  <div>Montant total : <strong>{achat.montant_total} FCFA</strong></div>
                  <div>Déjà payé : {achat.montant_paye} FCFA</div>
                  <div>Reste à payer : <strong>{resteAPayer} FCFA</strong></div>
                  <div>Statut : {achat.statut === 'solde' ? '✅ Soldé' : '⏳ En cours'}</div>

                  {achat.statut !== 'solde' && (
                    <div style={{ marginTop: '8px' }}>
                      <input
                        style={{ ...styleInput, width: '100px' }}
                        placeholder="Montant"
                        type="number"
                        value={montantPaiement}
                        onChange={(e) => setMontantPaiement(e.target.value)}
                      />
                      <button style={styleBouton} onClick={() => enregistrerPaiement(achat)}>
                        Enregistrer paiement
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}

export default Fournisseurs