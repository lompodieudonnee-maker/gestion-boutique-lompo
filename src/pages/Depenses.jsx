import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getBoutiqueId } from '../lib/boutique'

// Date du jour au format AAAA-MM-JJ (heure locale du téléphone / ordinateur)
function dateDuJour() {
  const d = new Date()
  const mois = String(d.getMonth() + 1).padStart(2, '0')
  const jour = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mois}-${jour}`
}

function Depenses() {
  const [depenses, setDepenses] = useState([])
  const [categorie, setCategorie] = useState('')
  const [description, setDescription] = useState('')
  const [montant, setMontant] = useState('')
  const [dateDepense, setDateDepense] = useState(dateDuJour())

  const [totalVentes, setTotalVentes] = useState(0)
  const [totalAchats, setTotalAchats] = useState(0)

  const employe = JSON.parse(localStorage.getItem('employeConnecte'))
  const boutiqueId = getBoutiqueId()
  const peutVoirFinances = employe?.role === 'proprietaire' || employe?.voir_finances === true

  useEffect(() => {
    chargerDepenses()
    chargerTotalVentes()
    chargerTotalAchats()
  }, [])

  async function chargerDepenses() {
    const { data, error } = await supabase
      .from('depenses')
      .select('*')
      .eq('boutique_id', boutiqueId)
      .order('created_at', { ascending: false })
    if (!error) setDepenses(data)
  }

  async function chargerTotalVentes() {
    const { data, error } = await supabase
      .from('sales')
      .select('total')
      .eq('boutique_id', boutiqueId)
    if (!error && data) {
      const total = data.reduce((somme, vente) => somme + Number(vente.total || 0), 0)
      setTotalVentes(total)
    }
  }

  async function chargerTotalAchats() {
    const { data, error } = await supabase
      .from('achats')
      .select('montant_total')
      .eq('boutique_id', boutiqueId)
    if (!error && data) {
      const total = data.reduce((somme, achat) => somme + Number(achat.montant_total || 0), 0)
      setTotalAchats(total)
    }
  }

  async function ajouterDepense() {
    if (!montant || Number(montant) <= 0) {
      alert('Entrez un montant valide')
      return
    }
    if (!dateDepense) {
      alert('Choisissez la date de la dépense')
      return
    }
    if (dateDepense > dateDuJour()) {
      alert('La date de la dépense ne peut pas être dans le futur.')
      return
    }

    const nouvelleDepense = { categorie, description, montant: Number(montant), boutique_id: boutiqueId }
    // Dépense d'un jour passé : on la rattache à ce jour-là (à midi) pour qu'elle
    // compte dans le bénéfice du bon jour. Dépense du jour : heure réelle de saisie.
    if (dateDepense !== dateDuJour()) {
      nouvelleDepense.created_at = new Date(`${dateDepense}T12:00:00`).toISOString()
    }

    const { error } = await supabase.from('depenses').insert([nouvelleDepense])
    if (error) {
      alert('Erreur : ' + error.message)
      return
    }
    setCategorie('')
    setDescription('')
    setMontant('')
    setDateDepense(dateDuJour())
    chargerDepenses()
    chargerTotalVentes()
    chargerTotalAchats()
  }

  const totalDepenses = depenses.reduce((somme, d) => somme + Number(d.montant || 0), 0)
  const benefice = totalVentes - totalDepenses - totalAchats

  const styleBouton = {
    padding: '10px 20px',
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
    borderRadius: '6px',
    fontSize: '14px',
    fontFamily: 'Poppins, Arial, sans-serif',
  }

  const styleCarte = {
    flex: 1,
    padding: '18px',
    borderRadius: '10px',
    textAlign: 'left',
    border: '1px solid #E6E0D6',
    boxShadow: '0 2px 8px rgba(43, 38, 32, 0.06)',
  }

  const styleTitreCarte = { fontSize: '13px', color: '#6B6357', marginBottom: '6px', fontWeight: 500 }
  const styleValeurCarte = { fontSize: '22px', fontWeight: 700 }

  return (
    <div style={{ padding: '20px' }}>
      <h2>💵 Dépenses & Bénéfices</h2>

      {peutVoirFinances ? (
        <div style={{ display: 'flex', gap: '15px', marginBottom: '25px', flexWrap: 'wrap' }}>
          <div style={{ ...styleCarte, backgroundColor: '#EAF5EC' }}>
            <div style={styleTitreCarte}>Total Ventes</div>
            <div style={{ ...styleValeurCarte, color: '#2E7D32' }}>{totalVentes} FCFA</div>
          </div>
          <div style={{ ...styleCarte, backgroundColor: '#FBEAEA' }}>
            <div style={styleTitreCarte}>Total Dépenses</div>
            <div style={{ ...styleValeurCarte, color: '#B71C1C' }}>{totalDepenses} FCFA</div>
          </div>
          <div style={{ ...styleCarte, backgroundColor: '#FDECE1' }}>
            <div style={styleTitreCarte}>Total Achats Fournisseurs</div>
            <div style={{ ...styleValeurCarte, color: '#C9822A' }}>{totalAchats} FCFA</div>
          </div>
          <div style={{ ...styleCarte, backgroundColor: benefice >= 0 ? '#EAF5EC' : '#FBEAEA' }}>
            <div style={styleTitreCarte}>Bénéfice</div>
            <div style={{ ...styleValeurCarte, color: benefice >= 0 ? '#2E7D32' : '#B71C1C' }}>{benefice} FCFA</div>
          </div>
        </div>
      ) : (
        <div style={{ ...styleCarte, backgroundColor: '#FBEAEA', marginBottom: '25px', maxWidth: '300px' }}>
          <div style={styleTitreCarte}>Total Dépenses</div>
          <div style={{ ...styleValeurCarte, color: '#B71C1C' }}>{totalDepenses} FCFA</div>
        </div>
      )}

      <div style={{ marginBottom: '20px', padding: '18px', backgroundColor: '#FFFFFF', border: '1px solid #E6E0D6', borderRadius: '10px' }}>
        <h4>Ajouter une dépense</h4>
        <input
          style={styleInput}
          placeholder="Catégorie (ex: transport, loyer)"
          value={categorie}
          onChange={(e) => setCategorie(e.target.value)}
        />
        <input
          style={styleInput}
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <input
          style={styleInput}
          placeholder="Montant"
          type="number"
          value={montant}
          onChange={(e) => setMontant(e.target.value)}
        />
        <div style={{ display: 'inline-block', verticalAlign: 'top' }}>
          <label style={{ display: 'block', fontSize: '12px', color: '#6B6357', marginBottom: '2px' }}>
            Date de la dépense
          </label>
          <input
            style={styleInput}
            type="date"
            value={dateDepense}
            max={dateDuJour()}
            onChange={(e) => setDateDepense(e.target.value)}
          />
        </div>
        <p style={{ fontSize: '12px', color: '#6B6357', margin: '0 0 10px' }}>
          💡 Si la dépense concerne un autre jour (ex : courant du 07/10), choisissez ce jour-là : elle sera comptée dans le bénéfice du bon jour.
        </p>
        <button style={styleBouton} onClick={ajouterDepense}>+ Ajouter la dépense</button>
      </div>

      <h4>Historique des dépenses</h4>
      {depenses.length === 0 && <p>Aucune dépense enregistrée.</p>}
      {depenses.map((d) => (
        <div
          key={d.id}
          style={{
            padding: '14px',
            marginBottom: '8px',
            border: '1px solid #E6E0D6',
            borderRadius: '10px',
            backgroundColor: '#fff',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <strong>{d.categorie || 'Sans catégorie'}</strong>
              {d.description && <span style={{ color: '#6B6357' }}> — {d.description}</span>}
              {d.created_at && (
                <div style={{ fontSize: '12px', color: '#6B6357', marginTop: '3px' }}>
                  📅 {new Date(d.created_at).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}
                </div>
              )}
            </div>
            <div style={{ fontWeight: 700, color: '#B71C1C' }}>-{d.montant} FCFA</div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default Depenses