import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

function TableauDeBord() {
  const [nbProduits, setNbProduits] = useState(0)
  const [produitsAlerte, setProduitsAlerte] = useState(0)
  const [totalVentesJour, setTotalVentesJour] = useState(0)
  const [nbClients, setNbClients] = useState(0)
  const [totalCreances, setTotalCreances] = useState(0)
  const [nbFournisseurs, setNbFournisseurs] = useState(0)
  const [totalDettes, setTotalDettes] = useState(0)
  const [benefice, setBenefice] = useState(0)
  const [chargement, setChargement] = useState(true)

  useEffect(() => {
    chargerDonnees()
  }, [])

  async function chargerDonnees() {
    setChargement(true)

    // Produits
    const { data: produits } = await supabase.from('products').select('quantite, seuil_alerte')
    if (produits) {
      setNbProduits(produits.length)
      const alertes = produits.filter((p) => Number(p.quantite) <= Number(p.seuil_alerte)).length
      setProduitsAlerte(alertes)
    }

    // Ventes du jour
    const debutJour = new Date()
    debutJour.setHours(0, 0, 0, 0)
    const { data: ventes } = await supabase
      .from('sales')
      .select('total, created_at')
    if (ventes) {
      const ventesJour = ventes.filter((v) => new Date(v.created_at) >= debutJour)
      const totalJour = ventesJour.reduce((s, v) => s + Number(v.total || 0), 0)
      setTotalVentesJour(totalJour)

      const totalVentesGlobal = ventes.reduce((s, v) => s + Number(v.total || 0), 0)

      // Dépenses
      const { data: depenses } = await supabase.from('depenses').select('montant')
      const totalDepenses = depenses ? depenses.reduce((s, d) => s + Number(d.montant || 0), 0) : 0

      // Achats fournisseurs
      const { data: achats } = await supabase.from('achats').select('montant_total')
      const totalAchats = achats ? achats.reduce((s, a) => s + Number(a.montant_total || 0), 0) : 0

      setBenefice(totalVentesGlobal - totalDepenses - totalAchats)

      // Dettes fournisseurs (reste à payer sur achats non soldés)
      if (achats) {
        const { data: achatsDetail } = await supabase.from('achats').select('montant_total, montant_paye')
        const dettes = achatsDetail
          ? achatsDetail.reduce((s, a) => s + (Number(a.montant_total) - Number(a.montant_paye)), 0)
          : 0
        setTotalDettes(dettes)
      }
    }

    // Clients
    const { data: clients } = await supabase.from('clients').select('id')
    if (clients) setNbClients(clients.length)

    // Créances (reste à payer sur crédits non soldés)
    const { data: credits } = await supabase.from('credits').select('montant_total, montant_paye')
    if (credits) {
      const creances = credits.reduce((s, c) => s + (Number(c.montant_total) - Number(c.montant_paye)), 0)
      setTotalCreances(creances)
    }

    // Fournisseurs
    const { data: fournisseurs } = await supabase.from('fournisseurs').select('id')
    if (fournisseurs) setNbFournisseurs(fournisseurs.length)

    setChargement(false)
  }

  const styleCarte = {
    flex: '1 1 200px',
    padding: '20px',
    borderRadius: '10px',
    color: 'white',
    textAlign: 'center',
  }

  const styleTitre = { fontSize: '14px', opacity: 0.9, marginBottom: '6px' }
  const styleValeur = { fontSize: '26px', fontWeight: 'bold' }

  if (chargement) {
    return <div style={{ padding: '20px' }}>Chargement du tableau de bord...</div>
  }

  return (
    <div style={{ padding: '20px' }}>
      <h2>📊 Tableau de bord</h2>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', marginTop: '20px' }}>
        <div style={{ ...styleCarte, backgroundColor: '#2e7d32' }}>
          <div style={styleTitre}>Ventes du jour</div>
          <div style={styleValeur}>{totalVentesJour} FCFA</div>
        </div>

        <div style={{ ...styleCarte, backgroundColor: benefice >= 0 ? '#1565c0' : '#b71c1c' }}>
          <div style={styleTitre}>Bénéfice global</div>
          <div style={styleValeur}>{benefice} FCFA</div>
        </div>

        <div style={{ ...styleCarte, backgroundColor: produitsAlerte > 0 ? '#e65100' : '#455a64' }}>
          <div style={styleTitre}>Produits en stock</div>
          <div style={styleValeur}>{nbProduits}</div>
          {produitsAlerte > 0 && (
            <div style={{ fontSize: '13px', marginTop: '4px' }}>⚠️ {produitsAlerte} en alerte stock</div>
          )}
        </div>

        <div style={{ ...styleCarte, backgroundColor: '#6a1b9a' }}>
          <div style={styleTitre}>Clients</div>
          <div style={styleValeur}>{nbClients}</div>
          <div style={{ fontSize: '13px', marginTop: '4px' }}>Créances : {totalCreances} FCFA</div>
        </div>

        <div style={{ ...styleCarte, backgroundColor: '#00838f' }}>
          <div style={styleTitre}>Fournisseurs</div>
          <div style={styleValeur}>{nbFournisseurs}</div>
          <div style={{ fontSize: '13px', marginTop: '4px' }}>Dettes : {totalDettes} FCFA</div>
        </div>
      </div>
    </div>
  )
}

export default TableauDeBord