import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

function Connexion({ onConnexionReussie }) {
  const [mode, setMode] = useState('choix') // 'choix' | 'boutique' | 'admin'
  const [pin, setPin] = useState('')
  const [erreur, setErreur] = useState('')
  const [chargement, setChargement] = useState(false)

  function retourChoix() {
    setMode('choix')
    setPin('')
    setErreur('')
  }

  async function handleConnexionAdmin(e) {
    e.preventDefault()
    setErreur('')
    setChargement(true)

    if (pin === '199088') {
      setChargement(false)
      const admin = { role: 'superadmin', nom: 'Admin' }
      localStorage.setItem('employeConnecte', JSON.stringify(admin))
      onConnexionReussie(admin)
      return
    }

    setChargement(false)
    setErreur('Code PIN admin incorrect')
    setPin('')
  }

  async function handleConnexionBoutique(e) {
    e.preventDefault()
    setErreur('')
    setChargement(true)

    const { data, error } = await supabase
      .from('employes')
      .select('*')
      .eq('pin', pin)
      .single()

    if (error || !data) {
      setChargement(false)
      setErreur('Code PIN incorrect')
      setPin('')
      return
    }

    const { data: boutique } = await supabase
      .from('boutiques')
      .select('statut, date_fin_essai')
      .eq('id', data.boutique_id)
      .single()

    setChargement(false)

    if (!boutique || boutique.statut === 'en_attente') {
      setErreur('Compte en attente de validation')
      setPin('')
      return
    }

    if (boutique.statut === 'active' && boutique.date_fin_essai && new Date(boutique.date_fin_essai) < new Date()) {
      setErreur("Votre période d'essai est terminée. Contactez-nous.")
      setPin('')
      return
    }

    localStorage.setItem('employeConnecte', JSON.stringify(data))
    onConnexionReussie(data)
  }

  const styleConteneur = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    backgroundColor: '#f5f5f5',
    padding: '20px',
  }

  const styleBoutonChoix = {
    fontSize: '1.1rem',
    padding: '16px 32px',
    margin: '10px',
    borderRadius: '10px',
    border: 'none',
    cursor: 'pointer',
    fontWeight: 600,
    width: '260px',
  }

  if (mode === 'choix') {
    return (
      <div style={styleConteneur}>
        <h1>GESTION BOUTIQUE</h1>
        <p>Choisissez votre type de connexion</p>

        <button
          onClick={() => setMode('boutique')}
          style={{ ...styleBoutonChoix, backgroundColor: '#C9822A', color: 'white' }}
        >
          Connexion Boutique
        </button>

        <button
          onClick={() => setMode('admin')}
          style={{ ...styleBoutonChoix, backgroundColor: '#2B2620', color: 'white' }}
        >
          Connexion Admin
        </button>

        <a href="/inscription" style={{ color: '#6B6357', marginTop: '1.5rem', fontSize: '14px' }}>
          Pas encore de compte ? Créer un compte
        </a>
      </div>
    )
  }

  const estAdmin = mode === 'admin'

  return (
    <div style={styleConteneur}>
      <h1>GESTION BOUTIQUE</h1>
      <p>{estAdmin ? 'Connexion Admin (PIN à 6 chiffres)' : 'Connexion Boutique (PIN à 4 chiffres)'}</p>
      <form onSubmit={estAdmin ? handleConnexionAdmin : handleConnexionBoutique}>
        <input
          type="password"
          inputMode="numeric"
          maxLength={estAdmin ? '6' : '4'}
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="****"
          style={{
            fontSize: '2rem',
            textAlign: 'center',
            letterSpacing: '1rem',
            width: '200px',
            padding: '0.5rem',
            marginBottom: '1rem',
          }}
          autoFocus
        />
        <br />
        <button
          type="submit"
          disabled={chargement}
          style={{
            fontSize: '1.2rem',
            padding: '0.5rem 2rem',
          }}
        >
          {chargement ? 'Connexion...' : 'Se connecter'}
        </button>
      </form>

      {erreur && (
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: 'red' }}>{erreur}</p>
          {erreur.includes('essai') && (
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '8px' }}>
              <a
                href="https://wa.me/22655006657"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  backgroundColor: '#25D366',
                  color: 'white',
                  textDecoration: 'none',
                  fontSize: '14px',
                  fontWeight: 600,
                }}
              >
                WhatsApp
              </a>

              <a
                href="tel:+22663732443"
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid #E6E0D6',
                  color: '#2B2620',
                  textDecoration: 'none',
                  fontSize: '14px',
                  fontWeight: 600,
                }}
              >
                Appeler
              </a>
            </div>
          )}
        </div>
      )}

      <button
        onClick={retourChoix}
        style={{
          marginTop: '1.5rem',
          background: 'none',
          border: 'none',
          color: '#6B6357',
          fontSize: '14px',
          cursor: 'pointer',
          textDecoration: 'underline',
        }}
      >
        Retour
      </button>
    </div>
  )
}

export default Connexion