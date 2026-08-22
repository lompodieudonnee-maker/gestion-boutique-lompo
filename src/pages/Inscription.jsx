import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

function Inscription() {
  const [nomBoutique, setNomBoutique] = useState('')
  const [nomProprietaire, setNomProprietaire] = useState('')
  const [telephone, setTelephone] = useState('')
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [erreur, setErreur] = useState('')
  const [chargement, setChargement] = useState(false)
  const [succes, setSucces] = useState(false)

  async function handleInscription(e) {
    e.preventDefault()
    setErreur('')

    if (!nomBoutique || !nomProprietaire || !telephone || !pin) {
      setErreur('Veuillez remplir tous les champs')
      return
    }
    if (pin.length !== 4) {
      setErreur('Le code PIN doit contenir exactement 4 chiffres')
      return
    }
    if (pin !== confirmPin) {
      setErreur('Les deux codes PIN ne correspondent pas')
      return
    }

    setChargement(true)

    // Vérifier que le PIN n'est pas déjà utilisé
    const { data: pinExistant } = await supabase
      .from('employes')
      .select('id')
      .eq('pin', pin)
      .maybeSingle()

    if (pinExistant) {
      setErreur('Ce code PIN est déjà utilisé, choisissez-en un autre')
      setChargement(false)
      return
    }

    // Créer la boutique
    const { data: nouvelleBoutique, error: erreurBoutique } = await supabase
      .from('boutiques')
      .insert([{ nom: nomBoutique, telephone: telephone, statut: 'en_attente' }])
      .select()
      .single()

    if (erreurBoutique || !nouvelleBoutique) {
      setErreur("Erreur lors de la création de la boutique. Réessayez.")
      setChargement(false)
      return
    }

    // Créer le compte propriétaire
    const { error: erreurEmploye } = await supabase.from('employes').insert([
      {
        nom: nomProprietaire,
        pin: pin,
        boutique_id: nouvelleBoutique.id,
        role: 'proprietaire',
        voir_finances: true,
        peut_gerer_fournisseurs: true,
      },
    ])

    setChargement(false)

    if (erreurEmploye) {
      setErreur("Erreur lors de la création du compte. Réessayez.")
      return
    }

    setSucces(true)
  }

  const styleChamp = {
    width: '100%',
    padding: '0.7rem',
    marginBottom: '1rem',
    borderRadius: '8px',
    border: '1px solid #E6E0D6',
    fontSize: '1rem',
    fontFamily: 'Poppins, Arial, sans-serif',
    boxSizing: 'border-box',
  }

  if (succes) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          backgroundColor: '#f5f5f5',
          fontFamily: 'Poppins, Arial, sans-serif',
          padding: '20px',
          textAlign: 'center',
        }}
      >
        <h1>✅ Inscription reçue !</h1>
        <p style={{ maxWidth: '400px', color: '#6B6357' }}>
          Votre compte pour la boutique « {nomBoutique} » a bien été créé et est en attente de
          validation. Nous vous contacterons bientôt au {telephone} pour activer votre accès.
        </p>
        <a href="/" style={{ color: '#C9822A', fontWeight: 600, marginTop: '1rem' }}>
          Retour à la connexion
        </a>
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#f5f5f5',
        fontFamily: 'Poppins, Arial, sans-serif',
        padding: '20px',
      }}
    >
      <h1>Créer votre compte Stockia </h1>
      <p style={{ color: '#6B6357', marginBottom: '1.5rem' }}>
        Inscrivez votre boutique en quelques instants
      </p>
      <form onSubmit={handleInscription} style={{ width: '100%', maxWidth: '360px' }}>
        <label style={{ fontSize: '13px', color: '#6B6357' }}>Nom de la boutique</label>
        <input
          type="text"
          value={nomBoutique}
          onChange={(e) => setNomBoutique(e.target.value)}
          style={styleChamp}
          placeholder="Ex : Boutique Wend-Panga"
        />

        <label style={{ fontSize: '13px', color: '#6B6357' }}>Votre nom</label>
        <input
          type="text"
          value={nomProprietaire}
          onChange={(e) => setNomProprietaire(e.target.value)}
          style={styleChamp}
          placeholder="Ex : Aïcha Ouédraogo"
        />

        <label style={{ fontSize: '13px', color: '#6B6357' }}>Téléphone</label>
        <input
          type="tel"
          value={telephone}
          onChange={(e) => setTelephone(e.target.value)}
          style={styleChamp}
          placeholder="Ex : 70 00 00 00"
        />

        <label style={{ fontSize: '13px', color: '#6B6357' }}>Choisissez un code PIN (4 chiffres)</label>
        <input
          type="password"
          inputMode="numeric"
          maxLength="4"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          style={styleChamp}
          placeholder="****"
        />

        <label style={{ fontSize: '13px', color: '#6B6357' }}>Confirmez le code PIN</label>
        <input
          type="password"
          inputMode="numeric"
          maxLength="4"
          value={confirmPin}
          onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
          style={styleChamp}
          placeholder="****"
        />

        {erreur && <p style={{ color: 'red', fontSize: '14px' }}>{erreur}</p>}

        <button
          type="submit"
          disabled={chargement}
          style={{
            width: '100%',
            padding: '0.8rem',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: '#C9822A',
            color: 'white',
            fontWeight: 600,
            fontSize: '1rem',
            cursor: 'pointer',
            marginTop: '0.5rem',
          }}
        >
          {chargement ? 'Création...' : "S'inscrire"}
        </button>
      </form>

      <a href="/" style={{ color: '#6B6357', marginTop: '1.5rem', fontSize: '14px' }}>
        Déjà un compte ? Se connecter
      </a>
    </div>
  )
}

export default Inscription