import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

function Connexion({ onConnexionReussie }) {
  const [pin, setPin] = useState('')
  const [erreur, setErreur] = useState('')
  const [chargement, setChargement] = useState(false)

  async function handleConnexion(e) {
    e.preventDefault()
    setErreur('')
    setChargement(true)

    const { data, error } = await supabase
      .from('employes')
      .select('*')
      .eq('pin', pin)
      .single()

    setChargement(false)

    if (error || !data) {
      setErreur('Code PIN incorrect')
      setPin('')
      return
    }

    localStorage.setItem('employeConnecte', JSON.stringify(data))
    onConnexionReussie(data)
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      backgroundColor: '#f5f5f5'
    }}>
      <h1>GESTION BOUTIQUE</h1>
      <p>Entrez votre code PIN pour continuer</p>
      <form onSubmit={handleConnexion}>
        <input
          type="password"
          inputMode="numeric"
          maxLength="4"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="****"
          style={{
            fontSize: '2rem',
            textAlign: 'center',
            letterSpacing: '1rem',
            width: '200px',
            padding: '0.5rem',
            marginBottom: '1rem'
          }}
          autoFocus
        />
        <br />
        <button type="submit" disabled={chargement} style={{
          fontSize: '1.2rem',
          padding: '0.5rem 2rem'
        }}>
          {chargement ? 'Connexion...' : 'Se connecter'}
        </button>
      </form>
      {erreur && <p style={{ color: 'red' }}>{erreur}</p>}
    </div>
  )
}

export default Connexion