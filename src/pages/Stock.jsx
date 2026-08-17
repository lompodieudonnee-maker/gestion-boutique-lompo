import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import './Stock.css';

function Stock() {
  const employeConnecte = JSON.parse(localStorage.getItem('employeConnecte'));
  const boutiqueId = employeConnecte?.boutique_id;

  const [ongletActif, setOngletActif] = useState('vue');
  const [produits, setProduits] = useState([]);
  const [mouvements, setMouvements] = useState([]);
  const [chargement, setChargement] = useState(true);

  // Formulaire d'ajustement
  const [produitId, setProduitId] = useState('');
  const [typeMouvement, setTypeMouvement] = useState('Entrée');
  const [quantite, setQuantite] = useState('');
  const [motif, setMotif] = useState('');
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
      .select('id, nom, seuil_alerte')
      .eq('boutique_id', boutiqueId);

    const { data: mouvementsData } = await supabase
      .from('stock_mouvements')
      .select('*, products(nom), employes(nom)')
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

  async function soumettreAjustement(e) {
    e.preventDefault();
    if (!produitId || !quantite) return;

    setEnvoi(true);

    let quantiteFinale = parseInt(quantite, 10);
    if (typeMouvement === 'Sortie' || typeMouvement === 'Casse/Perte') {
      quantiteFinale = -Math.abs(quantiteFinale);
    } else if (typeMouvement === 'Entrée') {
      quantiteFinale = Math.abs(quantiteFinale);
    }

    const { error } = await supabase.from('stock_mouvements').insert({
      boutique_id: boutiqueId,
      produit_id: produitId,
      employe_id: employeConnecte?.id,
      type_mouvement: typeMouvement,
      quantite: quantiteFinale,
      motif: motif || null,
    });

    setEnvoi(false);

    if (!error) {
      setProduitId('');
      setQuantite('');
      setMotif('');
      chargerDonnees();
    } else {
      alert("Erreur lors de l'enregistrement : " + error.message);
    }
  }

  if (chargement) return <div className="stock-page">Chargement...</div>;

  return (
    <div className="stock-page">
      <h1>Stock</h1>

      <div className="stock-onglets">
        <button
          className={ongletActif === 'vue' ? 'actif' : ''}
          onClick={() => setOngletActif('vue')}
        >
          Vue d'ensemble
        </button>
        <button
          className={ongletActif === 'historique' ? 'actif' : ''}
          onClick={() => setOngletActif('historique')}
        >
          Historique
        </button>
        <button
          className={ongletActif === 'ajustement' ? 'actif' : ''}
          onClick={() => setOngletActif('ajustement')}
        >
          Ajustement
        </button>
      </div>

      {ongletActif === 'vue' && (
        <table className="stock-tableau">
          <thead>
            <tr>
              <th>Produit</th>
              <th>Quantité en stock</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {produits.map((p) => {
              const qte = quantiteActuelle(p.id);
              const alerte = p.seuil_alerte != null && qte <= p.seuil_alerte;
              return (
                <tr key={p.id} className={alerte ? 'ligne-alerte' : ''}>
                  <td>{p.nom}</td>
                  <td>{qte}</td>
                  <td>{alerte ? '⚠️ Stock faible' : 'OK'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {ongletActif === 'historique' && (
        <table className="stock-tableau">
          <thead>
            <tr>
              <th>Date</th>
              <th>Produit</th>
              <th>Type</th>
              <th>Quantité</th>
              <th>Motif</th>
              <th>Employé</th>
            </tr>
          </thead>
          <tbody>
            {mouvements.map((m) => (
              <tr key={m.id}>
                <td>{new Date(m.created_at).toLocaleString('fr-FR')}</td>
                <td>{m.products?.nom}</td>
                <td>{m.type_mouvement}</td>
                <td>{m.quantite}</td>
                <td>{m.motif || '-'}</td>
                <td>{m.employes?.nom || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {ongletActif === 'ajustement' && (
        <form className="stock-formulaire" onSubmit={soumettreAjustement}>
          <label>
            Produit
            <select value={produitId} onChange={(e) => setProduitId(e.target.value)} required>
              <option value="">-- Choisir un produit --</option>
              {produits.map((p) => (
                <option key={p.id} value={p.id}>{p.nom}</option>
              ))}
            </select>
          </label>

          <label>
            Type de mouvement
            <select value={typeMouvement} onChange={(e) => setTypeMouvement(e.target.value)}>
              <option value="Entrée">Entrée</option>
              <option value="Sortie">Sortie</option>
              <option value="Casse/Perte">Casse/Perte</option>
              <option value="Correction inventaire">Correction inventaire</option>
            </select>
          </label>

          <label>
            Quantité
            <input
              type="number"
              value={quantite}
              onChange={(e) => setQuantite(e.target.value)}
              required
            />
          </label>

          <label>
            Motif (optionnel)
            <input
              type="text"
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder="Ex: Produit périmé, comptage physique..."
            />
          </label>

          <button type="submit" disabled={envoi}>
            {envoi ? 'Enregistrement...' : 'Enregistrer le mouvement'}
          </button>
        </form>
      )}
    </div>
  );
}

export default Stock;