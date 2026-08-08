import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

function Caisse() {
  const [produits, setProduits] = useState([])
  const [panier, setPanier] = useState([])
  const [remise, setRemise] = useState(0)
  const [modePaiement, setModePaiement] = useState('Espèces')
  const [recherche, setRecherche] = useState('')
  const [venteReussie, setVenteReussie] = useState(false)

  async function chargerProduits() {
    const { data, error } = await supabase.from('products').select('*')
    if (!error) setProduits(data)
  }

  useEffect(() => {
    chargerProduits()
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

  const produitsFiltres = produits.filter((p) =>
    p.nom.toLowerCase().includes(recherche.toLowerCase())
  )

  async function validerVente() {
    if (panier.length === 0) {
      alert('Le panier est vide.')
      return
    }

    const { data: vente, error: erreurVente } = await supabase
      .from('sales')
      .insert([{ total: totalFinal, mode_paiement: modePaiement, remise: remise }])
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
    }))

    const { error: erreurItems } = await supabase.from('sale_items').insert(lignes)

    if (erreurItems) {
      alert('Erreur lors de l\'enregistrement du détail : ' + erreurItems.message)
      return
    }

    for (const item of panier) {
      const nouvelleQuantite = item.quantite - item.quantiteVente
      await supabase.from('products').update({ quantite: nouvelleQuantite }).eq('id', item.id)
    }

    setPanier([])
    setRemise(0)
    setModePaiement('Espèces')
    setVenteReussie(true)
    chargerProduits()

    setTimeout(() => setVenteReussie(false), 3000)
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>🛒 Caisse</h1>

      {venteReussie && (
        <div style={{ backgroundColor: '#d4edda', padding: '10px', borderRadius: '8px', marginBottom: '15px' }}>
          ✅ Vente enregistrée avec succès !
        </div>
      )}

      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1', minWidth: '300px' }}>
          <h2>Produits disponibles</h2>
          <input
            placeholder="Rechercher un produit..."
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
          />
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {produitsFiltres.map((p) => (
              <div
                key={p.id}
                onClick={() => ajouterAuPanier(p)}
                style={{
                  padding: '10px',
                  border: '1px solid #ccc',
                  borderRadius: '6px',
                  marginBottom: '8px',
                  cursor: 'pointer',
                  backgroundColor: p.quantite < 1 ? '#f0f0f0' : 'white',
                }}
              >
                <strong>{p.nom}</strong> — {p.prix_vente} FCFA
                <br />
                <small>Stock : {p.quantite}</small>
              </div>
            ))}
          </div>
        </div>

        <div style={{ flex: '1', minWidth: '300px' }}>
          <h2>Panier</h2>
          {panier.length === 0 ? (
            <p>Panier vide. Cliquez sur un produit pour l'ajouter.</p>
          ) : (
            <table border="1" cellPadding="6" style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>
                  <th>Produit</th>
                  <th>Qté</th>
                  <th>Sous-total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {panier.map((item) => (
                  <tr key={item.id}>
                    <td>{item.nom}</td>
                    <td>
                      <input
                        type="number"
                        value={item.quantiteVente}
                        onChange={(e) => changerQuantite(item.id, parseInt(e.target.value))}
                        style={{ width: '50px' }}
                      />
                    </td>
                    <td>{item.prix_vente * item.quantiteVente} FCFA</td>
                    <td>
                      <button onClick={() => retirerDuPanier(item.id)}>❌</button>
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
              style={{ width: '100px' }}
            />
          </div>

          <div style={{ marginTop: '10px' }}>
            <label>Mode de paiement : </label>
            <select value={modePaiement} onChange={(e) => setModePaiement(e.target.value)}>
              <option>Espèces</option>
              <option>Orange Money</option>
              <option>Moov Money</option>
              <option>Crédit client</option>
            </select>
          </div>

          <h3 style={{ marginTop: '15px' }}>Total : {totalFinal} FCFA</h3>

          <button
            onClick={validerVente}
            style={{ padding: '10px 20px', fontSize: '16px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
          >
            ✅ Valider la vente
          </button>
        </div>
      </div>
    </div>
  )
}

export default Caisse