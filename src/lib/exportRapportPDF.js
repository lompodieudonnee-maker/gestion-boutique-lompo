import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

function formaterMontant(nombre) {
  return nombre.toLocaleString('fr-FR').replace(/\u202F|\u00A0/g, ' ')
}

function verifierSautDePage(doc, y, espaceNecessaire = 40) {
  const hauteurPage = doc.internal.pageSize.height
  if (y > hauteurPage - espaceNecessaire) {
    doc.addPage()
    return 20
  }
  return y
}

export function genererRapportVentesPDF({ boutiqueNom, dateDebut, dateFin, indicateurs, produitsVendus, ventesDetail }) {
  const doc = new jsPDF()

  // En-tête
  doc.setFontSize(18)
  doc.setTextColor(201, 130, 42) // #C9822A
  doc.text('Stockia - Rapport de ventes', 14, 18)

  doc.setFontSize(11)
  doc.setTextColor(60, 60, 60)
  doc.text(`Boutique : ${boutiqueNom}`, 14, 27)
  doc.text(`Période : du ${dateDebut} au ${dateFin}`, 14, 33)
  doc.text(
    `Généré le : ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
    14,
    39
  )

  // Tableau des indicateurs
  autoTable(doc, {
    startY: 46,
    head: [['Indicateur', 'Montant (FCFA)']],
    body: indicateurs.map((i) => [i.label, formaterMontant(i.valeur)]),
    headStyles: { fillColor: [201, 130, 42] },
    styles: { fontSize: 10 },
  })

  // Tableau des produits vendus, cumulés sur toute la période (un seul total par produit,
  // même s'il a été vendu plusieurs fois dans la journée)
  let yProduits = doc.lastAutoTable.finalY + 10
  doc.setFontSize(13)
  doc.setTextColor(43, 38, 32)
  doc.text('Produits vendus (total période)', 14, yProduits)

  if (!produitsVendus || produitsVendus.length === 0) {
    doc.setFontSize(10)
    doc.setTextColor(107, 99, 87)
    doc.text('Aucune vente sur cette période.', 14, yProduits + 8)
    yProduits += 16
  } else {
    autoTable(doc, {
      startY: yProduits + 5,
      head: [['Produit', 'Quantité totale', 'Montant total (FCFA)']],
      body: produitsVendus.map((p) => [p.nom, String(p.quantite), formaterMontant(p.montant)]),
      headStyles: { fillColor: [201, 130, 42] },
      styles: { fontSize: 9 },
    })
    yProduits = doc.lastAutoTable.finalY + 12
  }

  // Tableau détaillé des ventes (une ligne par vente, avec l'heure)
  const yApresIndicateurs = verifierSautDePage(doc, yProduits, 50)
  doc.setFontSize(13)
  doc.setTextColor(43, 38, 32)
  doc.text('Détail des ventes', 14, yApresIndicateurs)

  if (ventesDetail.length === 0) {
    doc.setFontSize(10)
    doc.setTextColor(107, 99, 87)
    doc.text('Aucune vente sur cette période.', 14, yApresIndicateurs + 8)
  } else {
    autoTable(doc, {
      startY: yApresIndicateurs + 5,
      head: [['Date', 'Produits vendus', 'Vendeur', 'Mode de paiement', 'Montant (FCFA)']],
      body: ventesDetail.map((v) => [v.date, v.produits, v.vendeur || '—', v.modePaiement, formaterMontant(v.montant)]),
      headStyles: { fillColor: [55, 71, 79] },
      styles: { fontSize: 9 },
      columnStyles: { 1: { cellWidth: 60 } },
    })
  }

  const nomFichier = `rapport-ventes-${dateDebut.replaceAll('/', '-')}-au-${dateFin.replaceAll('/', '-')}.pdf`
  doc.save(nomFichier)
}

export function genererRapportInventairePDF({
  boutiqueNom,
  dateDebut,
  dateFin,
  produitsValorisation,
  valeurTotale,
  mouvementsPeriode,
  corrections,
}) {
  const doc = new jsPDF()

  // En-tête
  doc.setFontSize(18)
  doc.setTextColor(201, 130, 42)
  doc.text('Stockia - Rapport Inventaire', 14, 18)

  doc.setFontSize(11)
  doc.setTextColor(60, 60, 60)
  doc.text(`Boutique : ${boutiqueNom}`, 14, 27)
  doc.text(`Mouvements de la période : du ${dateDebut} au ${dateFin}`, 14, 33)
  doc.text(
    `Généré le : ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
    14,
    39
  )

  // Section 1 — Valorisation (état actuel du stock)
  doc.setFontSize(13)
  doc.setTextColor(43, 38, 32)
  doc.text('Valorisation du stock (état actuel)', 14, 48)

  autoTable(doc, {
    startY: 53,
    head: [['Produit', 'Quantité', "Prix d'achat", 'Valeur (FCFA)']],
    body: produitsValorisation.map((p) => [p.nom, String(p.quantite), formaterMontant(p.prixAchat), formaterMontant(p.valeur)]),
    headStyles: { fillColor: [201, 130, 42] },
    styles: { fontSize: 9 },
  })

  let y = doc.lastAutoTable.finalY + 8
  doc.setFontSize(11)
  doc.setTextColor(43, 38, 32)
  doc.text(`Valeur totale du stock : ${formaterMontant(valeurTotale)} FCFA`, 14, y)
  y += 12

  // Section 2 — Historique des mouvements (période)
  y = verifierSautDePage(doc, y, 50)
  doc.setFontSize(13)
  doc.setTextColor(43, 38, 32)
  doc.text('Mouvements de stock (période)', 14, y)
  y += 5

  if (mouvementsPeriode.length === 0) {
    doc.setFontSize(10)
    doc.setTextColor(107, 99, 87)
    doc.text('Aucun mouvement sur cette période.', 14, y + 6)
    y += 16
  } else {
    autoTable(doc, {
      startY: y + 3,
      head: [['Date', 'Produit', 'Type', 'Quantité', 'Motif', 'Employé']],
      body: mouvementsPeriode.map((m) => [m.date, m.produit, m.type, m.quantite, m.motif, m.employe]),
      headStyles: { fillColor: [55, 71, 79] },
      styles: { fontSize: 7.5 },
    })
    y = doc.lastAutoTable.finalY + 12
  }

  // Section 3 — Corrections d'inventaire / écarts (période)
  y = verifierSautDePage(doc, y, 50)
  doc.setFontSize(13)
  doc.setTextColor(43, 38, 32)
  doc.text("Corrections d'inventaire / écarts (période)", 14, y)
  y += 5

  if (corrections.length === 0) {
    doc.setFontSize(10)
    doc.setTextColor(107, 99, 87)
    doc.text("Aucune correction d'inventaire sur cette période.", 14, y + 6)
  } else {
    autoTable(doc, {
      startY: y + 3,
      head: [['Date', 'Produit', 'Écart', 'Motif', 'Employé']],
      body: corrections.map((c) => [c.date, c.produit, c.quantite, c.motif, c.employe]),
      headStyles: { fillColor: [183, 28, 28] },
      styles: { fontSize: 8 },
    })
  }

  const nomFichier = `rapport-inventaire-${dateDebut.replaceAll('/', '-')}-au-${dateFin.replaceAll('/', '-')}.pdf`
  doc.save(nomFichier)
}