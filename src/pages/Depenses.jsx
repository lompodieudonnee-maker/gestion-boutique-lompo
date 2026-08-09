import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

function Depenses() {
  const [depenses, setDepenses] = useState([])
  const [categorie, setCategorie] = useState('')
  const [description, setDescription] = useState('')
  const [montant, setMontant] = useState('')

  const [totalVentes, setTotalVentes] = useState(0)
  const [totalAchats, setTotalAchats] = useState(0)

  const employe = JSON.parse(localStorage.getItem('employeConnecte'))
  const boutiqueId = employe?.boutique_id

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
    const { error } = await supabase.from('depenses').insert([
      { categorie, description, montant: Number(montant), boutique_id: boutiqueId },
    ])
    if (error) {
      alert('Erreur : ' + error.message)
      return
    }
    setCategorie('')
    setDescription('')
    setMontant('')
    chargerDepenses()
    chargerTotalVentes()
    chargerTotalAchats()
  }

  const totalDepenses = depenses.reduce((somme, d) => somme + Number(d.montant || 0), 0)
  const benefice = totalVentes - totalDepenses - totalAchats

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

  const styleCarte = {
    flex: 1,
    padding: '15px',
    borderRadius: '8px',
    color: 'white',
    textAlign: 'center',
  }

  return (
    <div style={{ padding: '20px' }}>
      <h2>💵 Dépenses & Bénéfices</h2>

      <div style={{ display: 'flex', gap: '15px', marginBottom: '25px' }}>
        <div style={{ ...styleCarte, backgroundColor: '#2e7d32' }}>
          <div>Total Ventes</div>
          <div style={{ fontSize: '22px', fontWeight: 'bold' }}>{totalVentes} FCFA</div>
        </div>
        <div style={{ ...styleCarte, backgroundColor: '#c62828' }}>
          <div>Total Dépenses</div>
          <div style={{ fontSize: '22px', fontWeight: 'bold' }}>{totalDepenses} FCFA</div>
        </div>
        <div style={{ ...styleCarte, backgroundColor: '#ef6c00' }}>
          <div>Total Achats Fournisseurs</div>
          <div style={{ fontSize: '22px', fontWeight: 'bold' }}>{totalAchats} FCFA</div>
        </div>
        <div style={{ ...styleCarte, backgroundColor: benefice >= 0 ? '#1565c0' : '#b71c1c' }}>
          <div>Bénéfice</div>
          <div style={{ fontSize: '22px', fontWeight: 'bold' }}>{benefice} FCFA</div>
        </div>
      </div>

      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
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
        <br />
        <button style={styleBouton} onClick={ajouterDepense}>+ Ajouter la dépense</button>
      </div>

      <h4>Historique des dépenses</h4>
      {depenses.length === 0 && <p>Aucune dépense enregistrée.</p>}
      {depenses.map((d) => (
        <div
          key={d.id}
          style={{
            padding: '12px',
            marginBottom: '8px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            backgroundColor: '#fff',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <strong>{d.categorie || 'Sans catégorie'}</strong>
              {d.description && <span> — {d.description}</span>}
            </div>
            <div style={{ fontWeight: 'bold', color: '#c62828' }}>-{d.montant} FCFA</div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default Depenses