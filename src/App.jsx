import { useState, useEffect } from 'react'
import './App.css'
import { supabase } from './lib/supabaseClient'
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
        .select('date_fin_essai, date_dernier_paiement')
        .eq('id', employeConnecte.boutique_id)
        .single()
      if (data) setBoutiqueInfo(data)
    }
    chargerBoutiqueInfo()
  }, [employeConnecte])

  function messageAlerteAbonnement() {
    if (!boutiqueInfo) return null
    const maintenant = new Date()

    // Cas 1 : encore en période d'essai gratuit (date_fin_essai renseignée et pas encore écoulée)
    if (boutiqueInfo.date_fin_essai) {
      const dateFin = new Date(boutiqueInfo.date_fin_essai)
      const joursRestants = Math.ceil((dateFin - maintenant) / (1000 * 60 * 60 * 24))
      if (joursRestants >= 0 && joursRestants <= 3) {
        const echeance = joursRestants === 0 ? "aujourd'hui" : `dans ${joursRestants} jour(s)`
        return `⚠️ Votre essai gratuit Stockia se termine ${echeance}. Contactez-nous pour continuer à utiliser l'application.`
      }
      return null
    }

    // Cas 2 : boutique déjà validée/payante — échéance calculée sur 30 jours depuis le dernier paiement
    if (boutiqueInfo.date_dernier_paiement) {
      const dateEcheance = new Date(boutiqueInfo.date_dernier_paiement)
      dateEcheance.setDate(dateEcheance.getDate() + 30)
      const joursRestants = Math.ceil((dateEcheance - maintenant) / (1000 * 60 * 60 * 24))
      if (joursRestants > 3) return null

      if (joursRestants >= 0) {
        const echeance = joursRestants === 0 ? "aujourd'hui" : `dans ${joursRestants} jour(s)`
        return `⚠️ Votre abonnement Stockia se termine ${echeance}. Pensez à renouveler votre paiement pour continuer à utiliser l'application.`
      }
      return `⚠️ Votre abonnement Stockia est arrivé à échéance depuis ${Math.abs(joursRestants)} jour(s). Merci de renouveler votre paiement rapidement.`
    }

    return null
  }

  function changerBoutiqueActive(id) {
    setBoutiqueActiveId(id)
    localStorage.setItem('boutiqueActiveId', id)
    window.location.reload()
  }

  function handleDeconnexion() {
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
  { page: 'caisse', icone: '🛒', label: 'Vente' },
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
        </div>
      </nav>

      <div className="app-contenu">
        {alerteAbonnement && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px',
              backgroundColor: '#FFF4E5',
              border: '1px solid #E4A400',
              color: '#7A4E00',
              borderRadius: '8px',
              padding: '10px 16px',
              marginBottom: '16px',
              fontSize: '14px',
              fontWeight: 600,
            }}
          >
            <span>{alerteAbonnement}</span>
            
              href="https://wa.me/22655006657"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                backgroundColor: '#25D366',
                color: 'white',
                textDecoration: 'none',
                fontSize: '13px',
                fontWeight: 700,
                whiteSpace: 'nowrap',
              }}
            >
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
      </div>
    </div>
  )
}

export default App