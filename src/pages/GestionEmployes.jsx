import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getBoutiqueId } from '../lib/boutique'

const PERMISSIONS = [
  { cle: 'voir_finances', label: 'Voir les finances (bénéfices, dettes)' },
  { cle: 'peut_gerer_fournisseurs', label: 'Gérer les fournisseurs' },
  { cle: 'peut_gerer_stock', label: 'Gérer le Stock' },
]

const JOURS_SEMAINE = [
  { cle: 'lundi', label: 'Lun' },
  { cle: 'mardi', label: 'Mar' },
  { cle: 'mercredi', label: 'Mer' },
  { cle: 'jeudi', label: 'Jeu' },
  { cle: 'vendredi', label: 'Ven' },
  { cle: 'samedi', label: 'Sam' },
  { cle: 'dimanche', label: 'Dim' },
]

function GestionEmployes() {
  const [employes, setEmployes] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState('')

  const [nom, setNom] = useState('')
  const [pin, setPin] = useState('')
  const [role, setRole] = useState('employe')

  const [planningOuvertId, setPlanningOuvertId] = useState(null)
  const [exceptions, setExceptions] = useState([])
  const [nouvelleExceptionDate, setNouvelleExceptionDate] = useState('')
  const [nouvelleExceptionTravaille, setNouvelleExceptionTravaille] = useState('non')

  const [cycleTravail, setCycleTravail] = useState('')
  const [cycleRepos, setCycleRepos] = useState('')
  const [cycleDateDebut, setCycleDateDebut] = useState('')
  const [envoiCycle, setEnvoiCycle] = useState(false)

  const [salaireOuvertId, setSalaireOuvertId] = useState(null)
  const [salaires, setSalaires] = useState([])
  const [nouveauSalaireMontant, setNouveauSalaireMontant] = useState('')
  const [nouveauSalaireDate, setNouveauSalaireDate] = useState('')
  const [nouveauSalairePeriode, setNouveauSalairePeriode] = useState('')
  const [envoiSalaire, setEnvoiSalaire] = useState(false)

  const [emailInputs, setEmailInputs] = useState({})
  const [enregistrementEmailId, setEnregistrementEmailId] = useState(null)

  const employeConnecte = JSON.parse(localStorage.getItem('employeConnecte'))
  const estSuperadmin = employeConnecte?.role === 'superadmin'

  const [boutiques, setBoutiques] = useState([])
  const [boutiqueSelectionnee, setBoutiqueSelectionnee] = useState('')

  const boutiqueId = estSuperadmin ? boutiqueSelectionnee : getBoutiqueId()

  useEffect(() => {
    if (estSuperadmin) {
      chargerBoutiques()
    } else {
      chargerEmployes()
    }
  }, [])

  useEffect(() => {
    if (estSuperadmin && boutiqueSelectionnee) {
      chargerEmployes()
    }
  }, [boutiqueSelectionnee])

  async function chargerBoutiques() {
    const { data } = await supabase
      .from('boutiques')
      .select('id, nom')
      .order('nom', { ascending: true })
    setBoutiques(data || [])
    setChargement(false)
  }

  async function chargerEmployes() {
    if (!boutiqueId) return
    setChargement(true)
    const { data, error } = await supabase
      .from('employes')
      .select('*')
      .eq('boutique_id', boutiqueId)
      .order('created_at', { ascending: true })

    if (error) {
      setErreur("Erreur lors du chargement des employés")
    } else {
      setEmployes(data)
    }
    setChargement(false)
  }

  async function handleAjouterEmploye(e) {
    e.preventDefault()
    setErreur('')

    if (!boutiqueId) {
      setErreur('Choisissez une boutique')
      return
    }

    if (pin.length !== 4) {
      setErreur('Le code PIN doit contenir 4 chiffres')
      return
    }

    const { error } = await supabase
      .from('employes')
      .insert({
        nom,
        pin,
        role,
        boutique_id: boutiqueId,
        voir_finances: false,
        peut_gerer_fournisseurs: false,
      })

    if (error) {
      setErreur("Erreur lors de l'ajout de l'employé (le PIN est peut-être déjà utilisé)")
      return
    }

    setNom('')
    setPin('')
    setRole('employe')
    chargerEmployes()
  }

  async function handleTogglePermission(employe, cle) {
    const { error } = await supabase
      .from('employes')
      .update({ [cle]: !employe[cle] })
      .eq('id', employe.id)

    if (error) {
      setErreur('Erreur lors de la mise à jour des permissions')
      return
    }
    chargerEmployes()
  }

  async function handleSupprimer(id) {
    if (!confirm('Supprimer cet employé ?')) return

    const { error } = await supabase
      .from('employes')
      .delete()
      .eq('id', id)

    if (error) {
      setErreur("Erreur lors de la suppression (cet employé a peut-être des ventes liées)")
      return
    }
    chargerEmployes()
  }

  // ============================================================
  // E-MAIL (récupération PIN)
  // ============================================================

  function emailValeur(employe) {
    return emailInputs[employe.id] !== undefined ? emailInputs[employe.id] : (employe.email || '')
  }

  async function enregistrerEmail(id) {
    const email = (emailInputs[id] || '').trim()
    setEnregistrementEmailId(id)
    const { error } = await supabase.from('employes').update({ email }).eq('id', id)
    setEnregistrementEmailId(null)

    if (error) {
      setErreur("Erreur lors de l'enregistrement de l'e-mail")
      return
    }
    chargerEmployes()
  }

  // ============================================================
  // PLANNING
  // ============================================================

  async function ouvrirPlanning(employe) {
    if (planningOuvertId === employe.id) {
      setPlanningOuvertId(null)
      return
    }
    setSalaireOuvertId(null)
    setPlanningOuvertId(employe.id)
    setCycleTravail(employe.cycle_jours_travail || '')
    setCycleRepos(employe.cycle_jours_repos || '')
    setCycleDateDebut(employe.cycle_date_debut || '')
    await chargerExceptions(employe.id)
  }

  function statutCycleAujourdhui(employe) {
    if (!employe.cycle_jours_travail || !employe.cycle_jours_repos || !employe.cycle_date_debut) return null
    const debut = new Date(employe.cycle_date_debut + 'T00:00:00')
    const aujourdhui = new Date()
    aujourdhui.setHours(0, 0, 0, 0)
    const joursEcoules = Math.floor((aujourdhui - debut) / (1000 * 60 * 60 * 24))
    const dureeCycle = Number(employe.cycle_jours_travail) + Number(employe.cycle_jours_repos)
    const position = ((joursEcoules % dureeCycle) + dureeCycle) % dureeCycle
    return position < Number(employe.cycle_jours_travail)
  }

  async function enregistrerCycle(employe) {
    const jt = parseInt(cycleTravail, 10)
    const jr = parseInt(cycleRepos, 10)
    if (!jt || jt <= 0 || !jr || jr <= 0 || !cycleDateDebut) {
      alert('Renseignez le nombre de jours travaillés, le nombre de jours de repos, et la date du 1er jour travaillé du cycle.')
      return
    }
    setEnvoiCycle(true)
    const { error } = await supabase
      .from('employes')
      .update({
        cycle_jours_travail: jt,
        cycle_jours_repos: jr,
        cycle_date_debut: cycleDateDebut,
      })
      .eq('id', employe.id)
    setEnvoiCycle(false)
    if (error) {
      alert('Erreur : ' + error.message)
      return
    }
    chargerEmployes()
    alert('Planning en cycle enregistré.')
  }

  async function reinitialiserCycle(employe) {
    if (!confirm('Retirer le planning en cycle de cet employé ?')) return
    const { error } = await supabase
      .from('employes')
      .update({ cycle_jours_travail: null, cycle_jours_repos: null, cycle_date_debut: null })
      .eq('id', employe.id)
    if (error) {
      alert('Erreur : ' + error.message)
      return
    }
    setCycleTravail('')
    setCycleRepos('')
    setCycleDateDebut('')
    chargerEmployes()
  }

  async function chargerExceptions(employeId) {
    const { data } = await supabase
      .from('exceptions_planning')
      .select('*')
      .eq('employe_id', employeId)
      .order('date', { ascending: true })
    setExceptions(data || [])
  }

  async function toggleJourTravail(employe, jourCle) {
    const joursActuels = employe.jours_travail || []
    const nouveauxJours = joursActuels.includes(jourCle)
      ? joursActuels.filter((j) => j !== jourCle)
      : [...joursActuels, jourCle]

    setEmployes((prev) =>
      prev.map((e) => (e.id === employe.id ? { ...e, jours_travail: nouveauxJours } : e))
    )

    const { error } = await supabase
      .from('employes')
      .update({ jours_travail: nouveauxJours })
      .eq('id', employe.id)

    if (error) {
      setErreur('Erreur lors de la mise à jour du planning')
      chargerEmployes()
    }
  }

  async function reinitialiserPlanning(employe) {
    if (!confirm("Réinitialiser le planning fixe de cet employé (il pourra travailler tous les jours) ?")) return
    const { error } = await supabase
      .from('employes')
      .update({ jours_travail: null })
      .eq('id', employe.id)

    if (error) {
      setErreur('Erreur lors de la réinitialisation du planning')
      return
    }
    chargerEmployes()
  }

  async function ajouterException(employeId) {
    if (!nouvelleExceptionDate) {
      alert('Choisissez une date')
      return
    }

    const { error } = await supabase.from('exceptions_planning').insert({
      employe_id: employeId,
      date: nouvelleExceptionDate,
      travaille: nouvelleExceptionTravaille === 'oui',
      boutique_id: boutiqueId,
    })

    if (error) {
      alert('Erreur : ' + error.message)
      return
    }

    setNouvelleExceptionDate('')
    setNouvelleExceptionTravaille('non')
    chargerExceptions(employeId)
  }

  async function supprimerException(id, employeId) {
    await supabase.from('exceptions_planning').delete().eq('id', id)
    chargerExceptions(employeId)
  }

  // ============================================================
  // SALAIRES
  // ============================================================

  async function ouvrirSalaire(employe) {
    if (salaireOuvertId === employe.id) {
      setSalaireOuvertId(null)
      return
    }
    setPlanningOuvertId(null)
    setSalaireOuvertId(employe.id)
    await chargerSalaires(employe.id)
  }

  async function chargerSalaires(employeId) {
    const { data } = await supabase
      .from('salaires')
      .select('*')
      .eq('employe_id', employeId)
      .order('date_paiement', { ascending: false })
    setSalaires(data || [])
  }

  async function enregistrerSalaire(employe) {
    const montant = parseInt(nouveauSalaireMontant, 10)
    if (!montant || montant <= 0) {
      alert('Entrez un montant valide')
      return
    }
    if (!nouveauSalaireDate) {
      alert('Choisissez une date de paiement')
      return
    }

    setEnvoiSalaire(true)

    const { error: erreurSalaire } = await supabase.from('salaires').insert({
      employe_id: employe.id,
      montant,
      date_paiement: nouveauSalaireDate,
      periode: nouveauSalairePeriode || null,
      boutique_id: boutiqueId,
    })

    if (erreurSalaire) {
      setEnvoiSalaire(false)
      alert('Erreur : ' + erreurSalaire.message)
      return
    }

    // Enregistre aussi comme dépense pour impacter le calcul du bénéfice
    await supabase.from('depenses').insert({
      categorie: 'Salaire',
      description: `Salaire ${employe.nom}${nouveauSalairePeriode ? ' - ' + nouveauSalairePeriode : ''}`,
      montant,
      boutique_id: boutiqueId,
    })

    setEnvoiSalaire(false)
    setNouveauSalaireMontant('')
    setNouveauSalaireDate('')
    setNouveauSalairePeriode('')
    chargerSalaires(employe.id)
    alert('Paiement de salaire enregistré.')
  }

  async function supprimerSalaire(id, employeId) {
    if (!confirm("Supprimer ce paiement de salaire ? (Il restera cependant dans l'historique des Dépenses, à supprimer séparément si besoin)")) return
    await supabase.from('salaires').delete().eq('id', id)
    chargerSalaires(employeId)
  }

  if (chargement) return <p style={{ padding: '20px' }}>Chargement...</p>

  return (
    <div style={{ padding: '20px' }}>
      <h2>🔑 Gestion des employés</h2>

      {erreur && <p style={{ color: 'red' }}>{erreur}</p>}

      {estSuperadmin && (
        <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#EDF1F5', borderRadius: '8px' }}>
          <label style={{ display: 'block', fontSize: '13px', color: '#37474F', marginBottom: '6px', fontWeight: 600 }}>
            🏪 Choisir une boutique à gérer
          </label>
          <select
            value={boutiqueSelectionnee}
            onChange={(e) => setBoutiqueSelectionnee(e.target.value)}
            style={{ padding: '8px 12px', minWidth: '250px' }}
          >
            <option value="">-- Sélectionner une boutique --</option>
            {boutiques.map((b) => (
              <option key={b.id} value={b.id}>{b.nom}</option>
            ))}
          </select>
        </div>
      )}

      {estSuperadmin && !boutiqueSelectionnee ? (
        <p style={{ color: '#6B6357' }}>Choisissez une boutique ci-dessus pour voir et gérer ses employés.</p>
      ) : (
        <>
          <form onSubmit={handleAjouterEmploye} style={{ marginBottom: '30px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
            <h3>Ajouter un employé</h3>
            <input
              type="text"
              placeholder="Nom"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              required
              style={{ marginRight: '10px', padding: '8px' }}
            />
            <input
              type="password"
              inputMode="numeric"
              maxLength="4"
              placeholder="Code PIN (4 chiffres)"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              required
              style={{ marginRight: '10px', padding: '8px', width: '150px' }}
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              style={{ marginRight: '10px', padding: '8px' }}
            >
              <option value="employe">Employé</option>
              <option value="proprietaire">Propriétaire</option>
            </select>
            <button type="submit" style={{ padding: '8px 16px' }}>Ajouter</button>
          </form>

          <h3>Liste des employés</h3>
          <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#333', color: 'white' }}>
                <th style={{ padding: '10px', textAlign: 'left' }}>Nom</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Rôle</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>E-mail (récupération PIN)</th>
                {PERMISSIONS.map((p) => (
                  <th key={p.cle} style={{ padding: '10px', textAlign: 'center' }}>{p.label}</th>
                ))}
                <th style={{ padding: '10px', textAlign: 'center' }}>Planning</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>Salaire</th>
                <th style={{ padding: '10px' }}></th>
              </tr>
            </thead>
            <tbody>
              {employes.map((employe) => (
                <>
                  <tr key={employe.id} style={{ borderBottom: '1px solid #ddd' }}>
                    <td style={{ padding: '10px' }}>{employe.nom}</td>
                    <td style={{ padding: '10px' }}>{employe.role}</td>
                    <td style={{ padding: '10px' }}>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <input
                          type="email"
                          value={emailValeur(employe)}
                          onChange={(e) => setEmailInputs({ ...emailInputs, [employe.id]: e.target.value })}
                          placeholder="email@exemple.com"
                          style={{ padding: '6px', width: '170px' }}
                        />
                        <button
                          onClick={() => enregistrerEmail(employe.id)}
                          disabled={enregistrementEmailId === employe.id}
                          style={{ padding: '5px 10px', fontSize: '12px', cursor: 'pointer' }}
                        >
                          {enregistrementEmailId === employe.id ? '...' : 'Enregistrer'}
                        </button>
                      </div>
                    </td>
                    {PERMISSIONS.map((p) => (
                      <td key={p.cle} style={{ padding: '10px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={employe.role === 'proprietaire' ? true : !!employe[p.cle]}
                          disabled={employe.role === 'proprietaire'}
                          onChange={() => handleTogglePermission(employe, p.cle)}
                        />
                      </td>
                    ))}
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      {employe.role !== 'proprietaire' && (
                        <button onClick={() => ouvrirPlanning(employe)} style={{ padding: '5px 10px', cursor: 'pointer' }}>
                          {planningOuvertId === employe.id ? 'Fermer' : 'Gérer'}
                        </button>
                      )}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      <button onClick={() => ouvrirSalaire(employe)} style={{ padding: '5px 10px', cursor: 'pointer' }}>
                        {salaireOuvertId === employe.id ? 'Fermer' : 'Gérer'}
                      </button>
                    </td>
                    <td style={{ padding: '10px' }}>
                      {employe.role !== 'proprietaire' && (
                        <button onClick={() => handleSupprimer(employe.id)} style={{ color: 'red', border: 'none', background: 'none', cursor: 'pointer' }}>
                          Supprimer
                        </button>
                      )}
                    </td>
                  </tr>

                  {planningOuvertId === employe.id && (
                    <tr>
                      <td colSpan={PERMISSIONS.length + 6} style={{ padding: '15px', backgroundColor: '#faf8f5', border: '1px solid #E6E0D6' }}>
                        <strong>Planning fixe de {employe.nom}</strong>
                        <p style={{ fontSize: '13px', color: '#6B6357', margin: '4px 0 10px' }}>
                          Cochez les jours où {employe.nom} travaille. Si aucun jour n'est coché, il n'y a aucune restriction (il peut se connecter tous les jours).
                        </p>
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
                          {JOURS_SEMAINE.map((jour) => (
                            <label key={jour.cle} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <input
                                type="checkbox"
                                checked={(employe.jours_travail || []).includes(jour.cle)}
                                onChange={() => toggleJourTravail(employe, jour.cle)}
                              />
                              {jour.label}
                            </label>
                          ))}
                        </div>
                        <button
                          onClick={() => reinitialiserPlanning(employe)}
                          style={{ fontSize: '13px', color: '#6B6357', background: 'none', border: '1px solid #E6E0D6', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', marginBottom: '15px' }}
                        >
                          Réinitialiser (aucune restriction)
                        </button>

                        <hr style={{ border: 'none', borderTop: '1px solid #E6E0D6', margin: '10px 0' }} />

                        <strong>Planning en cycle (roulement, ex : 3 jours travaillés / 3 jours de repos)</strong>
                        <p style={{ fontSize: '13px', color: '#6B6357', margin: '4px 0 10px' }}>
                          Pratique pour une relève régulière entre employés. Si un cycle est défini ici, il prend le dessus sur les jours fixes ci-dessus.
                        </p>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '10px' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '12px', color: '#6B6357', marginBottom: '4px' }}>Jours travaillés</label>
                            <input
                              type="number"
                              min="1"
                              value={cycleTravail}
                              onChange={(e) => setCycleTravail(e.target.value)}
                              style={{ width: '80px', padding: '6px' }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '12px', color: '#6B6357', marginBottom: '4px' }}>Jours de repos</label>
                            <input
                              type="number"
                              min="1"
                              value={cycleRepos}
                              onChange={(e) => setCycleRepos(e.target.value)}
                              style={{ width: '80px', padding: '6px' }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '12px', color: '#6B6357', marginBottom: '4px' }}>1er jour travaillé du cycle</label>
                            <input
                              type="date"
                              value={cycleDateDebut}
                              onChange={(e) => setCycleDateDebut(e.target.value)}
                              style={{ padding: '6px' }}
                            />
                          </div>
                          <button onClick={() => enregistrerCycle(employe)} disabled={envoiCycle} style={{ padding: '7px 14px', cursor: 'pointer' }}>
                            {envoiCycle ? 'Enregistrement...' : 'Enregistrer le cycle'}
                          </button>
                        </div>

                        {employe.cycle_jours_travail && employe.cycle_jours_repos && employe.cycle_date_debut && (
                          <p style={{ fontSize: '13px', marginBottom: '15px' }}>
                            Cycle actif : {employe.cycle_jours_travail}j travail / {employe.cycle_jours_repos}j repos, à partir du {new Date(employe.cycle_date_debut).toLocaleDateString('fr-FR')}.{' '}
                            <strong style={{ color: statutCycleAujourdhui(employe) ? '#2E7D32' : '#B71C1C' }}>
                              Aujourd'hui : {statutCycleAujourdhui(employe) ? 'Travaille ✅' : 'Repos ❌'}
                            </strong>{' '}
                            <button
                              onClick={() => reinitialiserCycle(employe)}
                              style={{ fontSize: '12px', color: '#6B6357', background: 'none', border: '1px solid #E6E0D6', borderRadius: '6px', padding: '3px 8px', cursor: 'pointer', marginLeft: '8px' }}
                            >
                              Retirer le cycle
                            </button>
                          </p>
                        )}

                        <hr style={{ border: 'none', borderTop: '1px solid #E6E0D6', margin: '10px 0' }} />

                        <strong>Exceptions ponctuelles</strong>
                        <p style={{ fontSize: '13px', color: '#6B6357', margin: '4px 0 10px' }}>
                          Pour un cas particulier à une date précise (ex: il travaille exceptionnellement un jour normalement off, ou l'inverse).
                        </p>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '10px' }}>
                          <input
                            type="date"
                            value={nouvelleExceptionDate}
                            onChange={(e) => setNouvelleExceptionDate(e.target.value)}
                            style={{ padding: '6px' }}
                          />
                          <select
                            value={nouvelleExceptionTravaille}
                            onChange={(e) => setNouvelleExceptionTravaille(e.target.value)}
                            style={{ padding: '6px' }}
                          >
                            <option value="oui">Travaille ce jour-là</option>
                            <option value="non">Ne travaille pas ce jour-là</option>
                          </select>
                          <button onClick={() => ajouterException(employe.id)} style={{ padding: '6px 12px', cursor: 'pointer' }}>
                            Ajouter
                          </button>
                        </div>

                        {exceptions.length === 0 ? (
                          <p style={{ fontSize: '13px', color: '#6B6357' }}>Aucune exception enregistrée.</p>
                        ) : (
                          <ul style={{ paddingLeft: '20px', margin: 0 }}>
                            {exceptions.map((exc) => (
                              <li key={exc.id} style={{ fontSize: '13px', marginBottom: '4px' }}>
                                {new Date(exc.date).toLocaleDateString('fr-FR')} — {exc.travaille ? 'Travaille exceptionnellement' : 'Absent exceptionnellement'}{' '}
                                <button
                                  onClick={() => supprimerException(exc.id, employe.id)}
                                  style={{ color: 'red', border: 'none', background: 'none', cursor: 'pointer', fontSize: '12px' }}
                                >
                                  (supprimer)
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  )}

                  {salaireOuvertId === employe.id && (
                    <tr>
                      <td colSpan={PERMISSIONS.length + 6} style={{ padding: '15px', backgroundColor: '#faf8f5', border: '1px solid #E6E0D6' }}>
                        <strong>💰 Salaire de {employe.nom}</strong>
                        <p style={{ fontSize: '13px', color: '#6B6357', margin: '4px 0 15px' }}>
                          Enregistrez un paiement de salaire. Il sera automatiquement compté dans vos Dépenses.
                        </p>

                        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '15px' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '12px', color: '#6B6357', marginBottom: '4px' }}>Montant (FCFA)</label>
                            <input
                              type="number"
                              value={nouveauSalaireMontant}
                              onChange={(e) => setNouveauSalaireMontant(e.target.value)}
                              placeholder="Ex : 40000"
                              style={{ padding: '7px', width: '130px' }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '12px', color: '#6B6357', marginBottom: '4px' }}>Date de paiement</label>
                            <input
                              type="date"
                              value={nouveauSalaireDate}
                              onChange={(e) => setNouveauSalaireDate(e.target.value)}
                              style={{ padding: '7px' }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '12px', color: '#6B6357', marginBottom: '4px' }}>Période (optionnel)</label>
                            <input
                              type="text"
                              value={nouveauSalairePeriode}
                              onChange={(e) => setNouveauSalairePeriode(e.target.value)}
                              placeholder="Ex : Août 2026"
                              style={{ padding: '7px', width: '150px' }}
                            />
                          </div>
                          <button
                            onClick={() => enregistrerSalaire(employe)}
                            disabled={envoiSalaire}
                            style={{ padding: '8px 16px', backgroundColor: '#C9822A', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                          >
                            {envoiSalaire ? 'Enregistrement...' : 'Enregistrer le paiement'}
                          </button>
                        </div>

                        <hr style={{ border: 'none', borderTop: '1px solid #E6E0D6', margin: '10px 0' }} />

                        <strong>Historique des paiements</strong>
                        {salaires.length === 0 ? (
                          <p style={{ fontSize: '13px', color: '#6B6357', marginTop: '8px' }}>Aucun paiement enregistré.</p>
                        ) : (
                          <ul style={{ paddingLeft: '20px', margin: '8px 0 0' }}>
                            {salaires.map((s) => (
                              <li key={s.id} style={{ fontSize: '13px', marginBottom: '4px' }}>
                                {new Date(s.date_paiement).toLocaleDateString('fr-FR')} — {Number(s.montant).toLocaleString('fr-FR')} FCFA
                                {s.periode ? ` (${s.periode})` : ''}{' '}
                                <button
                                  onClick={() => supprimerSalaire(s.id, employe.id)}
                                  style={{ color: 'red', border: 'none', background: 'none', cursor: 'pointer', fontSize: '12px' }}
                                >
                                  (supprimer)
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
          </div>
        </>
      )}
    </div>
  )
}

export default GestionEmployes