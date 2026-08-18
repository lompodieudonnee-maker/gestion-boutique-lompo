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
    chargerAchats(fournisseur.id)
  }

  async function ajouterAchat() {
    if (!montantAchat || Number(montantAchat) <= 0) {
      alert('Entrez un montant valide')
      return
    }
    if (!produitAchatId || !quantiteAchat || Number(quantiteAchat) <= 0) {
      alert('Sélectionnez un produit et une quantité valide')
      return
    }

    const { error } = await supabase.from('achats').insert([
      {
        fournisseur_id: fournisseurSelectionne.id,
        description: descriptionAchat,
        montant_total: Number(montantAchat),
        montant_paye: 0,
        statut: 'en cours',
        boutique_id: boutiqueId,
        produit_id: produitAchatId,
        quantite: Number(quantiteAchat),
      },
    ])

    if (error) {
      alert('Erreur : ' + error.message)
      return
    }

    await supabase.from('stock_mouvements').insert({
      boutique_id: boutiqueId,
      produit_id: produitAchatId,
      employe_id: employe?.id,
      type_mouvement: 'Entrée',
      quantite: Number(quantiteAchat),
      motif: `Achat fournisseur : ${fournisseurSelectionne.nom}`,
    })

    setDescriptionAchat('')
    setMontantAchat('')
    setProduitAchatId('')
    setQuantiteAchat('')
    chargerAchats(fournisseurSelectionne.id)
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
              <h4>Nouvel achat</h4>
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
              <select
                style={styleInput}
                value={produitAchatId}
                onChange={(e) => setProduitAchatId(e.target.value)}
              >
                <option value="">-- Choisir un produit --</option>
                {produits.map((p) => (
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
              <button style={styleBouton} onClick={ajouterAchat}>+ Ajouter l'achat</button>
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