import { useState } from 'react'
import Produits from './pages/Produits'
import Caisse from './pages/Caisse'
import Clients from './pages/Clients'
import Fournisseurs from './pages/Fournisseurs'
import Depenses from './pages/Depenses'
import TableauDeBord from './pages/TableauDeBord'

function App() {
  const [pageActive, setPageActive] = useState('tableau')

  const styleBouton = (page) => ({
    padding: '10px 20px',
    marginRight: '10px',
    backgroundColor: pageActive === page ? '#333' : '#eee',
    color: pageActive === page ? 'white' : 'black',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '16px',
  })

  return (
    <div>
      <nav style={{ padding: '15px', backgroundColor: '#f5f5f5', borderBottom: '1px solid #ccc' }}>
        <button style={styleBouton('tableau')} onClick={() => setPageActive('tableau')}>
          📊 Tableau de bord
        </button>
        <button style={styleBouton('caisse')} onClick={() => setPageActive('caisse')}>
          🛒 Caisse
        </button>
        <button style={styleBouton('produits')} onClick={() => setPageActive('produits')}>
          📦 Produits
        </button>
        <button style={styleBouton('clients')} onClick={() => setPageActive('clients')}>
          👥 Clients
        </button>
        <button style={styleBouton('fournisseurs')} onClick={() => setPageActive('fournisseurs')}>
          🚚 Fournisseurs
        </button>
        <button style={styleBouton('depenses')} onClick={() => setPageActive('depenses')}>
          💵 Dépenses
        </button>
      </nav>

      {pageActive === 'tableau' && <TableauDeBord />}
      {pageActive === 'caisse' && <Caisse />}
      {pageActive === 'produits' && <Produits />}
      {pageActive === 'clients' && <Clients />}
      {pageActive === 'fournisseurs' && <Fournisseurs />}
      {pageActive === 'depenses' && <Depenses />}
    </div>
  )
}

export default App
