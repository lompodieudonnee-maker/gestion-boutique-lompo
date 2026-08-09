import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

function Clients() {
  const employe = JSON.parse(localStorage.getItem('employeConnecte'))
  const boutiqueId = employe?.boutique_id

  const [clients, setClients] = useState([])
  const [clientSelectionne, setClientSelectionne] = useState(null)
  const [credits, setCredits] = useState([])

  const [nom, setNom] = useState('')
  const [telephone, setTelephone] = useState('')
  const [adresse, setAdresse] = useState('')

  const [montantCredit, setMontantCredit] = useState('')
  const [montantPaiement, setMontantPaiement] = useState('')

  useEffect(() => {
    chargerClients()
  }, [])

  async function chargerClients() {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('boutique_id', boutiqueId)
      .order('nom', { ascending: true })
    if (!error) setClients(data)
  }

  async function chargerCredits(clientId) {
    const { data, error } = await supabase
      .from('credits')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
    if (!error) setCredits(data)
  }

  async function ajouterClient() {
    if (!nom) {
      alert('Le nom est obligatoire')
      return
    }
    const { error } = await supabase
      .from('clients')
      .insert([{ nom, telephone, adresse, boutique_id: boutiqueId }])

    if (error) {
      alert('Erreur : ' + error.message)
      return
    }
    setNom('')
    setTelephone('')
    setAdresse('')
    chargerClients()
  }

  function selectionnerClient(client) {
    setClientSelectionne(client)
    chargerCredits(client.id)
  }

  async function ajouterCredit() {
    if (!montantCredit || Number(montantCredit) <= 0) {
      alert('Entrez un montant valide')
      return
    }
    const { error } = await supabase.from('credits').insert(
      {
        client_id: clientSelectionne.id,
        montant_total: Number(montantCredit),
        montant_paye: 0,
        statut: 'en cours',
        boutique_id: boutiqueId,
      }
    )
    if (error) {
      alert('Erreur : ' + error.message)
      return
    }
    setMontantCredit('')
    chargerCredits(clientSelectionne.id)
  }

  async function enregistrerPaiement(credit) {
    if (!montantPaiement || Number(montantPaiement) <= 0) {
      alert('Entrez un montant valide')
      return
    }
    const nouveauMontantPaye = Number(credit.montant_paye) + Number(montantPaiement)
    const nouveauStatut = nouveauMontantPaye >= Number(credit.montant_total) ? 'solde' : 'en cours'

    const { error } = await supabase
      .from('credits')
      .update({ montant_paye: nouveauMontantPaye, statut: nouveauStatut })
      .eq('id', credit.id)

    if (error) {
      alert('Erreur : ' + error.message)
      return
    }
    setMontantPaiement('')
    chargerCredits(clientSelectionne.id)
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
      {/* Colonne gauche : liste des clients */}
      <div style={{ flex: 1 }}>
        <h2>👥 Clients</h2>

        <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ccc', borderRadius: '8px' }}>
          <h4>Ajouter un client</h4>
          <input style={styleInput} placeholder="Nom" value={nom} onChange={(e) => setNom(e.target.value)} />
          <input style={styleInput} placeholder="Téléphone" value={telephone} onChange={(e) => setTelephone(e.target.value)} />
          <input style={styleInput} placeholder="Adresse" value={adresse} onChange={(e) => setAdresse(e.target.value)} />
          <br />
          <button style={styleBouton} onClick={ajouterClient}>Ajouter</button>
        </div>

        <div>
          {clients.map((client) => (
            <div
              key={client.id}
              onClick={() => selectionnerClient(client)}
              style={{
                padding: '10px',
                marginBottom: '6px',
                backgroundColor: clientSelectionne?.id === client.id ? '#333' : '#f5f5f5',
                color: clientSelectionne?.id === client.id ? 'white' : 'black',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              <strong>{client.nom}</strong>
              {client.telephone && <div style={{ fontSize: '13px' }}>{client.telephone}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Colonne droite : crédits du client sélectionné */}
      <div style={{ flex: 2 }}>
        {!clientSelectionne && <p>Sélectionnez un client pour voir ses crédits.</p>}

        {clientSelectionne && (
          <>
            <h2>💰 Crédits de {clientSelectionne.nom}</h2>

            <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ccc', borderRadius: '8px' }}>
              <h4>Nouveau crédit</h4>
              <input
                style={styleInput}
                placeholder="Montant"
                type="number"
                value={montantCredit}
                onChange={(e) => setMontantCredit(e.target.value)}
              />
              <button style={styleBouton} onClick={ajouterCredit}>Ajouter</button>
            </div>

            {credits.length === 0 && <p>Aucun crédit pour ce client.</p>}

            {credits.map((credit) => {
              const resteAPayer = Number(credit.montant_total) - Number(credit.montant_paye)
              return (
                <div
                  key={credit.id}
                  style={{
                    padding: '12px',
                    marginBottom: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    backgroundColor: credit.statut === 'solde' ? '#d4edda' : '#fff3cd',
                  }}
                >
                  <div>Montant total : <strong>{credit.montant_total}</strong> FCFA</div>
                  <div>Déjà payé : {credit.montant_paye} FCFA</div>
                  <div>Reste à payer : <strong>{resteAPayer}</strong> FCFA</div>
                  <div>Statut : {credit.statut === 'solde' ? '✅ Soldé' : '⏳ En cours'}</div>

                  {credit.statut !== 'solde' && (
                    <div style={{ marginTop: '8px' }}>
                      <input
                        style={{ ...styleInput, width: '100px' }}
                        placeholder="Montant"
                        type="number"
                        value={montantPaiement}
                        onChange={(e) => setMontantPaiement(e.target.value)}
                      />
                      <button style={styleBouton} onClick={() => enregistrerPaiement(credit)}>
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

export default Clients