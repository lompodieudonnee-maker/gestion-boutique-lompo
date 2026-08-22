import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getBoutiqueId } from '../lib/boutique'

function Clients() {
  const employe = JSON.parse(localStorage.getItem('employeConnecte'))
  const boutiqueId = getBoutiqueId()

  const [clients, setClients] = useState([])
  const [clientSelectionne, setClientSelectionne] = useState(null)
  const [credits, setCredits] = useState([])
  const [paiementsParCredit, setPaiementsParCredit] = useState({})

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
    if (!error) {
      setCredits(data)
      chargerHistoriquePaiements(data.map((c) => c.id))
    }
  }

  async function chargerHistoriquePaiements(creditIds) {
    if (!creditIds || creditIds.length === 0) {
      setPaiementsParCredit({})
      return
    }
    const { data, error } = await supabase
      .from('credit_paiements')
      .select('*')
      .in('credit_id', creditIds)
      .order('date_paiement', { ascending: true })

    if (!error && data) {
      const groupe = {}
      data.forEach((p) => {
        if (!groupe[p.credit_id]) groupe[p.credit_id] = []
        groupe[p.credit_id].push(p)
      })
      setPaiementsParCredit(groupe)
    }
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

    const { error: erreurHistorique } = await supabase.from('credit_paiements').insert({
      credit_id: credit.id,
      montant: Number(montantPaiement),
      boutique_id: boutiqueId,
    })

    if (erreurHistorique) {
      alert('Le paiement est enregistré, mais l\'historique n\'a pas pu être sauvegardé : ' + erreurHistorique.message)
    }

    setMontantPaiement('')
    chargerCredits(clientSelectionne.id)
  }

  function formaterTelephoneWhatsApp(tel) {
    if (!tel) return null
    let numero = tel.replace(/\s+/g, '').replace(/^0/, '')
    if (!numero.startsWith('226')) numero = '226' + numero
    return numero
  }

  async function envoyerRecuWhatsApp(credit) {
    let texte = `🧾 Reçu de crédit\n`
    texte += `Client : ${clientSelectionne.nom}\n`
    texte += `--------------------------\n`

    if (credit.sale_id) {
      const { data: lignes } = await supabase
        .from('sale_items')
        .select('nom_produit, quantite, prix_unitaire')
        .eq('sale_id', credit.sale_id)

      if (lignes && lignes.length > 0) {
        texte += `Produits achetés :\n`
        lignes.forEach((l) => {
          texte += `- ${l.nom_produit} x${l.quantite} = ${l.quantite * l.prix_unitaire} FCFA\n`
        })
        texte += `--------------------------\n`
      }
    }

    texte += `Montant total : ${credit.montant_total} FCFA\n`

    const paiements = paiementsParCredit[credit.id] || []
    if (paiements.length > 0) {
      texte += `--------------------------\n`
      texte += `Historique des versements :\n`
      paiements.forEach((p) => {
        const date = new Date(p.date_paiement).toLocaleDateString('fr-FR')
        texte += `- ${date} : ${p.montant} FCFA\n`
      })
    }

    texte += `--------------------------\n`
    texte += `Total payé : ${credit.montant_paye} FCFA\n`
    const reste = Number(credit.montant_total) - Number(credit.montant_paye)
    if (credit.statut === 'solde') {
      texte += `\n✅ CRÉDIT SOLDÉ. Merci pour votre règlement !`
    } else {
      texte += `Reste à payer : ${reste} FCFA\n`
    }

    const texteEncode = encodeURIComponent(texte)
    const numero = formaterTelephoneWhatsApp(clientSelectionne.telephone)
    const url = numero
      ? `https://wa.me/${numero}?text=${texteEncode}`
      : `https://wa.me/?text=${texteEncode}`
    window.open(url, '_blank')
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

  const styleBoutonWhatsApp = {
    padding: '9px 16px',
    backgroundColor: '#25D366',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
    fontFamily: 'Poppins, Arial, sans-serif',
    marginLeft: '8px',
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
      {/* Colonne gauche : liste des clients */}
      <div style={{ flex: 1 }}>
        <h2>👥 Clients</h2>

        <div style={styleCarteFormulaire}>
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
                padding: '12px',
                marginBottom: '8px',
                backgroundColor: clientSelectionne?.id === client.id ? '#C9822A' : 'white',
                color: clientSelectionne?.id === client.id ? 'white' : '#2B2620',
                border: '1px solid #E6E0D6',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              <strong>{client.nom}</strong>
              {client.telephone && (
                <div style={{ fontSize: '13px', opacity: 0.85 }}>{client.telephone}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Colonne droite : crédits du client sélectionné */}
      <div style={{ flex: 2 }}>
        {!clientSelectionne && <p style={{ color: '#6B6357' }}>Sélectionnez un client pour voir ses crédits.</p>}

        {clientSelectionne && (
          <>
            <h2>💰 Crédits de {clientSelectionne.nom}</h2>

            <div style={styleCarteFormulaire}>
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

            {credits.length === 0 && <p style={{ color: '#6B6357' }}>Aucun crédit pour ce client.</p>}

            {credits.map((credit) => {
              const resteAPayer = Number(credit.montant_total) - Number(credit.montant_paye)
              const paiements = paiementsParCredit[credit.id] || []
              return (
                <div
                  key={credit.id}
                  style={{
                    padding: '14px',
                    marginBottom: '10px',
                    border: '1px solid #E6E0D6',
                    borderRadius: '10px',
                    backgroundColor: credit.statut === 'solde' ? '#EAF5EC' : '#FDECE1',
                  }}
                >
                  <div>Montant total : <strong>{credit.montant_total}</strong> FCFA</div>
                  <div>Déjà payé : {credit.montant_paye} FCFA</div>
                  <div>Reste à payer : <strong>{resteAPayer}</strong> FCFA</div>
                  <div>Statut : {credit.statut === 'solde' ? '✅ Soldé' : '⏳ En cours'}</div>

                  {paiements.length > 0 && (
                    <div style={{ marginTop: '8px', fontSize: '13px', color: '#6B6357' }}>
                      <div style={{ fontWeight: 600, marginBottom: '2px' }}>Historique des versements :</div>
                      {paiements.map((p) => (
                        <div key={p.id}>
                          {new Date(p.date_paiement).toLocaleDateString('fr-FR')} — {p.montant} FCFA
                        </div>
                      ))}
                    </div>
                  )}

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

                  <div style={{ marginTop: '8px' }}>
                    <button style={styleBoutonWhatsApp} onClick={() => envoyerRecuWhatsApp(credit)}>
                      📲 Envoyer sur WhatsApp
                    </button>
                  </div>
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