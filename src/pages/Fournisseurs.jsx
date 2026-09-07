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
  const [montantPaiement, setMontantPaiement] = useState({})

  const [produits, setProduits] = useState([])
  const [produitAchatId, setProduitAchatId] = useState('')
  const [quantiteAchat, setQuantiteAchat] = useState('')
  const [rechercheProduit, setRechercheProduit] = useState('')

  const [panierAchats, setPanierAchats] = useState([])
  const [envoiFacture, setEnvoiFacture] = useState(false)

  const [whatsappResponsable, setWhatsappResponsable] = useState('')
  const [nomBoutique, setNomBoutique] = useState('')

  const [facturesEnAttente, setFacturesEnAttente] = useState([])
  const [traitementFactureId, setTraitementFactureId] = useState(null)

  const employe = JSON.parse(localStorage.getItem('employeConnecte'))
  const boutiqueId = getBoutiqueId()
  const peutValider =
    employe?.role === 'proprietaire' ||
    employe?.role === 'superadmin' ||
    employe?.voir_finances === true

  useEffect(() => {
    chargerFournisseurs()
    chargerProduits()
    chargerBoutique()
    chargerFacturesEnAttente()
  }, [])

  async function chargerBoutique() {
    const { data, error } = await supabase
      .from('boutiques')
      .select('nom, whatsapp_responsable')
      .eq('id', boutiqueId)
      .single()
    if (!error && data) {
      setNomBoutique(data.nom)
      setWhatsappResponsable(data.whatsapp_responsable || '')
    }
  }

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

  // ============================================================
  // FACTURES EN ATTENTE DE VALIDATION (soumises par un employé sans permission finances)
  // ============================================================

  async function chargerFacturesEnAttente() {
    if (!boutiqueId) return
    const { data, error } = await supabase
      .from('factures_attente')
      .select('*')
      .eq('boutique_id', boutiqueId)
      .eq('statut', 'en_attente')
      .order('created_at', { ascending: false })
    if (!error) setFacturesEnAttente(data || [])
  }

  async function approuverFactureEnAttente(facture) {
    if (!peutValider) return
    setTraitementFactureId(facture.id)

    for (const ligne of facture.lignes) {
      const { error } = await supabase.from('achats').insert([
        {
          fournisseur_id: facture.fournisseur_id,
          description: ligne.description,
          montant_total: ligne.montant,
          montant_paye: 0,
          statut: 'en cours',
          boutique_id: facture.boutique_id,
          produit_id: ligne.produit_id,
          quantite: ligne.quantite,
          reference_facture: facture.reference_facture,
        },
      ])

      if (error) {
        setTraitementFactureId(null)
        alert('Erreur sur ' + (ligne.nom_produit || 'un produit') + ' : ' + error.message)
        return
      }

      await supabase.from('stock_mouvements').insert({
        boutique_id: facture.boutique_id,
        produit_id: ligne.produit_id,
        employe_id: employe?.id,
        type_mouvement: 'Entrée',
        quantite: ligne.quantite,
        motif: `Achat fournisseur (facture approuvée, envoyée par ${facture.cree_par_nom || 'un employé'})`,
      })
    }

    await supabase
      .from('factures_attente')
      .update({
        statut: 'approuvee',
        traite_par_employe_id: employe?.id,
        traite_le: new Date().toISOString(),
      })
      .eq('id', facture.id)

    setTraitementFactureId(null)
    chargerFacturesEnAttente()
    if (fournisseurSelectionne?.id === facture.fournisseur_id) {
      chargerAchats(facture.fournisseur_id)
    }
    alert('Facture approuvée et enregistrée dans les achats.')
  }

  async function rejeterFactureEnAttente(facture) {
    if (!confirm("Rejeter cette facture ? Elle ne sera pas enregistrée dans les achats.")) return
    setTraitementFactureId(facture.id)
    await supabase
      .from('factures_attente')
      .update({
        statut: 'rejetee',
        traite_par_employe_id: employe?.id,
        traite_le: new Date().toISOString(),
      })
      .eq('id', facture.id)
    setTraitementFactureId(null)
    chargerFacturesEnAttente()
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

  async function supprimerFournisseur(e, fournisseur) {
    e.stopPropagation() // évite de sélectionner le fournisseur en cliquant sur "Supprimer"
    if (!confirm(`Supprimer le fournisseur "${fournisseur.nom}" ? Cette action est définitive.`)) return

    const { error } = await supabase.from('fournisseurs').delete().eq('id', fournisseur.id)

    if (error) {
      alert("Impossible de supprimer ce fournisseur : il a probablement des achats déjà enregistrés liés à son historique. " + error.message)
      return
    }

    if (fournisseurSelectionne?.id === fournisseur.id) {
      setFournisseurSelectionne(null)
      setAchats([])
    }
    chargerFournisseurs()
  }

  function selectionnerFournisseur(fournisseur) {
    setFournisseurSelectionne(fournisseur)
    setPanierAchats([])
    chargerAchats(fournisseur.id)
  }

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

  async function envoyerFacturePourValidation() {
    if (panierAchats.length === 0) {
      alert('Ajoutez au moins un produit à la facture avant de l\'envoyer.')
      return
    }

    const numero = whatsappResponsable.replace(/[^0-9]/g, '')
    // Ouvre l'onglet WhatsApp tout de suite (au moment du clic) pour éviter que le navigateur le bloque ;
    // on y mettra le message une fois la facture bien enregistrée.
    const fenetreWhatsApp = numero ? window.open('', '_blank') : null

    setEnvoiFacture(true)
    const referenceFacture = `FACT-${Date.now()}`

    const { error } = await supabase.from('factures_attente').insert({
      boutique_id: boutiqueId,
      fournisseur_id: fournisseurSelectionne.id,
      reference_facture: referenceFacture,
      lignes: panierAchats,
      montant_total: montantTotalPanier,
      statut: 'en_attente',
      cree_par_employe_id: employe?.id,
      cree_par_nom: employe?.nom || '',
    })

    setEnvoiFacture(false)

    if (error) {
      fenetreWhatsApp?.close()
      alert("Erreur lors de l'envoi pour validation : " + error.message)
      return
    }

    if (numero && fenetreWhatsApp) {
      let message = `Bonjour, voici une nouvelle facture fournisseur (${fournisseurSelectionne?.nom || ''}) pour ${nomBoutique || 'la boutique'}, à valider dans Stockia :\n\n`
      panierAchats.forEach((ligne) => {
        message += `- ${ligne.nom_produit} x${ligne.quantite} — ${ligne.montant.toLocaleString('fr-FR')} FCFA\n`
      })
      message += `\nTotal : ${montantTotalPanier.toLocaleString('fr-FR')} FCFA\n\nElle est déjà enregistrée dans Stockia : il suffit de l'approuver (Fournisseurs → Factures en attente de validation).`
      fenetreWhatsApp.location.href = `https://wa.me/${numero}?text=${encodeURIComponent(message)}`
    } else {
      alert("Facture envoyée pour validation dans Stockia (Fournisseurs → Factures en attente de validation). Aucun numéro WhatsApp du responsable n'étant configuré, aucune notification WhatsApp n'a été envoyée.")
    }

    setPanierAchats([])
    chargerFacturesEnAttente()
  }

  async function enregistrerFacture() {
    if (!peutValider) {
      alert('Seul le propriétaire ou un employé avec la permission "Voir les finances" peut valider une facture fournisseur.')
      return
    }

    if (panierAchats.length === 0) {
      alert('Ajoutez au moins un produit à la facture')
      return
    }

    setEnvoiFacture(true)

    const referenceFacture = `FACT-${Date.now()}`

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
          reference_facture: referenceFacture,
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

  // --- Regroupement des achats en factures ---
  function facturesGroupees() {
    const groupes = {}
    achats.forEach((achat) => {
      const cle = achat.reference_facture || `seul-${achat.id}`
      if (!groupes[cle]) {
        groupes[cle] = {
          cle,
          lignes: [],
          created_at: achat.created_at,
        }
      }
      groupes[cle].lignes.push(achat)
      if (new Date(achat.created_at) > new Date(groupes[cle].created_at)) {
        groupes[cle].created_at = achat.created_at
      }
    })

    return Object.values(groupes)
      .map((g) => {
        const montantTotal = g.lignes.reduce((s, l) => s + Number(l.montant_total), 0)
        const montantPaye = g.lignes.reduce((s, l) => s + Number(l.montant_paye), 0)
        const resteAPayer = montantTotal - montantPaye
        const statut = resteAPayer <= 0 ? 'solde' : 'en cours'
        return { ...g, montantTotal, montantPaye, resteAPayer, statut }
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }

  async function enregistrerPaiementFacture(facture) {
    const montant = Number(montantPaiement[facture.cle])
    if (!montant || montant <= 0) {
      alert('Entrez un montant valide')
      return
    }

    let montantRestant = montant
    const lignesTriees = [...facture.lignes].sort((a, b) => a.id - b.id)

    for (const ligne of lignesTriees) {
      if (montantRestant <= 0) break
      const resteLigne = Number(ligne.montant_total) - Number(ligne.montant_paye)
      if (resteLigne <= 0) continue

      const aAppliquer = Math.min(montantRestant, resteLigne)
      const nouveauMontantPaye = Number(ligne.montant_paye) + aAppliquer
      const nouveauStatut = nouveauMontantPaye >= Number(ligne.montant_total) ? 'solde' : 'en cours'

      await supabase
        .from('achats')
        .update({ montant_paye: nouveauMontantPaye, statut: nouveauStatut })
        .eq('id', ligne.id)

      montantRestant -= aAppliquer
    }

    setMontantPaiement({ ...montantPaiement, [facture.cle]: '' })
    chargerAchats(fournisseurSelectionne.id)
  }

  const produitsFiltres = produits.filter((p) =>
    p.nom.toLowerCase().includes(rechercheProduit.toLowerCase())
  )

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

        {peutValider && facturesEnAttente.length > 0 && (
          <div style={{ ...styleCarteFormulaire, border: '1px solid #E3A055', backgroundColor: '#FDF6EC' }}>
            <h4 style={{ marginTop: 0 }}>🔔 Factures en attente de validation ({facturesEnAttente.length})</h4>
            {facturesEnAttente.map((facture) => (
              <div
                key={facture.id}
                style={{
                  padding: '12px',
                  marginBottom: '10px',
                  backgroundColor: 'white',
                  border: '1px solid #E6E0D6',
                  borderRadius: '8px',
                }}
              >
                <div style={{ fontSize: '13px', color: '#6B6357', marginBottom: '6px' }}>
                  {fournisseurs.find((f) => f.id === facture.fournisseur_id)?.nom || 'Fournisseur'} — envoyée par {facture.cree_par_nom || 'un employé'} le {new Date(facture.created_at).toLocaleString('fr-FR')}
                </div>
                <ul style={{ margin: '0 0 8px', paddingLeft: '18px', fontSize: '14px' }}>
                  {(facture.lignes || []).map((l, i) => (
                    <li key={i}>{l.nom_produit} x{l.quantite} — {Number(l.montant).toLocaleString('fr-FR')} FCFA</li>
                  ))}
                </ul>
                <div style={{ marginBottom: '10px' }}>
                  Total : <strong>{Number(facture.montant_total).toLocaleString('fr-FR')} FCFA</strong>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => approuverFactureEnAttente(facture)}
                    disabled={traitementFactureId === facture.id}
                    style={{ ...styleBouton, backgroundColor: '#2E7D32' }}
                  >
                    {traitementFactureId === facture.id ? '...' : '✅ Approuver'}
                  </button>
                  <button
                    onClick={() => rejeterFactureEnAttente(facture)}
                    disabled={traitementFactureId === facture.id}
                    style={{ padding: '9px 16px', backgroundColor: 'white', color: '#B71C1C', border: '1px solid #E6E0D6', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}
                  >
                    ❌ Rejeter
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

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
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <div>
                <strong>{fournisseur.nom}</strong>
                {fournisseur.telephone && (
                  <div style={{ fontSize: '13px', opacity: 0.85 }}>{fournisseur.telephone}</div>
                )}
              </div>
              <button
                onClick={(e) => supprimerFournisseur(e, fournisseur)}
                style={{
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  fontSize: '13px',
                  color: fournisseurSelectionne?.id === fournisseur.id ? 'white' : '#B71C1C',
                  flexShrink: 0,
                }}
              >
                Supprimer
              </button>
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
                {produitsFiltres.map((p) => (
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
                  {peutValider ? (
                    <button
                      onClick={enregistrerFacture}
                      disabled={envoiFacture}
                      style={{ ...styleBouton, backgroundColor: '#2E7D32' }}
                    >
                      {envoiFacture ? 'Enregistrement...' : '✅ Enregistrer la facture complète'}
                    </button>
                  ) : (
                    <div
                      style={{
                        padding: '12px 16px',
                        background: '#F2F1EE',
                        border: '1px solid #E6E0D6',
                        borderRadius: '8px',
                        color: '#6B6357',
                        fontSize: '13px',
                      }}
                    >
                      🔒 Seul le propriétaire ou un employé avec la permission "Voir les finances" peut valider cette facture.
                      <p style={{ fontSize: '12px', margin: '6px 0 0' }}>
                        En envoyant, la facture sera enregistrée dans Stockia en attente, et le responsable n'aura qu'à l'approuver (Fournisseurs → Factures en attente).
                      </p>
                      <div style={{ marginTop: '10px' }}>
                        <button
                          onClick={envoyerFacturePourValidation}
                          disabled={envoiFacture}
                          style={{
                            padding: '10px 18px',
                            backgroundColor: '#25D366',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontFamily: 'Poppins, Arial, sans-serif',
                            fontWeight: 600,
                          }}
                        >
                          {envoiFacture ? 'Envoi...' : '📲 Envoyer pour validation'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {facturesGroupees().length === 0 && <p style={{ color: '#6B6357' }}>Aucun achat pour ce fournisseur.</p>}

            {facturesGroupees().map((facture) => (
              <div
                key={facture.cle}
                style={{
                  padding: '14px',
                  marginBottom: '10px',
                  border: '1px solid #E6E0D6',
                  borderRadius: '10px',
                  backgroundColor: facture.statut === 'solde' ? '#EAF5EC' : '#FDECE1',
                }}
              >
                <div style={{ fontSize: '13px', color: '#6B6357', marginBottom: '6px' }}>
                  {new Date(facture.created_at).toLocaleDateString('fr-FR')} — {facture.lignes.length} produit{facture.lignes.length > 1 ? 's' : ''}
                </div>

                <ul style={{ margin: '0 0 8px', paddingLeft: '18px', fontSize: '14px' }}>
                  {facture.lignes.map((l) => (
                    <li key={l.id}>
                      {produits.find((p) => String(p.id) === String(l.produit_id))?.nom || l.description || 'Produit'} x{l.quantite} — {Number(l.montant_total).toLocaleString('fr-FR')} FCFA
                    </li>
                  ))}
                </ul>

                <div>Montant total : <strong>{facture.montantTotal.toLocaleString('fr-FR')} FCFA</strong></div>
                <div>Déjà payé : {facture.montantPaye.toLocaleString('fr-FR')} FCFA</div>
                <div>Reste à payer : <strong>{facture.resteAPayer.toLocaleString('fr-FR')} FCFA</strong></div>
                <div>Statut : {facture.statut === 'solde' ? '✅ Soldé' : '⏳ En cours'}</div>

                {facture.statut !== 'solde' && (
                  <div style={{ marginTop: '8px' }}>
                    <input
                      style={{ ...styleInput, width: '100px' }}
                      placeholder="Montant"
                      type="number"
                      value={montantPaiement[facture.cle] || ''}
                      onChange={(e) => setMontantPaiement({ ...montantPaiement, [facture.cle]: e.target.value })}
                    />
                    <button style={styleBouton} onClick={() => enregistrerPaiementFacture(facture)}>
                      Enregistrer paiement
                    </button>
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

export default Fournisseurs