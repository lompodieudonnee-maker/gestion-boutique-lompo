import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getBoutiqueId } from '../lib/boutique'

function AlerteStock({ pageActive }) {
  const [produitsAlerte, setProduitsAlerte] = useState([])
  const [visible, setVisible] = useState(true)

  const employe = JSON.parse(localStorage.getItem('employeConnecte'))
  const boutiqueId = getBoutiqueId()
  useEffect(() => {
    chargerAlertes()
  }, [pageActive])

  async function chargerAlertes() {
    const { data: produits, error: erreurProduits } = await supabase
      .from('products')
      .select('id, nom, seuil_alerte')
      .eq('boutique_id', boutiqueId)

    const { data: mouvements, error: erreurMouvements } = await supabase
      .from('stock_mouvements')
      .select('produit_id, quantite')
      .eq('boutique_id', boutiqueId)

    if (erreurProduits || erreurMouvements || !produits || !mouvements) return

    function quantiteActuelle(idProduit) {
      return mouvements
        .filter((m) => String(m.produit_id) === String(idProduit))
        .reduce((total, m) => total + Number(m.quantite), 0)
    }

    const enAlerte = produits
      .map((p) => ({ nom: p.nom, quantite: quantiteActuelle(p.id), seuil_alerte: p.seuil_alerte }))
      .filter((p) => p.seuil_alerte != null && p.quantite <= Number(p.seuil_alerte))

    setProduitsAlerte(enAlerte)
    setVisible(true)
  }

  if (produitsAlerte.length === 0 || !visible) return null

  return (
    <div
      style={{
        backgroundColor: '#e65100',
        color: 'white',
        padding: '12px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '8px',
      }}
    >
      <div>
        ⚠️ <strong>{produitsAlerte.length} produit{produitsAlerte.length > 1 ? 's' : ''} en stock faible :</strong>{' '}
        {produitsAlerte.map((p) => `${p.nom} (${p.quantite})`).join(', ')}
      </div>
      <button
        onClick={() => setVisible(false)}
        style={{
          background: 'none',
          border: '1px solid white',
          color: 'white',
          borderRadius: '4px',
          padding: '4px 10px',
          cursor: 'pointer',
        }}
      >
        Fermer
      </button>
    </div>
  )
}

export default AlerteStock