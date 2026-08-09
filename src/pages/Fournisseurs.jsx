import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

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

  const employe = JSON.parse(localStorage.getItem('employeConnecte'))
  const boutiqueId = employe?.boutique_id

  useEffect(() => {
    chargerFournisseurs()
  }, [])

  async function chargerFournisseurs() {
    const { data, error } = await supabase
      .from('fournisseurs')
      .select('*')
      .eq('boutique_id', boutiqueId)
      .order('nom', { ascending: true })
    if (!error) setFournisseurs(data)
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
    const { error } = await supabase.from('achats').insert([
      {
        fournisseur_id: fournisseurSelectionne.id,
        description: descriptionAchat,
        montant_total: Number(montantAchat),
        montant_paye: 0,
        statut: 'en cours',
        boutique_id: boutiqueId,
      },
    ])

    if (error) {
      alert('Erreur : ' + error.message)
      return
    }
    setDescriptionAchat('')
    setMontantAchat('')
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
    padding: '8px 16px',
    backgroundColor: '#333',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
  }

  const styleInput = {
    padding: '8px',
    marginRight: '8px',
    marginBottom: '8px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '14px',
  }

  return (
    <div style={{ display: 'flex', padding: '20px', gap: '30px' }}>
      {/* Colonne gauche : liste des fournisseurs */}
      <div style={{ flex: 1 }}>
        <h2>🚚 Fournisseurs</h2>

        <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
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
                padding: '10px',
                marginBottom: '6px',
                backgroundColor: fournisseurSelectionne?.id === fournisseur.id ? '#333' : '#eee',
                color: fournisseurSelectionne?.id === fournisseur.id ? 'white' : 'black',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              <strong>{fournisseur.nom}</strong>
              {fournisseur.telephone && <div style={{ fontSize: '13px' }}>{fournisseur.telephone}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Colonne droite : achats du fournisseur sélectionné */}
      <div style={{ flex: 2 }}>
        {!fournisseurSelectionne && <p>Sélectionnez un fournisseur pour voir ses achats.</p>}

        {fournisseurSelectionne && (
          <>
            <h2>📦 Achats chez {fournisseurSelectionne.nom}</h2>

            <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
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
              <button style={styleBouton} onClick={ajouterAchat}>+ Ajouter l'achat</button>
            </div>

            {achats.length === 0 && <p>Aucun achat pour ce fournisseur.</p>}

            {achats.map((achat) => {
              const resteAPayer = Number(achat.montant_total) - Number(achat.montant_paye)
              return (
                <div
                  key={achat.id}
                  style={{
                    padding: '12px',
                    marginBottom: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    backgroundColor: achat.statut === 'solde' ? '#e8f5e9' : '#fff8e1',
                  }}
                >
                  {achat.description && <div style={{ fontStyle: 'italic', marginBottom: '4px' }}>{achat.description}</div>}
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