import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

function AdminBoutiques({ onDeconnexion }) {
  const [boutiques, setBoutiques] = useState([])
  const [chargement, setChargement] = useState(true)
  const [dureeParBoutique, setDureeParBoutique] = useState({})

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

  function dureeChoisie(id) {
    return dureeParBoutique[id] || 1
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
    const mois = dureeChoisie(id)
    const finAbonnement = new Date(maintenant)
    finAbonnement.setMonth(finAbonnement.getMonth() + mois)

    await supabase
      .from('boutiques')
      .update({
        date_dernier_paiement: maintenant.toISOString(),
        date_fin_abonnement: finAbonnement.toISOString(),
      })
      .eq('id', id)
    chargerBoutiques()
  }

  function dateFinCouverture(boutique) {
    if (boutique.date_fin_abonnement) return new Date(boutique.date_fin_abonnement)
    if (!boutique.date_dernier_paiement) return null
    const dernierPaiement = new Date(boutique.date_dernier_paiement)
    const fin = new Date(dernierPaiement)
    fin.setDate(fin.getDate() + 30)
    return fin
  }

  function paiementEnRetard(boutique) {
    const fin = dateFinCouverture(boutique)
    if (!fin) return false
    return fin < new Date()
  }

  function joursRestants(date) {
    if (!date) return null
    const diff = new Date(date) - new Date()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }

  // Retourne l'état d'échéance d'une boutique : 'expire' | 'relance' | null
  function etatEcheance(boutique) {
    if (boutique.date_fin_essai) {
      const j = joursRestants(boutique.date_fin_essai)
      if (j === null) return null
      if (j < 0) return 'expire'
      if (j <= 3) return 'relance'
      return null
    }
    if (boutique.date_dernier_paiement) {
      const j = joursRestants(dateFinCouverture(boutique))
      if (j === null) return null
      if (j < 0) return 'expire'
      if (j <= 3) return 'relance'
      return null
    }
    return null
  }

  function texteEcheance(boutique) {
    const etat = etatEcheance(boutique)
    if (!etat) return null

    const enEssai = !!boutique.date_fin_essai
    const j = enEssai
      ? joursRestants(boutique.date_fin_essai)
      : joursRestants(dateFinCouverture(boutique))

    if (etat === 'expire') {
      return enEssai
        ? `⚠️ Essai expiré depuis ${Math.abs(j)} jour(s)`
        : `⚠️ Abonnement en retard depuis ${Math.abs(j)} jour(s)`
    }
    const echeance = j === 0 ? "aujourd'hui" : `dans ${j} jour(s)`
    return enEssai
      ? `⚠️ Essai gratuit se termine ${echeance}`
      : `⚠️ Abonnement se termine ${echeance}`
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

  const styleCarteEcheance = (etat) => {
    if (etat === 'expire') return { backgroundColor: '#FCECEC', borderColor: '#C62828' }
    if (etat === 'relance') return { backgroundColor: '#FFF8EC', borderColor: '#E4A400' }
    return {}
  }

  const boutiquesASurveiller = boutiques.filter((b) => etatEcheance(b) !== null)

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

      {!chargement && boutiquesASurveiller.length > 0 && (
        <div
          style={{
            backgroundColor: '#FFF4E5',
            border: '1px solid #E4A400',
            color: '#7A4E00',
            borderRadius: '10px',
            padding: '12px 16px',
            marginBottom: '20px',
            fontSize: '14px',
            fontWeight: 600,
          }}
        >
          ⚠️ {boutiquesASurveiller.length} boutique(s) à surveiller (essai ou abonnement proche de l'échéance / en retard)
        </div>
      )}

      {chargement ? (
        <p>Chargement...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {boutiques.length === 0 && <p>Aucune boutique enregistrée.</p>}
          {boutiques.map((b) => {
            const etat = etatEcheance(b)
            const texte = texteEcheance(b)
            return (
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
                  ...styleCarteEcheance(etat),
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
                  {dateFinCouverture(b) && (
                    <div style={{ fontSize: '13px', color: paiementEnRetard(b) ? '#C62828' : '#6B6357', fontWeight: paiementEnRetard(b) ? 600 : 400 }}>
                      📅 Couvert jusqu'au : {dateFinCouverture(b).toLocaleDateString('fr-FR')}
                    </div>
                  )}
                  {texte && (
                    <div
                      style={{
                        fontSize: '13px',
                        fontWeight: 700,
                        marginTop: '4px',
                        color: etat === 'expire' ? '#C62828' : '#9A5B0A',
                      }}
                    >
                      {texte}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span style={stylePastille(b.statut)}>{b.statut}</span>

                  <select
                    value={dureeChoisie(b.id)}
                    onChange={(e) =>
                      setDureeParBoutique({ ...dureeParBoutique, [b.id]: Number(e.target.value) })
                    }
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: '1px solid #E6E0D6',
                      fontFamily: 'Poppins, Arial, sans-serif',
                    }}
                  >
                    <option value={1}>1 mois</option>
                    <option value={3}>3 mois</option>
                    <option value={6}>6 mois</option>
                    <option value={12}>12 mois</option>
                  </select>

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
                    💰 Marquer paiement reçu ({dureeChoisie(b.id)} mois)
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
            )
          })}
        </div>
      )}
    </div>
  )
}

export default AdminBoutiques