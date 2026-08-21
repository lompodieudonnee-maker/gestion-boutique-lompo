import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from './supabaseClient';

/**
 * Récupère les ventes d'une boutique sur une période donnée
 * et génère un rapport PDF téléchargeable.
 *
 * @param {string|number} boutiqueId
 * @param {string} dateDebut - format 'YYYY-MM-DD'
 * @param {string} dateFin - format 'YYYY-MM-DD'
 * @param {string} nomBoutique - nom affiché en en-tête du PDF
 */
export async function genererRapportVentesPDF(boutiqueId, dateDebut, dateFin, nomBoutique) {
  // On inclut toute la journée de fin (jusqu'à 23:59:59)
  const dateFinComplete = `${dateFin}T23:59:59`;
  const dateDebutComplete = `${dateDebut}T00:00:00`;

  // 1. Récupérer les ventes de la période
  const { data: ventes, error: erreurVentes } = await supabase
    .from('sales')
    .select('id, created_at, mode_paiement, total')
    .eq('boutique_id', boutiqueId)
    .gte('created_at', dateDebutComplete)
    .lte('created_at', dateFinComplete)
    .order('created_at', { ascending: true });

  if (erreurVentes) {
    throw new Error('Erreur lors de la récupération des ventes : ' + erreurVentes.message);
  }

  if (!ventes || ventes.length === 0) {
    throw new Error('Aucune vente trouvée sur cette période.');
  }

  const idsVentes = ventes.map((v) => v.id);

  // 2. Récupérer les lignes de produits vendus (sale_items) liées à ces ventes
  const { data: lignes, error: erreurLignes } = await supabase
    .from('sale_items')
    .select('sale_id, nom_produit, quantite, prix_unitaire')
    .in('sale_id', idsVentes);

  if (erreurLignes) {
    throw new Error('Erreur lors de la récupération des produits vendus : ' + erreurLignes.message);
  }

  // 3. Récupérer les dépenses et achats fournisseurs de la période (pour le Bénéfice)
  const { data: depenses } = await supabase
    .from('depenses')
    .select('montant')
    .eq('boutique_id', boutiqueId)
    .gte('created_at', dateDebutComplete)
    .lte('created_at', dateFinComplete);

  const { data: achats } = await supabase
    .from('achats')
    .select('montant')
    .eq('boutique_id', boutiqueId)
    .gte('created_at', dateDebutComplete)
    .lte('created_at', dateFinComplete);

  // 4. Calcul des indicateurs
  const chiffreAffaires = ventes.reduce((total, v) => total + Number(v.total || 0), 0);

  const totalCash = ventes
    .filter((v) => v.mode_paiement === 'Espèces')
    .reduce((total, v) => total + Number(v.total || 0), 0);

  const totalMobile = ventes
    .filter((v) => v.mode_paiement === 'Orange Money' || v.mode_paiement === 'Moov Money')
    .reduce((total, v) => total + Number(v.total || 0), 0);

  const totalCredit = ventes
    .filter((v) => v.mode_paiement === 'Crédit client')
    .reduce((total, v) => total + Number(v.total || 0), 0);

  const totalDepenses = (depenses || []).reduce((t, d) => t + Number(d.montant || 0), 0);
  const totalAchats = (achats || []).reduce((t, a) => t + Number(a.montant || 0), 0);
  const benefice = chiffreAffaires - totalDepenses - totalAchats;

  // 5. Génération du PDF
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text('Rapport de ventes - ' + (nomBoutique || 'Boutique'), 14, 18);

  doc.setFontSize(10);
  doc.text(`Période : du ${formaterDate(dateDebut)} au ${formaterDate(dateFin)}`, 14, 25);

  // Tableau des indicateurs
  autoTable(doc, {
    startY: 32,
    head: [['Indicateur', 'Montant (FCFA)']],
    body: [
      ["Chiffre d'affaires", formaterMontant(chiffreAffaires)],
      ['Bénéfice', formaterMontant(benefice)],
      ['Total Cash (Espèces)', formaterMontant(totalCash)],
      ['Total Mobile Money', formaterMontant(totalMobile)],
      ['Total Crédit client', formaterMontant(totalCredit)],
      ['Dépenses', formaterMontant(totalDepenses)],
      ['Achats fournisseurs', formaterMontant(totalAchats)],
    ],
    theme: 'striped',
    headStyles: { fillColor: [230, 145, 30] }, // orange/doré Bloc
  });

  // Tableau détaillé des produits vendus
  const yApresIndicateurs = doc.lastAutoTable.finY + 10;

  doc.setFontSize(12);
  doc.text('Détail des ventes', 14, yApresIndicateurs);

  const lignesTableau = (lignes || []).map((l) => [
    l.nom_produit,
    l.quantite,
    formaterMontant(l.prix_unitaire),
    formaterMontant(l.quantite * l.prix_unitaire),
  ]);

  autoTable(doc, {
    startY: yApresIndicateurs + 4,
    head: [['Produit', 'Qté', 'Prix unit. (FCFA)', 'Total (FCFA)']],
    body: lignesTableau,
    theme: 'grid',
    headStyles: { fillColor: [230, 145, 30] },
  });

  // 6. Téléchargement
  const nomFichier = `rapport-ventes-${dateDebut}-au-${dateFin}.pdf`;
  doc.save(nomFichier);
}

function formaterMontant(montant) {
  return Number(montant || 0).toLocaleString('fr-FR');
}

function formaterDate(dateStr) {
  const [annee, mois, jour] = dateStr.split('-');
  return `${jour}/${mois}/${annee}`;
}