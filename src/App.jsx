import { useState } from 'react'
import './App.css'
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

function App() {
  const [pageActive, setPageActive] = useState('tableau')
  const [menuOuvert, setMenuOuvert] = useState(false)

  const [employeConnecte, setEmployeConnecte] = useState(() => {
    const sauvegarde = localStorage.getItem('employeConnecte')
    return sauvegarde ? JSON.parse(sauvegarde) : null
  })

  function handleDeconnexion() {
    localStorage.removeItem('employeConnecte')
    setEmployeConnecte(null)
  }

  if (!employeConnecte) {
    return <Connexion onConnexionReussie={setEmployeConnecte} />
  }

  const estProprietaire = employeConnecte.role === 'proprietaire'

  function allerA(page) {
    setPageActive(page)
    setMenuOuvert(false)
  }

  const classeBouton = (page) => `app-sidebar-bouton${pageActive === page ? ' actif' : ''}`

  const elementsMenu = [
    { page: 'tableau', icone: '📊', label: 'Tableau de bord' },
    { page: 'caisse', icone: '🧾', label: 'Vente' },
    { page: 'produits', icone: '📦', label: 'Produits' },
    { page: 'inventaire', icone: '📋', label: 'Inventaire' },
    { page: 'commande', icone: '🛒', label: 'Commande' },
    { page: 'proforma', icone: '📄', label: 'Proforma' },
    { page: 'stock', icone: '🗃️', label: 'Stock' },
    { page: 'clients', icone: '👥', label: 'Clients' },
    { page: 'fournisseurs', icone: '🚚', label: 'Fournisseurs' },
    { page: 'depenses', icone: '💰', label: 'Dépenses' },
  ]

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
          <div className="app-sidebar-logo-icone">B</div>
          <span className="app-sidebar-logo-nom">Bloc</span>
        </div>

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

          {estProprietaire && (
            <button className={classeBouton('employes')} onClick={() => allerA('employes')}>
              <span>🔑</span>
              <span>Gestion Employés</span>
            </button>
          )}
        </div>
      </nav>

      <div className="app-contenu">
        <AlerteStock pageActive={pageActive} />

        {pageActive === 'tableau' && <TableauDeBord />}
        {pageActive === 'caisse' && <Caisse />}
        {pageActive === 'produits' && <Produits />}
        {pageActive === 'inventaire' && <Inventaire />}
        {pageActive === 'commande' && <Commande />}
        {pageActive === 'proforma' && <Proforma />}
        {pageActive === 'stock' && <Stock />}
        {pageActive === 'clients' && <Clients />}
        {pageActive === 'fournisseurs' && <Fournisseurs />}
        {pageActive === 'depenses' && <Depenses />}
        {pageActive === 'employes' && estProprietaire && <GestionEmployes />}
      </div>
    </div>
  )
}

export default App