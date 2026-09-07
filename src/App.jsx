import { useState, useEffect } from 'react'
import './App.css'
import { supabase } from './lib/supabaseClient'
import { pointageDuJour, enregistrerDepart, envoyerWhatsAppPointage, ouvrirFenetreWhatsApp } from './lib/pointage'
import AlerteStock from './pages/AlerteStock'
import Produits from './pages/Produits'
import Stock from './pages/Stock'
import Inventaire from './pages/Inventaire'
import Commande from './pages/Commande'
import Proforma from './pages/Proforma'
import Caisse from './pages/Caisse'
import Clients from './pages/Clients'
import Fournisseurs from './pages/Fournisseurs'
import Depenses from './pages/Depenses'
import TableauDeBord from './pages/TableauDeBord'
import GestionEmployes from './pages/GestionEmployes'
import Connexion from './pages/Connexion'
import Inscription from './pages/Inscription'
import AdminBoutiques from './pages/AdminBoutiques'
import PretsInterBoutiques from './pages/PretsInterBoutiques'

function App() {
  const [pageActive, setPageActive] = useState('tableauDeBord')
  const [menuOuvert, setMenuOuvert] = useState(false)

  const [employeConnecte, setEmployeConnecte] = useState(() => {
    const sauvegarde = localStorage.getItem('employeConnecte')
    return sauvegarde ? JSON.parse(sauvegarde) : null
  })

  const [boutiques, setBoutiques] = useState([])
  const [boutiqueActiveId, setBoutiqueActiveId] = useState(() => {
    return localStorage.getItem('boutiqueActiveId') || null
  })

  const [boutiqueInfo, setBoutiqueInfo] = useState(null)

  useEffect(() => {
    if (employeConnecte?.role === 'superadmin') {
      supabase.from('boutiques').select('*').then(({ data }) => {
        if (data) {
          setBoutiques(data)
          if (!boutiqueActiveId && data.length > 0) {
            setBoutiqueActiveId(data[0].id)
            localStorage.setItem('boutiqueActiveId', data[0].id)
          }
        }
      })
    }
  }, [employeConnecte])

  useEffect(() => {
    async function rafraichirEmploye() {
      if (!employeConnecte || employeConnecte.role === 'superadmin') return

      const { data, error } = await supabase
        .from('employes')
        .select('*')
        .eq('id', employeConnecte.id)
        .single()

      if (!error && data) {
        setEmployeConnecte(data)
        localStorage.setItem('employeConnecte', JSON.stringify(data))
      }
    }
    rafraichirEmploye()
  }, [])

  useEffect(() => {
    async function chargerBoutiqueInfo() {
      if (!employeConnecte || employeConnecte.role === 'superadmin' || !employeConnecte.boutique_id) return
      const { data } = await supabase
        .from('boutiques')
        .select('date_fin_essai, date_dernier_paiement, date_fin_abonnement')
        .eq('id', employeConnecte.boutique_id)
        .single()
      if (data) setBoutiqueInfo(data)
    }
    chargerBoutiqueInfo()
  }, [employeConnecte])

  function messageAlerteAbonnement() {
    if (!boutiqueInfo) return null
    const maintenant = new Date()

    // Cas 1 : encore en période d'essai gratuit
    if (boutiqueInfo.date_fin_essai) {
      const dateFin = new Date(boutiqueInfo.date_fin_essai)
      const joursRestants = Math.ceil((dateFin - maintenant) / (1000 * 60 * 60 * 24))
      if (joursRestants >= 0 && joursRestants <= 3) {
        const echeance = joursRestants === 0 ? "aujourd'hui" : `dans ${joursRestants} jour(s)`
        return `⚠️ Votre essai gratuit Stockia se termine ${echeance}. Contactez-nous pour continuer à utiliser l'application.`
      }
      return null
    }

    // Cas 2 : boutique déjà validée/payante
    // On utilise en priorité la date de fin d'abonnement exacte (si un paiement longue durée a été enregistré),
    // sinon on retombe sur l'ancien calcul (dernier paiement + 30 jours)
    let dateEcheance = null
    if (boutiqueInfo.date_fin_abonnement) {
      dateEcheance = new Date(boutiqueInfo.date_fin_abonnement)
    } else if (boutiqueInfo.date_dernier_paiement) {
      dateEcheance = new Date(boutiqueInfo.date_dernier_paiement)
      dateEcheance.setDate(dateEcheance.getDate() + 30)
    }

    if (!dateEcheance) return null

    const joursRestants = Math.ceil((dateEcheance - maintenant) / (1000 * 60 * 60 * 24))
    if (joursRestants > 3) return null

    if (joursRestants >= 0) {
      const echeance = joursRestants === 0 ? "aujourd'hui" : `dans ${joursRestants} jour(s)`
      return `⚠️ Votre abonnement Stockia se termine ${echeance}. Pensez à renouveler votre paiement pour continuer à utiliser l'application.`
    }
    return `⚠️ Votre abonnement Stockia est arrivé à échéance depuis ${Math.abs(joursRestants)} jour(s). Merci de renouveler votre paiement rapidement.`
  }

  function changerBoutiqueActive(id) {
    setBoutiqueActiveId(id)
    localStorage.setItem('boutiqueActiveId', id)
    window.location.reload()
  }

  async function handleDeconnexion() {
    if (employeConnecte?.role === 'employe') {
      const confirmer = confirm('Confirmez-vous votre départ de la boutique ? (Un message sera envoyé au responsable par WhatsApp)')
      if (!confirmer) return

      // Ouvre l'onglet WhatsApp tout de suite (au moment du clic) pour éviter que le navigateur le bloque ;
      // on y mettra le message une fois prêt.
      const fenetreWhatsApp = ouvrirFenetreWhatsApp()

      const pointage = await pointageDuJour(employeConnecte.id)
      if (pointage && pointage.heure_arrivee && !pointage.heure_depart) {
        const { data: boutique } = await supabase
          .from('boutiques')
          .select('nom, whatsapp_responsable')
          .eq('id', employeConnecte.boutique_id)
          .single()

        const { heure } = await enregistrerDepart(pointage.id)
        if (boutique) {
          const message = `🕐 *${employeConnecte.nom}* a quitté la boutique "${boutique.nom}" à ${heure}.`
          const envoye = envoyerWhatsAppPointage(boutique.whatsapp_responsable, message, fenetreWhatsApp)
          if (!envoye) {
            alert("Votre départ a bien été enregistré, mais aucun numéro WhatsApp du responsable n'est configuré pour cette boutique. Demandez au propriétaire de le renseigner dans Inventaire ou Fournisseurs.")
          }
        } else {
          fenetreWhatsApp?.close()
        }
      } else {
        fenetreWhatsApp?.close()
      }
    }

    localStorage.removeItem('employeConnecte')
    localStorage.removeItem('boutiqueActiveId')
    setEmployeConnecte(null)
  }

  if (!employeConnecte) {
    if (window.location.pathname === '/inscription') {
      return <Inscription />
    }
    return <Connexion onConnexionReussie={setEmployeConnecte} />
  }

  const estProprietaire = employeConnecte.role === 'proprietaire'
  const estSuperAdmin = employeConnecte.role === 'superadmin'

  function allerA(page) {
    setPageActive(page)
    setMenuOuvert(false)
  }

  const classeBouton = (page) => `app-sidebar-bouton${pageActive === page ? ' actif' : ''}`

  const elementsMenuComplet = [
    { page: 'tableauDeBord', icone: '📊', label: 'Tableau de bord' },
    { page: 'caisse', icone: '🛒', label: 'Caisse' },
    { page: 'produits', icone: '📦', label: 'Produits' },
    { page: 'inventaire', icone: '📋', label: 'Inventaire' },
    { page: 'commande', icone: '📝', label: 'Commande' },
    { page: 'proforma', icone: '📄', label: 'Proforma' },
    { page: 'stock', icone: '📊', label: 'Stock', permission: 'peut_gerer_stock' },
    { page: 'clients', icone: '👥', label: 'Clients' },
    { page: 'fournisseurs', icone: '🚚', label: 'Fournisseurs' },
    { page: 'depenses', icone: '💰', label: 'Dépenses' },
  ]

  const elementsMenu = elementsMenuComplet.filter((item) => {
    if (!item.permission) return true
    if (estProprietaire || estSuperAdmin) return true
    return !!employeConnecte[item.permission]
  })

  const alerteAbonnement = messageAlerteAbonnement()

  return (
    <div className="app-layout">
      <button className="app-menu-toggle" onClick={() => setMenuOuvert(true)}>
        ☰
      </button>

      <div
        className={`app-sidebar-backdrop${menuOuvert ? ' visible' : ''}`}
        onClick={() => setMenuOuvert(false)}
      />

      <nav className={`app-sidebar${menuOuvert ? ' ouverte' : ''}`}>
        <div className="app-sidebar-logo">
          <div className="app-sidebar-logo-icone">S</div>
          <span className="app-sidebar-logo-nom">Stockia</span>
        </div>

        {estSuperAdmin && (
          <div style={{ padding: '10px 16px' }}>
            <select
              value={boutiqueActiveId || ''}
              onChange={(e) => changerBoutiqueActive(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '8px' }}
            >
              {boutiques.map((b) => (
                <option key={b.id} value={b.id}>{b.nom}</option>
              ))}
            </select>
          </div>
        )}

        <div className="app-sidebar-utilisateur">
          <span className="app-sidebar-nom">👤 {employeConnecte.nom}</span>
          <button className="app-sidebar-deconnexion" onClick={handleDeconnexion}>
            Déconnexion
          </button>
        </div>

        <div className="app-sidebar-menu">
          {elementsMenu.map((item) => (
            <button
              key={item.page}
              className={classeBouton(item.page)}
              onClick={() => allerA(item.page)}
            >
              <span>{item.icone}</span>
              <span>{item.label}</span>
            </button>
          ))}
          {(estProprietaire || estSuperAdmin) && (
            <button className={classeBouton('employes')} onClick={() => allerA('employes')}>
              <span>🔑</span>
              <span>Gestion Employés</span>
            </button>
          )}

          {estSuperAdmin && (
            <button className={classeBouton('adminBoutiques')} onClick={() => allerA('adminBoutiques')}>
              <span>🏢</span>
              <span>Gérer les boutiques</span>
            </button>
          )}

          {(estSuperAdmin || estProprietaire || employeConnecte.peut_gerer_prets) && (
            <button className={classeBouton('prets')} onClick={() => allerA('prets')}>
              <span>🔄</span>
              <span>Prêts entre boutiques</span>
            </button>
          )}
        </div>
      </nav>

      <div className="app-contenu">
        {alerteAbonnement && (
          <div className="alerte-abonnement">
            <span>{alerteAbonnement}</span>
            <a href="https://wa.me/22655006657" target="_blank" rel="noopener noreferrer" className="alerte-abonnement-bouton">
              Renouveler sur WhatsApp
            </a>
          </div>
        )}
        <AlerteStock pageActive={pageActive} />
        {pageActive === 'tableauDeBord' && <TableauDeBord setPageActive={setPageActive} />}
        {pageActive === 'caisse' && <Caisse />}
        {pageActive === 'produits' && <Produits />}
        {pageActive === 'inventaire' && <Inventaire />}
        {pageActive === 'commande' && <Commande />}
        {pageActive === 'proforma' && <Proforma />}
        {pageActive === 'stock' && <Stock />}
        {pageActive === 'clients' && <Clients />}
        {pageActive === 'fournisseurs' && <Fournisseurs />}
        {pageActive === 'depenses' && <Depenses />}
        {pageActive === 'employes' && (estProprietaire || estSuperAdmin) && <GestionEmployes />}
        {pageActive === 'adminBoutiques' && estSuperAdmin && <AdminBoutiques />}
        {pageActive === 'prets' && (estSuperAdmin || estProprietaire || employeConnecte.peut_gerer_prets) && <PretsInterBoutiques />}
      </div>
    </div>
  )
}

export default App