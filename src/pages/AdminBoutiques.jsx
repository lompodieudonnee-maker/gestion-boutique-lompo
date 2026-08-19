import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

function AdminBoutiques({ onDeconnexion }) {
  const [boutiques, setBoutiques] = useState([])
  const [chargement, setChargement] = useState(true)

  useEffect(() => {
    chargerBoutiques()
  }, [])

  async function chargerBoutiques() {
    setChargement(true)
    const { data } = await supabase
      .from('boutiques')
      .select('*')
      .order('id', { ascending: false })
    setBoutiques(data || [])
    setChargement(false)
  }

  async function validerBoutique(id) {
    const maintenant = new Date()
    const fin = new Date()
    fin.setDate(fin.getDate() + 14)

    await supabase
      .from('boutiques')
      .update({
        statut: 'active',
        date_debut_essai: maintenant.toISOString(),
        date_fin_essai: fin.toISOString(),
      })
      .eq('id', id)

    chargerBoutiques()
  }

  async function suspendreBoutique(id) {
    await supabase.from('boutiques').update({ statut: 'suspendue' }).eq('id', id)
    chargerBoutiques()
  }

  async function marquerPaiementRecu(id) {
    const maintenant = new Date()
    await supabase
      .from('boutiques')
      .update({ date_dernier_paiement: maintenant.toISOString() })
      .eq('id', id)
    chargerBoutiques()
  }

  function paiementEnRetard(boutique) {
    if (!boutique.date_dernier_paiement) return false
    const dernierPaiement = new Date(boutique.date_dernier_paiement)
    const trenteJoursApres = new Date(dernierPaiement)
    trenteJoursApres.setDate(trenteJoursApres.getDate() + 30)
    return trenteJoursApres < new Date()
  }

  const stylePastille = (statut) => {
    const couleurs = {
      en_attente: { bg: '#FDECE1', color: '#C9822A' },
      active: { bg: '#EAF5EC', color: '#2E7D32' },
      suspendue: { bg: '#FCE4E4', color: '#C62828' },
    }
    const c = couleurs[statut] || { bg: '#F2F1EE', color: '#2B2620' }
    return {
      backgroundColor: c.bg,
      color: c.color,
      padding: '4px 10px',
      borderRadius: '20px',
      fontSize: '12px',
      fontWeight: 600,
    }
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'Poppins, Arial, sans-serif', maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>🔑 Administration — Boutiques</h2>
        <button
          onClick={onDeconnexion}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: '1px solid #E6E0D6',
            background: 'white',
            cursor: 'pointer',
            fontFamily: 'Poppins, Arial, sans-serif',
          }}
        >
          Déconnexion
        </button>
      </div>

      {chargement ? (
        <p>Chargement...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {boutiques.length === 0 && <p>Aucune boutique enregistrée.</p>}
          {boutiques.map((b) => (
            <div
              key={b.id}
              style={{
                border: '1px solid #E6E0D6',
                borderRadius: '10px',
                padding: '16px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '10px',
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '16px' }}>{b.nom}</div>
                <div style={{ fontSize: '13px', color: '#6B6357' }}>
                  📞 {b.telephone || 'Non renseigné'}
                </div>
                {b.date_fin_essai && (
                  <div style={{ fontSize: '13px', color: '#6B6357' }}>
                    Essai jusqu'au {new Date(b.date_fin_essai).toLocaleDateString('fr-FR')}
                  </div>
                )}
                <div style={{ fontSize: '13px', color: paiementEnRetard(b) ? '#C62828' : '#6B6357', fontWeight: paiementEnRetard(b) ? 600 : 400 }}>
                  💰 Dernier paiement : {b.date_dernier_paiement ? new Date(b.date_dernier_paiement).toLocaleDateString('fr-FR') : 'Aucun'}
                  {paiementEnRetard(b) && ' ⚠️ En retard'}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <span style={stylePastille(b.statut)}>{b.statut}</span>

                <button
                  onClick={() => marquerPaiementRecu(b.id)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid #C9822A',
                    background: 'white',
                    color: '#C9822A',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  💰 Marquer paiement reçu
                </button>

                {b.statut === 'en_attente' && (
                  <button
                    onClick={() => validerBoutique(b.id)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: '#2E7D32',
                      color: 'white',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    ✅ Valider
                  </button>
                )}

                {b.statut === 'active' && (
                  <button
                    onClick={() => suspendreBoutique(b.id)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: '1px solid #C62828',
                      background: 'white',
                      color: '#C62828',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Suspendre
                  </button>
                )}

                {b.statut === 'suspendue' && (
                  <button
                    onClick={() => validerBoutique(b.id)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: '#2E7D32',
                      color: 'white',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Réactiver
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default AdminBoutiques