import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import './Stock.css';
import { getBoutiqueId } from '../lib/boutique'
import { genererRapportInventairePDF } from '../lib/exportRapportPDF'

function Inventaire() {
  const employeConnecte = JSON.parse(localStorage.getItem('employeConnecte'));
  const boutiqueId = getBoutiqueId()
  const peutValiderComptage =
    employeConnecte?.role === 'proprietaire' ||
    employeConnecte?.role === 'superadmin' ||
    employeConnecte?.voir_finances === true
  const [ongletActif, setOngletActif] = useState('valorisation');
  const [produits, setProduits] = useState([]);
  const [mouvements, setMouvements] = useState([]);
  const [employes, setEmployes] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [comptages, setComptages] = useState({});
  const [envoi, setEnvoi] = useState(false);

  const [produitMouvement, setProduitMouvement] = useState('');
  const [quantiteMouvement, setQuantiteMouvement] = useState('');
  const [typeMouvement, setTypeMouvement] = useState('Entrée');
  const [motifMouvement, setMotifMouvement] = useState('');
  const [envoiMouvement, setEnvoiMouvement] = useState(false);
  const [rechercheProduit, setRechercheProduit] = useState('');

  const [nomBoutique, setNomBoutique] = useState('');
  const [whatsappResponsable, setWhatsappResponsable] = useState('');
  const [whatsappInput, setWhatsappInput] = useState('');
  const [enregistrementWhatsapp, setEnregistrementWhatsapp] = useState(false);
  const [panneauRapportOuvert, setPanneauRapportOuvert] = useState(false);
  const [dateDebutRapport, setDateDebutRapport] = useState('');
  const [dateFinRapport, setDateFinRapport] = useState('');
  const [genererEnCours, setGenererEnCours] = useState(false);

  const [dateDebutPertes, setDateDebutPertes] = useState('');
  const [dateFinPertes, setDateFinPertes] = useState('');

  useEffect(() => {
    if (boutiqueId) {
      chargerDonnees();
      chargerNomBoutique();
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
      .select('id, produit_id, quantite, type_mouvement, motif, created_at, employe_id')
      .eq('boutique_id', boutiqueId)
      .order('created_at', { ascending: false });

    const { data: employesData } = await supabase
      .from('employes')
      .select('id, nom')
      .eq('boutique_id', boutiqueId);

    setProduits(produitsData || []);
    setMouvements(mouvementsData || []);
    setEmployes(employesData || []);
    setChargement(false);
  }

  async function chargerNomBoutique() {
    const { data, error } = await supabase
      .from('boutiques')
      .select('nom, whatsapp_responsable')
      .eq('id', boutiqueId)
      .single()
    if (!error && data) {
      setNomBoutique(data.nom)
      setWhatsappResponsable(data.whatsapp_responsable || '')
      setWhatsappInput(data.whatsapp_responsable || '')
    }
  }

  async function enregistrerWhatsappResponsable() {
    setEnregistrementWhatsapp(true)
    const { error } = await supabase
      .from('boutiques')
      .update({ whatsapp_responsable: whatsappInput.trim() })
      .eq('id', boutiqueId)
    setEnregistrementWhatsapp(false)
    if (error) {
      alert('Erreur : ' + error.message)
      return
    }
    setWhatsappResponsable(whatsappInput.trim())
    alert('Numéro WhatsApp du responsable enregistré.')
  }

  function envoyerComptagePourValidation() {
    const numero = whatsappResponsable.replace(/[^0-9]/g, '')
    if (!numero) {
      alert("Aucun numéro WhatsApp du responsable n'est configuré. Demandez au propriétaire de le renseigner en haut de la page Inventaire.")
      return
    }

    const entrees = Object.entries(comptages).filter(([, val]) => val !== '' && val !== undefined)
    if (entrees.length === 0) {
      alert('Aucune quantité comptée à envoyer.')
      return
    }

    let message = `Bonjour, voici le comptage physique du ${new Date().toLocaleDateString('fr-FR')} pour ${nomBoutique || 'la boutique'}, à valider dans Stockia :\n\n`
    entrees.forEach(([produitId, valeurSaisie]) => {
      const compte = parseInt(valeurSaisie, 10)
      const actuel = quantiteActuelle(Number(produitId))
      const ecart = compte - actuel
      const signe = ecart > 0 ? `+${ecart}` : ecart
      message += `- ${nomProduit(produitId)} : compté ${compte} (système ${actuel}, écart ${signe})\n`
    })
    message += `\nMerci de valider dans Stockia (Inventaire → Comptage physique).`

    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(message)}`, '_blank')
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

  function nomEmploye(idEmploye) {
    if (!idEmploye) return '—';
    const e = employes.find((e) => String(e.id) === String(idEmploye));
    return e ? e.nom : 'Employé supprimé';
  }
   const produitsFiltres = produits.filter((p) =>
    p.nom.toLowerCase().includes(rechercheProduit.toLowerCase())
  ); 

  const valeurTotale = produits.reduce(
    (total, p) => total + quantiteActuelle(p.id) * Number(p.prix_achat || 0),
    0
  );

  function prixAchatProduit(idProduit) {
    const p = produits.find((p) => String(p.id) === String(idProduit));
    return p ? Number(p.prix_achat || 0) : 0;
  }

  const pertesToutesDates = mouvements.filter(
    (m) => m.type_mouvement === 'Correction inventaire' && Number(m.quantite) < 0
  );

  const pertesFiltrees = (dateDebutPertes && dateFinPertes)
    ? pertesToutesDates.filter((m) => {
        const d = new Date(m.created_at);
        const debut = new Date(dateDebutPertes);
        debut.setHours(0, 0, 0, 0);
        const fin = new Date(dateFinPertes);
        fin.setHours(23, 59, 59, 999);
        return d >= debut && d <= fin;
      })
    : pertesToutesDates;

  const valeurTotalePertes = pertesFiltrees.reduce(
    (total, m) => total + Math.abs(Number(m.quantite)) * prixAchatProduit(m.produit_id),
    0
  );

  function changerComptage(idProduit, valeur) {
    setComptages({ ...comptages, [idProduit]: valeur });
  }

  async function validerComptage() {
    if (!peutValiderComptage) {
      alert('Seul le propriétaire ou un employé avec la permission "Voir les finances" peut valider un comptage.');
      return;
    }

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

  function formaterDateAffichage(dateStr) {
    const [annee, mois, jour] = dateStr.split('-')
    return `${jour}/${mois}/${annee}`
  }

  function handleGenererRapportInventaire() {
    if (!dateDebutRapport || !dateFinRapport) {
      alert('Veuillez choisir une date de début et une date de fin.')
      return
    }
    setGenererEnCours(true)
    try {
      const debut = new Date(dateDebutRapport)
      debut.setHours(0, 0, 0, 0)
      const fin = new Date(dateFinRapport)
      fin.setHours(23, 59, 59, 999)

      const produitsValorisation = produits.map((p) => {
        const qte = quantiteActuelle(p.id)
        return {
          nom: p.nom,
          quantite: qte,
          prixAchat: Number(p.prix_achat || 0),
          valeur: qte * Number(p.prix_achat || 0),
        }
      })

      const mouvementsPeriodeData = mouvements.filter((m) => {
        const d = new Date(m.created_at)
        return d >= debut && d <= fin
      })

      const mouvementsPeriode = mouvementsPeriodeData.map((m) => ({
        date: `${new Date(m.created_at).toLocaleDateString('fr-FR')} ${new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
        produit: nomProduit(m.produit_id),
        type: m.type_mouvement,
        quantite: Number(m.quantite) >= 0 ? `+${m.quantite}` : String(m.quantite),
        motif: m.motif || '',
        employe: nomEmploye(m.employe_id),
      }))

      const corrections = mouvementsPeriodeData
        .filter((m) => m.type_mouvement === 'Correction inventaire')
        .map((m) => ({
          date: new Date(m.created_at).toLocaleDateString('fr-FR'),
          produit: nomProduit(m.produit_id),
          quantite: Number(m.quantite) >= 0 ? `+${m.quantite}` : String(m.quantite),
          motif: m.motif || '',
          employe: nomEmploye(m.employe_id),
        }))

      genererRapportInventairePDF({
        boutiqueNom: nomBoutique,
        dateDebut: formaterDateAffichage(dateDebutRapport),
        dateFin: formaterDateAffichage(dateFinRapport),
        produitsValorisation,
        valeurTotale,
        mouvementsPeriode,
        corrections,
      })
    } finally {
      setGenererEnCours(false)
    }
  }

  if (chargement) return <div className="stock-page">Chargement...</div>;

  return (
    <div className="stock-page">
           <h1>Inventaire</h1>
      <p style={{ color: '#6B6357', fontSize: '13px', marginTop: '-8px', marginBottom: '16px' }}>
        🔄 Relève tous les 3 jours : comptez à deux, l'employé qui termine son tour valide avant de partir.
      </p>

      {peutValiderComptage && (
        <div
          style={{
            backgroundColor: '#EDF1F5',
            border: '1px solid #D6DEE6',
            borderRadius: '10px',
            padding: '12px 16px',
            marginBottom: '16px',
            maxWidth: '500px',
          }}
        >
          <label style={{ display: 'block', fontSize: '12px', color: '#37474F', marginBottom: '6px', fontWeight: 600 }}>
            📲 Numéro WhatsApp du responsable (pour validation à distance d'un comptage)
          </label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <input
              type="tel"
              value={whatsappInput}
              onChange={(e) => setWhatsappInput(e.target.value)}
              placeholder="Ex : 22670000000"
              style={{ padding: '7px 10px', border: '1px solid #E6E0D6', borderRadius: '6px', minWidth: '180px' }}
            />
            <button
              onClick={enregistrerWhatsappResponsable}
              disabled={enregistrementWhatsapp}
              style={{ padding: '7px 14px', border: 'none', borderRadius: '6px', background: '#37474F', color: 'white', cursor: 'pointer' }}
            >
              {enregistrementWhatsapp ? '...' : 'Enregistrer'}
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <button
          onClick={() => setPanneauRapportOuvert(!panneauRapportOuvert)}
          style={{
            padding: '9px 16px',
            backgroundColor: '#C9822A',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontFamily: 'Poppins, Arial, sans-serif',
            fontWeight: 500,
          }}
        >
          📄 Rapport PDF
        </button>
      </div>

      {panneauRapportOuvert && (
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E6E0D6',
            borderRadius: '10px',
            padding: '18px',
            marginBottom: '20px',
            maxWidth: '350px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <h3 style={{ margin: 0 }}>Rapport Inventaire (PDF)</h3>
          <p style={{ margin: 0, fontSize: '13px', color: '#6B6357' }}>
            La valorisation reflète l'état actuel du stock. La période Du/Au ne s'applique qu'aux mouvements et corrections.
          </p>
          <label>
            Du :{' '}
            <input
              type="date"
              value={dateDebutRapport}
              onChange={(e) => setDateDebutRapport(e.target.value)}
              style={{ padding: '6px 8px', border: '1px solid #E6E0D6', borderRadius: '6px' }}
            />
          </label>
          <label>
            Au :{' '}
            <input
              type="date"
              value={dateFinRapport}
              onChange={(e) => setDateFinRapport(e.target.value)}
              style={{ padding: '6px 8px', border: '1px solid #E6E0D6', borderRadius: '6px' }}
            />
          </label>
          <button
            onClick={handleGenererRapportInventaire}
            disabled={genererEnCours}
            style={{
              padding: '9px 16px',
              backgroundColor: '#C9822A',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontFamily: 'Poppins, Arial, sans-serif',
              fontWeight: 500,
            }}
          >
            {genererEnCours ? 'Génération...' : 'Générer le PDF'}
          </button>
        </div>
      )}

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
          Valeur du stock
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
        <button
          className={ongletActif === 'pertes' ? 'actif' : ''}
          onClick={() => setOngletActif('pertes')}
        >
          📉 Pertes
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
          <div
            style={{
              backgroundColor: '#FDECE1',
              border: '1px solid #F3D2B0',
              borderRadius: '10px',
              padding: '14px 18px',
              marginBottom: '18px',
              fontSize: '13px',
              color: '#6B4A1F',
              maxWidth: '600px',
              fontWeight: 600,
              lineHeight: 1.5,
            }}
          >
            ⚠️ Comptez pour de vrai, ne recopiez jamais le chiffre du système. Un écart signalé honnêtement n'est pas une faute — c'est ne pas le signaler qui pose problème.
          </div>
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
          {peutValiderComptage ? (
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
          ) : (
            <div
              style={{
                marginTop: '15px',
                padding: '12px 16px',
                background: '#F2F1EE',
                border: '1px solid #E6E0D6',
                borderRadius: '8px',
                color: '#6B6357',
                fontSize: '13px',
                maxWidth: '500px',
              }}
            >
              🔒 Seul le propriétaire ou un employé avec la permission "Voir les finances" peut valider ce comptage. Envoyez-le au responsable pour validation.
              <div style={{ marginTop: '10px' }}>
                <button
                  onClick={envoyerComptagePourValidation}
                  style={{
                    padding: '10px 18px',
                    backgroundColor: '#25D366',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontFamily: 'Poppins, Arial, sans-serif',
                    fontWeight: 600,
                  }}
                >
                  📲 Envoyer pour validation
                </button>
                <p style={{ fontSize: '12px', color: '#6B6357', marginTop: '6px', marginBottom: 0 }}>
                  Astuce : cliquez aussi sur "Rapport PDF" en haut de la page, puis joignez le fichier téléchargé dans la conversation WhatsApp qui vient de s'ouvrir.
                </p>
              </div>
            </div>
          )}
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
                  <th>Employé</th>
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
                    <td>{nomEmploye(m.employe_id)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {ongletActif === 'pertes' && (
        <>
          <p style={{ color: '#6B6357', marginBottom: '15px' }}>
            Écarts négatifs constatés lors des comptages physiques (quantité comptée inférieure à la quantité système) —
            avec le produit, la valeur perdue et l'employé qui a validé le comptage.
          </p>

          <div
            style={{
              display: 'flex',
              gap: '12px',
              alignItems: 'flex-end',
              flexWrap: 'wrap',
              backgroundColor: 'white',
              border: '1px solid #E6E0D6',
              borderRadius: '10px',
              padding: '14px 16px',
              marginBottom: '20px',
            }}
          >
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#6B6357', marginBottom: '4px' }}>Du</label>
              <input
                type="date"
                value={dateDebutPertes}
                onChange={(e) => setDateDebutPertes(e.target.value)}
                style={{ padding: '7px 10px', border: '1px solid #E6E0D6', borderRadius: '6px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#6B6357', marginBottom: '4px' }}>Au</label>
              <input
                type="date"
                value={dateFinPertes}
                onChange={(e) => setDateFinPertes(e.target.value)}
                style={{ padding: '7px 10px', border: '1px solid #E6E0D6', borderRadius: '6px' }}
              />
            </div>
            {(dateDebutPertes || dateFinPertes) && (
              <button
                onClick={() => { setDateDebutPertes(''); setDateFinPertes('') }}
                style={{
                  padding: '8px 14px',
                  border: '1px solid #E6E0D6',
                  borderRadius: '6px',
                  background: 'white',
                  color: '#6B6357',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                Effacer les dates (tout voir)
              </button>
            )}
          </div>

          {pertesFiltrees.length === 0 ? (
            <p style={{ color: '#6B6357' }}>Aucune perte constatée sur cette période. 🎉</p>
          ) : (
            <table className="stock-tableau">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Produit</th>
                  <th>Quantité perdue</th>
                  <th>Valeur perdue</th>
                  <th>Employé</th>
                  <th>Motif</th>
                </tr>
              </thead>
              <tbody>
                {pertesFiltrees.map((m) => (
                  <tr key={m.id}>
                    <td>
                      {new Date(m.created_at).toLocaleDateString('fr-FR')}{' '}
                      {new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td>{nomProduit(m.produit_id)}</td>
                    <td style={{ color: '#B71C1C', fontWeight: 600 }}>{m.quantite}</td>
                    <td style={{ color: '#B71C1C', fontWeight: 600 }}>
                      {(Math.abs(Number(m.quantite)) * prixAchatProduit(m.produit_id)).toLocaleString('fr-FR')} FCFA
                    </td>
                    <td>{nomEmploye(m.employe_id)}</td>
                    <td>{m.motif}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {pertesFiltrees.length > 0 && (
            <h3 style={{ marginTop: '20px', color: '#B71C1C' }}>
              Total des pertes {(dateDebutPertes || dateFinPertes) ? 'sur cette période' : '(toutes dates)'} :{' '}
              {valeurTotalePertes.toLocaleString('fr-FR')} FCFA
            </h3>
          )}
        </>
      )}
    </div>
  );
}

export default Inventaire;