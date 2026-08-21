import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
function formaterMontant(nombre) { return nombre.toLocaleString('fr-FR').replace(/\u202F|\u00A0/g, ' ') }

export function genererRapportVentesPDF({ boutiqueNom, dateDebut, dateFin, indicateurs, ventesDetail }) {
  const doc = new jsPDF()

  // En-tête
  doc.setFontSize(18)
  doc.setTextColor(201, 130, 42) // #C9822A
  doc.text('Bloc - Rapport de ventes', 14, 18)

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
    headStyles: { fillColor: [201, 130, 42] },
    body: indicateurs.map((i) => [i.label, formaterMontant(i.valeur)]),
    headStyles: { fillColor: [201, 130, 42] },
    styles: { fontSize: 10 },
  })

  // Tableau détaillé des ventes
  const yApresIndicateurs = doc.lastAutoTable.finalY + 10
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
      head: [['Date', 'Produits vendus', 'Mode de paiement', 'Montant (FCFA)']],
      body: ventesDetail.map((v) => [v.date, v.produits, v.modePaiement, formaterMontant(v.montant)]),
      headStyles: { fillColor: [55, 71, 79] },
      styles: { fontSize: 9 },
      columnStyles: { 1: { cellWidth: 70 } },
    })
  }

  const nomFichier = `rapport-ventes-${dateDebut.replaceAll('/', '-')}-au-${dateFin.replaceAll('/', '-')}.pdf`
  doc.save(nomFichier)
}