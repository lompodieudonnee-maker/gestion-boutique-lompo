import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import './Stock.css';

function Inventaire() {
  const employeConnecte = JSON.parse(localStorage.getItem('employeConnecte'));
  const boutiqueId = employeConnecte?.boutique_id;

  const [ongletActif, setOngletActif] = useState('valorisation');
  const [produits, setProduits] = useState([]);
  const [mouvements, setMouvements] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [comptages, setComptages] = useState({});
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    if (boutiqueId) {
      chargerDonnees();
    }
  }, [boutiqueId]);

  async function chargerDonnees() {
    setChargement(true);

    const { data: produitsData } = await supabase
      .from('products')
      .select('id, nom, prix_achat, seuil_alerte')
      .eq('boutique_id', boutiqueId);

    const { data: mouvementsData } = await supabase
      .from('stock_mouvements')
      .select('produit_id, quantite')
      .eq('boutique_id', boutiqueId);

    setProduits(produitsData || []);
    setMouvements(mouvementsData || []);
    setChargement(false);
  }

  function quantiteActuelle(idProduit) {
    return mouvements
      .filter((m) => String(m.produit_id) === String(idProduit))
      .reduce((total, m) => total + Number(m.quantite), 0);
  }

  const valeurTotale = produits.reduce(
    (total, p) => total + quantiteActuelle(p.id) * Number(p.prix_achat || 0),
    0
  );

  function changerComptage(idProduit, valeur) {
    setComptages({ ...comptages, [idProduit]: valeur });
  }

  async function validerComptage() {
    const entrees = Object.entries(comptages).filter(([, val]) => val !== '' && val !== undefined);

    if (entrees.length === 0) {
      alert('Aucune quantité comptée à valider.');
      return;
    }

    setEnvoi(true);

    for (const [produitId, valeurSaisie] of entrees) {
      const compte = parseInt(valeurSaisie, 10);
      const actuel = quantiteActuelle(Number(produitId));
      const ecart = compte - actuel;

      if (ecart !== 0) {
        await supabase.from('stock_mouvements').insert({
          boutique_id: boutiqueId,
          produit_id: produitId,
          employe_id: employeConnecte?.id,
          type_mouvement: 'Correction inventaire',
          quantite: ecart,
          motif: `Comptage physique du ${new Date().toLocaleDateString('fr-FR')}`,
        });
      }
    }

    setEnvoi(false);
    setComptages({});
    chargerDonnees();
    alert('Comptage validé et écarts enregistrés.');
  }

  if (chargement) return <div className="stock-page">Chargement...</div>;

  return (
    <div className="stock-page">
      <h1>Inventaire</h1>

      <div className="stock-onglets">
        <button
          className={ongletActif === 'valorisation' ? 'actif' : ''}
          onClick={() => setOngletActif('valorisation')}
        >
          Valorisation
        </button>
        <button
          className={ongletActif === 'comptage' ? 'actif' : ''}
          onClick={() => setOngletActif('comptage')}
        >
          Comptage physique
        </button>
      </div>

      {ongletActif === 'valorisation' && (
        <>
          <table className="stock-tableau">
            <thead>
              <tr>
                <th>Produit</th>
                <th>Quantité en stock</th>
                <th>Prix d'achat</th>
                <th>Valeur</th>
              </tr>
            </thead>
            <tbody>
              {produits.map((p) => {
                const qte = quantiteActuelle(p.id);
                const valeur = qte * Number(p.prix_achat || 0);
                return (
                  <tr key={p.id}>
                    <td>{p.nom}</td>
                    <td>{qte}</td>
                    <td>{p.prix_achat || 0} FCFA</td>
                    <td>{valeur.toLocaleString('fr-FR')} FCFA</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <h3 style={{ marginTop: '20px', color: '#b8860b' }}>
            Valeur totale du stock : {valeurTotale.toLocaleString('fr-FR')} FCFA
          </h3>
        </>
      )}

      {ongletActif === 'comptage' && (
        <>
          <p style={{ color: '#6B6357', marginBottom: '15px' }}>
            Comptez physiquement chaque produit en boutique et saisissez la quantité réelle trouvée. Laissez vide les produits non comptés.
          </p>
          <table className="stock-tableau">
            <thead>
              <tr>
                <th>Produit</th>
                <th>Quantité système</th>
                <th>Quantité comptée</th>
                <th>Écart</th>
              </tr>
            </thead>
            <tbody>
              {produits.map((p) => {
                const qteSysteme = quantiteActuelle(p.id);
                const saisie = comptages[p.id];
                const ecart = saisie !== undefined && saisie !== '' ? parseInt(saisie, 10) - qteSysteme : null;
                return (
                  <tr key={p.id}>
                    <td>{p.nom}</td>
                    <td>{qteSysteme}</td>
                    <td>
                      <input
                        type="number"
                        value={saisie || ''}
                        onChange={(e) => changerComptage(p.id, e.target.value)}
                        style={{ width: '80px', padding: '6px 8px', border: '1px solid #e0d0b0', borderRadius: '6px' }}
                      />
                    </td>
                    <td style={{ color: ecart === null ? '#999' : ecart === 0 ? '#2E7D32' : '#c0392b', fontWeight: 600 }}>
                      {ecart === null ? '-' : ecart > 0 ? `+${ecart}` : ecart}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <button
            onClick={validerComptage}
            disabled={envoi}
            style={{
              marginTop: '15px',
              padding: '12px 24px',
              background: 'linear-gradient(135deg, #ffa500, #ffcc70)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontFamily: 'Poppins, sans-serif',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {envoi ? 'Enregistrement...' : 'Valider le comptage'}
          </button>
        </>
      )}
    </div>
  );
}

export default Inventaire;