import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { pointageDuJour, enregistrerArrivee, envoyerWhatsAppPointage } from '../lib/pointage'
import '../App.css'

function Connexion({ onConnexionReussie }) {
  const [mode, setMode] = useState('choix') // 'choix' | 'boutique' | 'admin'
  const [pin, setPin] = useState('')
  const [erreur, setErreur] = useState('')
  const [chargement, setChargement] = useState(false)

  const [enAttentePointage, setEnAttentePointage] = useState(null) // { employeData, boutique }
  const [envoiPointage, setEnvoiPointage] = useState(false)

  const [modeRecup, setModeRecup] = useState(false)
  const [emailRecup, setEmailRecup] = useState('')
  const [erreurRecup, setErreurRecup] = useState('')
  const [messageRecup, setMessageRecup] = useState('')
  const [chargementRecup, setChargementRecup] = useState(false)

  function retourChoix() {
    setMode('choix')
    setPin('')
    setErreur('')
    setModeRecup(false)
  }

  function retourChoixDepuisRecup() {
    setModeRecup(false)
    setErreurRecup('')
    setMessageRecup('')
    setEmailRecup('')
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
  async function verifierJourTravail(employeData) {
    const joursSemaine = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
    const aujourdhuiNom = joursSemaine[new Date().getDay()]
    const aujourdhuiDate = new Date().toISOString().split('T')[0]

    const { data: exception } = await supabase
      .from('exceptions_planning')
      .select('travaille')
      .eq('employe_id', employeData.id)
      .eq('date', aujourdhuiDate)
      .maybeSingle()

    if (exception) {
      return exception.travaille
    }

    // Planning en cycle (roulement, ex : 3 jours travaillés / 3 jours de repos) — prioritaire sur les jours fixes
    if (employeData.cycle_jours_travail && employeData.cycle_jours_repos && employeData.cycle_date_debut) {
      const debut = new Date(employeData.cycle_date_debut + 'T00:00:00')
      const aujourdhui = new Date(aujourdhuiDate + 'T00:00:00')
      const joursEcoules = Math.floor((aujourdhui - debut) / (1000 * 60 * 60 * 24))
      const dureeCycle = Number(employeData.cycle_jours_travail) + Number(employeData.cycle_jours_repos)
      const position = ((joursEcoules % dureeCycle) + dureeCycle) % dureeCycle
      return position < Number(employeData.cycle_jours_travail)
    }

    if (!employeData.jours_travail || employeData.jours_travail.length === 0) {
      return true
    }

    return employeData.jours_travail.includes(aujourdhuiNom)
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
      .select('nom, statut, date_fin_essai, whatsapp_responsable')
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
    if (data.role !== 'proprietaire') {
      const estDeJour = await verifierJourTravail(data)
      if (!estDeJour) {
        setErreur("Vous n'êtes pas prévu(e) aujourd'hui. Contactez le gérant.")
        setPin('')
        return
      }

      // Employé (pas propriétaire) : on lui demande de confirmer son arrivée avant d'entrer dans l'appli,
      // sauf s'il a déjà pointé son arrivée plus tôt dans la journée.
      const pointageExistant = await pointageDuJour(data.id)
      if (!pointageExistant || !pointageExistant.heure_arrivee) {
        setEnAttentePointage({ employeData: data, boutique })
        return
      }
    }

    localStorage.setItem('employeConnecte', JSON.stringify(data))
    onConnexionReussie(data)
  }

  async function confirmerArrivee() {
    if (!enAttentePointage) return
    setEnvoiPointage(true)
    const { employeData, boutique } = enAttentePointage

    const { heure } = await enregistrerArrivee(employeData.id, employeData.boutique_id)
    const message = `🕐 *${employeData.nom}* est arrivé(e) à la boutique "${boutique.nom}" à ${heure}.`
    envoyerWhatsAppPointage(boutique.whatsapp_responsable, message)

    setEnvoiPointage(false)
    localStorage.setItem('employeConnecte', JSON.stringify(employeData))
    onConnexionReussie(employeData)
  }

  async function handleRecuperation(e) {
    e.preventDefault()
    setErreurRecup('')
    setMessageRecup('')
    setChargementRecup(true)

    const email = emailRecup.trim()
    if (!email) {
      setErreurRecup('Veuillez renseigner votre e-mail.')
      setChargementRecup(false)
      return
    }

    const { data: employeTrouve } = await supabase
      .from('employes')
      .select('nom, pin, email')
      .eq('email', email)
      .maybeSingle()

    if (!employeTrouve) {
      setErreurRecup('Aucun compte trouvé avec cet e-mail.')
      setChargementRecup(false)
      return
    }

    const { error } = await supabase.functions.invoke('envoyer-email', {
      body: {
        to: employeTrouve.email,
        subject: 'Stockia — Votre code PIN',
        html: `<p>Bonjour ${employeTrouve.nom},</p><p>Votre code PIN de connexion Stockia est :</p><h2 style="letter-spacing:4px;">${employeTrouve.pin}</h2><p>Ne le partagez avec personne.</p>`,
      },
    })

    setChargementRecup(false)
    if (error) {
      setErreurRecup("Erreur lors de l'envoi de l'e-mail. Réessayez plus tard.")
      return
    }
    setMessageRecup('Un e-mail contenant votre code PIN vient de vous être envoyé.')
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

  if (enAttentePointage) {
    return (
      <div style={styleConteneur}>
        <h1>GESTION BOUTIQUE</h1>
        <p style={{ fontSize: '1.1rem' }}>Bonjour {enAttentePointage.employeData.nom} 👋</p>
        <p style={{ fontSize: '14px', color: '#6B6357', maxWidth: '320px', textAlign: 'center', marginBottom: '1.5rem' }}>
          Confirmez votre arrivée à la boutique pour continuer. Un message sera envoyé au responsable par WhatsApp.
        </p>
        <button
          onClick={confirmerArrivee}
          disabled={envoiPointage}
          style={{ ...styleBoutonChoix, backgroundColor: '#C9822A', color: 'white', width: '280px' }}
        >
          {envoiPointage ? 'Enregistrement...' : '✅ Je suis arrivé(e)'}
        </button>
      </div>
    )
  }

  const estAdmin = mode === 'admin'

  if (modeRecup) {
    return (
      <div style={styleConteneur}>
        <h1>GESTION BOUTIQUE</h1>
        <p>Récupération du code PIN</p>
        <p style={{ fontSize: '14px', color: '#6B6357', maxWidth: '320px', textAlign: 'center' }}>
          Renseignez l'e-mail enregistré sur votre compte pour recevoir votre code PIN.
        </p>
        <form onSubmit={handleRecuperation} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <input
            type="email"
            value={emailRecup}
            onChange={(e) => setEmailRecup(e.target.value)}
            placeholder="vous@exemple.com"
            style={{ padding: '10px', width: '260px', marginBottom: '1rem', textAlign: 'center' }}
            autoFocus
          />
          <button type="submit" disabled={chargementRecup} style={{ fontSize: '1.1rem', padding: '0.5rem 2rem' }}>
            {chargementRecup ? 'Envoi...' : 'Recevoir mon code PIN'}
          </button>
        </form>

        {erreurRecup && <p style={{ color: 'red' }}>{erreurRecup}</p>}
        {messageRecup && <div className="connexion-message-recup">{messageRecup}</div>}

        <button onClick={retourChoixDepuisRecup} className="connexion-lien-secondaire">
          ← Retour à la connexion
        </button>
      </div>
    )
  }

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
        <button type="submit" disabled={chargement} style={{ fontSize: '1.2rem', padding: '0.5rem 2rem' }}>
          {chargement ? 'Connexion...' : 'Se connecter'}
        </button>
      </form>

      {!estAdmin && (
        <button onClick={() => setModeRecup(true)} className="connexion-lien-secondaire-accent">
          Code PIN oublié ?
        </button>
      )}

      {erreur && (
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: 'red' }}>{erreur}</p>
          {erreur.includes('essai') && (
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '8px' }}>
              <a href="https://wa.me/22655006657" target="_blank" rel="noopener noreferrer" className="connexion-lien-whatsapp">
                WhatsApp
              </a>

              <a href="tel:+22663732443" className="connexion-lien-appeler">
                Appeler
              </a>
            </div>
          )}
        </div>
      )}

      <button onClick={retourChoix} className="connexion-lien-secondaire">
        Retour
      </button>
    </div>
  )
}

export default Connexion