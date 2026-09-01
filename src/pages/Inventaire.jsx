import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import './Stock.css';
import { getBoutiqueId } from '../lib/boutique'

function Inventaire() {
  const employeConnecte = JSON.parse(localStorage.getItem('employeConnecte'));
  const boutiqueId = getBoutiqueId()
  const [ongletActif, setOngletActif] = useState('valorisation');
  const [produits, setProduits] = useState([]);
  const [mouvements, setMouvements] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [comptages, setComptages] = useState({});
  const [envoi, setEnvoi] = useState(false);

  const [produitMouvement, setProduitMouvement] = useState('');
  const [quantiteMouvement, setQuantiteMouvement] = useState('');
  const [typeMouvement, setTypeMouvement] = useState('Entrée');
  const [motifMouvement, setMotifMouvement] = useState('');
  const [envoiMouvement, setEnvoiMouvement] = useState(false);
    const [rechercheProduit, setRechercheProduit] = useState('');

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
      .select('id, produit_id, quantite, type_mouvement, motif, created_at')
      .eq('boutique_id', boutiqueId)
      .order('created_at', { ascending: false });

    setProduits(produitsData || []);
    setMouvements(mouvementsData || []);
    setChargement(false);
  }

  function quantiteActuelle(idProduit) {
    return mouvements
      .filter((m) => String(m.produit_id) === String(idProduit))
      .reduce((total, m) => total + Number(m.quantite), 0);
  }

  function nomProduit(idProduit) {
    const p = produits.find((p) => String(p.id) === String(idProduit));
    return p ? p.nom : 'Produit supprimé';
  }
   const produitsFiltres = produits.filter((p) =>
    p.nom.toLowerCase().includes(rechercheProduit.toLowerCase())
  ); 

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

  async function enregistrerMouvement() {
    if (!produitMouvement) {
      alert('Choisissez un produit');
      return;
    }
    const qte = parseInt(quantiteMouvement, 10);
    if (!qte || qte <= 0) {
      alert('Entrez une quantité valide');
      return;
    }

    setEnvoiMouvement(true);

    const { error } = await supabase.from('stock_mouvements').insert({
      boutique_id: boutiqueId,
      produit_id: produitMouvement,
      employe_id: employeConnecte?.id,
      type_mouvement: typeMouvement,
      quantite: typeMouvement === 'Entrée' ? qte : -qte,
      motif: motifMouvement || (typeMouvement === 'Entrée' ? 'Entrée manuelle' : 'Sortie manuelle'),
    });

    setEnvoiMouvement(false);

    if (error) {
      alert('Erreur : ' + error.message);
      return;
    }

    setProduitMouvement('');
    setQuantiteMouvement('');
    setMotifMouvement('');
    chargerDonnees();
    alert('Mouvement enregistré avec succès.');
  }

  if (chargement) return <div className="stock-page">Chargement...</div>;

  return (
    <div className="stock-page">
           <h1>Inventaire</h1>

      <input
        type="text"
        placeholder="🔍 Rechercher un produit..."
        value={rechercheProduit}
        onChange={(e) => setRechercheProduit(e.target.value)}
        style={{ width: '100%', maxWidth: '400px', padding: '10px 12px', marginBottom: '16px', border: '1px solid #E6E0D6', borderRadius: '8px', boxSizing: 'border-box' }}
      />

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
        <button
          className={ongletActif === 'mouvement' ? 'actif' : ''}
          onClick={() => setOngletActif('mouvement')}
        >
          Entrée / Sortie
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
              {produitsFiltres.map((p) => {
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
              {produitsFiltres.map((p) => {
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
              background: '#C9822A',
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

      {ongletActif === 'mouvement' && (
        <>
                    <div
            style={{
              backgroundColor: '#FDECE1',
              border: '1px solid #F3D2B0',
              borderRadius: '10px',
              padding: '14px 18px',
              marginBottom: '20px',
              fontSize: '13px',
              color: '#6B4A1F',
              maxWidth: '600px',
            }}
          >
            <strong>⚠️ À utiliser uniquement pour les cas exceptionnels :</strong>
            <ul style={{ margin: '8px 0 0', paddingLeft: '20px' }}>
              <li><strong>Entrée</strong> : don, retour client, correction d'un oubli</li>
              <li><strong>Sortie</strong> : casse, perte, vol, usage personnel, cadeau</li>
            </ul>
            <p style={{ margin: '8px 0 0' }}>
              ❌ Ne pas utiliser pour une vente (déjà automatique en Caisse) ni pour un achat fournisseur (déjà automatique dans Fournisseurs/Commandes).
            </p>
          </div>

          <div
            style={{
              backgroundColor: '#faf8f5',
              border: '1px solid #E6E0D6',
              borderRadius: '10px',
              padding: '18px',
              marginBottom: '25px',
              maxWidth: '500px',
            }}
          >
            <label style={{ display: 'block', fontSize: '13px', color: '#6B6357', marginBottom: '4px' }}>Produit</label>
            <select
              value={produitMouvement}
              onChange={(e) => setProduitMouvement(e.target.value)}
              style={{ width: '100%', padding: '9px', marginBottom: '12px', border: '1px solid #E6E0D6', borderRadius: '6px' }}
            >
                            <option value="">-- Choisir un produit --</option>
              {produitsFiltres.map((p) => (
                <option key={p.id} value={p.id}>{p.nom}</option>
              ))}
            </select>

            <label style={{ display: 'block', fontSize: '13px', color: '#6B6357', marginBottom: '4px' }}>Type de mouvement</label>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
              <button
                type="button"
                onClick={() => setTypeMouvement('Entrée')}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '6px',
                  border: typeMouvement === 'Entrée' ? '2px solid #2E7D32' : '1px solid #E6E0D6',
                  backgroundColor: typeMouvement === 'Entrée' ? '#EAF5EC' : 'white',
                  color: '#2E7D32',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Entrée
              </button>
              <button
                type="button"
                onClick={() => setTypeMouvement('Sortie')}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '6px',
                  border: typeMouvement === 'Sortie' ? '2px solid #B71C1C' : '1px solid #E6E0D6',
                  backgroundColor: typeMouvement === 'Sortie' ? '#FBEAEA' : 'white',
                  color: '#B71C1C',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Sortie
              </button>
            </div>

            <label style={{ display: 'block', fontSize: '13px', color: '#6B6357', marginBottom: '4px' }}>Quantité</label>
            <input
              type="number"
              value={quantiteMouvement}
              onChange={(e) => setQuantiteMouvement(e.target.value)}
              placeholder="Ex : 10"
              style={{ width: '100%', padding: '9px', marginBottom: '12px', border: '1px solid #E6E0D6', borderRadius: '6px', boxSizing: 'border-box' }}
            />

            <label style={{ display: 'block', fontSize: '13px', color: '#6B6357', marginBottom: '4px' }}>Motif (optionnel)</label>
            <input
              type="text"
              value={motifMouvement}
              onChange={(e) => setMotifMouvement(e.target.value)}
              placeholder="Ex : Casse, don, retour fournisseur..."
              style={{ width: '100%', padding: '9px', marginBottom: '15px', border: '1px solid #E6E0D6', borderRadius: '6px', boxSizing: 'border-box' }}
            />

            <button
              onClick={enregistrerMouvement}
              disabled={envoiMouvement}
              style={{
                width: '100%',
                padding: '12px',
                background: '#C9822A',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontFamily: 'Poppins, sans-serif',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {envoiMouvement ? 'Enregistrement...' : 'Enregistrer le mouvement'}
            </button>
          </div>

          <h3 style={{ marginBottom: '10px' }}>Historique des mouvements</h3>
          {mouvements.length === 0 ? (
            <p style={{ color: '#6B6357' }}>Aucun mouvement enregistré.</p>
          ) : (
            <table className="stock-tableau">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Produit</th>
                  <th>Type</th>
                  <th>Quantité</th>
                  <th>Motif</th>
                </tr>
              </thead>
              <tbody>
                {mouvements.slice(0, 50).map((m) => (
                  <tr key={m.id}>
                    <td>
                      {new Date(m.created_at).toLocaleDateString('fr-FR')}{' '}
                      {new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td>{nomProduit(m.produit_id)}</td>
                    <td>{m.type_mouvement}</td>
                    <td style={{ color: Number(m.quantite) >= 0 ? '#2E7D32' : '#B71C1C', fontWeight: 600 }}>
                      {Number(m.quantite) >= 0 ? `+${m.quantite}` : m.quantite}
                    </td>
                    <td>{m.motif}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}

export default Inventaire;