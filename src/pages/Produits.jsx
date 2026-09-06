import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getBoutiqueId } from '../lib/boutique'
import { QRCodeSVG } from "qrcode.react";
import ScannerProduit from "../ScannerProduit";

function Produits() {
  const employe = JSON.parse(localStorage.getItem('employeConnecte'))
  const boutiqueId = getBoutiqueId()
  const [produits, setProduits] = useState([])
  const [mouvements, setMouvements] = useState([])
  const [chargement, setChargement] = useState(true)
  const [recherche, setRecherche] = useState('')
  const [voirArchives, setVoirArchives] = useState(false)

  const [nom, setNom] = useState('')
  const [categorie, setCategorie] = useState('')
  const [prixAchat, setPrixAchat] = useState('')
  const [prixVente, setPrixVente] = useState('')
  const [quantite, setQuantite] = useState('')
  const [seuilAlerte, setSeuilAlerte] = useState('')
  const [codeProduit, setCodeProduit] = useState('')
  const [scannerOuvert, setScannerOuvert] = useState(false)

  const [modeEdition, setModeEdition] = useState(false)
  const [idEnEdition, setIdEnEdition] = useState(null)

  const [produitsSelectionnes, setProduitsSelectionnes] = useState([])
  const [impressionOuverte, setImpressionOuverte] = useState(false)
  const [preparationEtiquettes, setPreparationEtiquettes] = useState(false)

  async function chargerProduits() {
    setChargement(true)
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('boutique_id', boutiqueId)
      .order('created_at', { ascending: false })

    const { data: mouvementsData } = await supabase
      .from('stock_mouvements')
      .select('produit_id, quantite')
      .eq('boutique_id', boutiqueId)

    if (error) {
      console.error('Erreur de chargement :', error)
    } else {
      setProduits(data)
    }
    setMouvements(mouvementsData || [])
    setChargement(false)
  }

  useEffect(() => {
    chargerProduits()
  }, [])

  function quantiteActuelle(idProduit) {
    return mouvements
      .filter((m) => String(m.produit_id) === String(idProduit))
      .reduce((total, m) => total + Number(m.quantite), 0)
  }

    function reinitialiserFormulaire() {
    setNom('')
    setCategorie('')
    setPrixAchat('')
    setPrixVente('')
    setQuantite('')
    setSeuilAlerte('')
    setCodeProduit('')
    setModeEdition(false)
    setIdEnEdition(null)
  }

  function genererCodeAuto() {
    return "STK-" + Date.now().toString().slice(-8)
  }

  function gererCodeScanne(code) {
    setCodeProduit(code)
    setScannerOuvert(false)
  }

  async function ajouterProduit(e) {
    e.preventDefault()

        const codeFinal = codeProduit.trim() || genererCodeAuto()

    const { data: nouveauProduit, error } = await supabase.from('products').insert({
      nom: nom,
      categorie: categorie,
      prix_achat: parseFloat(prixAchat),
      prix_vente: parseFloat(prixVente),
      quantite: 0,
      seuil_alerte: parseInt(seuilAlerte),
      boutique_id: boutiqueId,
      code_produit: codeFinal,
    }).select().single()
    if (error) {
      alert('Erreur lors de l\'ajout : ' + error.message)
      return
    }

    const quantiteInitiale = parseInt(quantite) || 0
    if (quantiteInitiale > 0) {
      await supabase.from('stock_mouvements').insert({
        boutique_id: boutiqueId,
        produit_id: nouveauProduit.id,
        employe_id: employe?.id,
        type_mouvement: 'Entrée',
        quantite: quantiteInitiale,
        motif: 'Stock initial à la création du produit',
      })
    }

    reinitialiserFormulaire()
    chargerProduits()
  }

    function commencerModification(produit) {
    setModeEdition(true)
    setIdEnEdition(produit.id)
    setNom(produit.nom)
    setCategorie(produit.categorie || '')
    setPrixAchat(produit.prix_achat)
    setPrixVente(produit.prix_vente)
    setQuantite('')
    setSeuilAlerte(produit.seuil_alerte || '')
    setCodeProduit(produit.code_produit || '')
  }

  async function enregistrerModification(e) {
    e.preventDefault()

        const codeFinal = codeProduit.trim() || genererCodeAuto()

    const { error } = await supabase
      .from('products')
      .update({
        nom: nom,
        categorie: categorie,
        prix_achat: parseFloat(prixAchat),
        prix_vente: parseFloat(prixVente),
        seuil_alerte: parseInt(seuilAlerte),
        code_produit: codeFinal,
      })
      .eq('id', idEnEdition)

    if (error) {
      alert('Erreur lors de la modification : ' + error.message)
    } else {
      reinitialiserFormulaire()
      chargerProduits()
    }
  }

  async function supprimerProduit(id, nomProduit) {
    const confirmation = window.confirm(
      'Voulez-vous vraiment supprimer ' + nomProduit + ' ? Si ce produit a déjà un historique (ventes, mouvements), il sera archivé à la place d\'être supprimé.'
    )
    if (!confirmation) return

    const { error } = await supabase.from('products').delete().eq('id', id)

    if (error) {
      if (error.code === '23503') {
        // Contrainte de clé étrangère : ce produit a un historique, on l'archive à la place.
        const { error: erreurArchive } = await supabase
          .from('products')
          .update({ actif: false })
          .eq('id', id)

        if (erreurArchive) {
          alert("Erreur lors de l'archivage : " + erreurArchive.message)
        } else {
          alert(
            nomProduit +
              " a un historique et ne peut pas être supprimé définitivement. Il a été archivé à la place : il n'apparaîtra plus dans vos listes actives (Caisse, etc.), mais son historique est conservé."
          )
          chargerProduits()
        }
      } else {
        alert('Erreur lors de la suppression : ' + error.message)
      }
    } else {
      chargerProduits()
    }
  }

  async function reactiverProduit(id) {
    const { error } = await supabase.from('products').update({ actif: true }).eq('id', id)
    if (error) {
      alert('Erreur : ' + error.message)
    } else {
      chargerProduits()
    }
  }

  // ============================================================
  // ÉTIQUETTES (QR code à imprimer et coller sur le produit)
  // ============================================================

  function basculerSelectionProduit(id) {
    setProduitsSelectionnes((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  function basculerToutSelectionner(listeProduits) {
    const idsVisibles = listeProduits.map((p) => p.id)
    const touslsSelectionnes = idsVisibles.every((id) => produitsSelectionnes.includes(id))
    if (touslsSelectionnes) {
      setProduitsSelectionnes((prev) => prev.filter((id) => !idsVisibles.includes(id)))
    } else {
      setProduitsSelectionnes((prev) => Array.from(new Set([...prev, ...idsVisibles])))
    }
  }

  async function ouvrirImpressionEtiquettes() {
    if (produitsSelectionnes.length === 0) {
      alert('Sélectionnez au moins un produit (case à cocher) pour imprimer ses étiquettes.')
      return
    }

    setPreparationEtiquettes(true)

    // Certains produits (créés avant cette fonctionnalité) peuvent ne pas avoir de code_produit :
    // on leur en génère un et on l'enregistre avant impression, pour qu'aucun produit sélectionné
    // ne se retrouve sans QR code sur son étiquette.
    const produitsSansCode = produits.filter(
      (p) => produitsSelectionnes.includes(p.id) && !p.code_produit
    )

    for (const p of produitsSansCode) {
      await supabase.from('products').update({ code_produit: genererCodeAuto() }).eq('id', p.id)
    }

    if (produitsSansCode.length > 0) {
      await chargerProduits()
    }

    setPreparationEtiquettes(false)
    setImpressionOuverte(true)
  }

  function lancerImpression() {
    window.print()
  }

  const styleChamp = { marginBottom: '12px' }
  const styleInput = {
    padding: '9px 12px',
    border: '1px solid #E6E0D6',
    borderRadius: '8px',
    fontFamily: 'Poppins, Arial, sans-serif',
    fontSize: '14px',
    width: '260px',
  }
  const styleBoutonPrimaire = {
    padding: '10px 20px',
    backgroundColor: '#C9822A',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontFamily: 'Poppins, Arial, sans-serif',
    fontWeight: 500,
    marginRight: '10px',
  }
  const styleBoutonSecondaire = {
    padding: '10px 20px',
    backgroundColor: 'transparent',
    color: '#6B6357',
    border: '1px solid #E6E0D6',
    borderRadius: '8px',
    cursor: 'pointer',
    fontFamily: 'Poppins, Arial, sans-serif',
  }
  const styleBoutonAction = {
    padding: '6px 12px',
    border: '1px solid #E6E0D6',
    borderRadius: '6px',
    background: 'white',
    cursor: 'pointer',
    fontFamily: 'Poppins, Arial, sans-serif',
    fontSize: '13px',
    marginRight: '6px',
  }

  const produitsVisibles = produits.filter((p) => (voirArchives ? p.actif === false : p.actif !== false))

  const produitsFiltres = produitsVisibles.filter((p) =>
    p.nom.toLowerCase().includes(recherche.toLowerCase()) ||
    (p.categorie && p.categorie.toLowerCase().includes(recherche.toLowerCase()))
  )

  return (
    <div style={{ padding: '20px', fontFamily: 'Poppins, Arial, sans-serif' }}>
      <h1>📦 Gestion des Produits</h1>

      {!voirArchives && (
        <form
          onSubmit={modeEdition ? enregistrerModification : ajouterProduit}
          style={{ marginBottom: '30px', padding: '20px', backgroundColor: 'white', border: '1px solid #E6E0D6', borderRadius: '10px', boxShadow: '0 2px 8px rgba(43, 38, 32, 0.06)' }}
        >
          <h2>{modeEdition ? '✏️ Modifier le produit' : '➕ Ajouter un produit'}</h2>

          <div style={styleChamp}>
            <label>Nom : </label><br />
            <input style={styleInput} value={nom} onChange={(e) => setNom(e.target.value)} />
          </div>

          <div style={styleChamp}>
            <label>Catégorie : </label><br />
            <input style={styleInput} value={categorie} onChange={(e) => setCategorie(e.target.value)} />
          </div>

          <div style={styleChamp}>
            <label>Prix d'achat (FCFA) : </label><br />
            <input style={styleInput} type="number" value={prixAchat} onChange={(e) => setPrixAchat(e.target.value)} />
          </div>

          <div style={styleChamp}>
            <label>Prix de vente (FCFA) : </label><br />
            <input style={styleInput} type="number" value={prixVente} onChange={(e) => setPrixVente(e.target.value)} />
          </div>

          {!modeEdition && (
            <div style={styleChamp}>
              <label>Quantité initiale : </label><br />
              <input style={styleInput} type="number" value={quantite} onChange={(e) => setQuantite(e.target.value)} />
            </div>
          )}

          {modeEdition && (
            <p style={{ fontSize: '13px', color: '#6B6357', maxWidth: '260px' }}>
              Pour changer la quantité de ce produit, utilisez Fournisseurs (achat) ou Inventaire → Entrée/Sortie.
            </p>
          )}

          <div style={styleChamp}>
            <label>Seuil d'alerte : </label><br />
            <input style={styleInput} type="number" value={seuilAlerte} onChange={(e) => setSeuilAlerte(e.target.value)} />
          </div>

          <div style={styleChamp}>
            <label>Code produit (scannez ou laissez vide) : </label><br />
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                style={{ ...styleInput, width: '190px' }}
                value={codeProduit}
                onChange={(e) => setCodeProduit(e.target.value)}
                placeholder="Laissez vide pour générer un QR"
              />
              <button
                type="button"
                onClick={() => setScannerOuvert(true)}
                style={{
                  padding: '9px 14px',
                  background: '#B8860B',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 'bold',
                  cursor: 'pointer',
                }}
              >
                📷
              </button>
            </div>
          </div>

          <button type="submit" style={styleBoutonPrimaire}>{modeEdition ? 'Enregistrer' : 'Ajouter'}</button>

          {modeEdition && (
            <button type="button" onClick={reinitialiserFormulaire} style={styleBoutonSecondaire}>
              Annuler
            </button>
          )}
        </form>
      )}

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px' }}>
        <input
          type="text"
          placeholder="🔍 Rechercher un produit..."
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          style={{ ...styleInput, width: '100%', maxWidth: '400px' }}
        />
        <button
          type="button"
          onClick={() => setVoirArchives(!voirArchives)}
          style={{
            padding: '9px 16px',
            backgroundColor: voirArchives ? '#37474F' : 'white',
            color: voirArchives ? 'white' : '#6B6357',
            border: '1px solid #E6E0D6',
            borderRadius: '8px',
            cursor: 'pointer',
            fontFamily: 'Poppins, Arial, sans-serif',
            fontWeight: 500,
            whiteSpace: 'nowrap',
          }}
        >
          {voirArchives ? '← Retour aux produits actifs' : '🗄️ Voir les archivés'}
        </button>

        {!voirArchives && (
          <button
            type="button"
            onClick={ouvrirImpressionEtiquettes}
            disabled={preparationEtiquettes}
            style={{
              padding: '9px 16px',
              backgroundColor: produitsSelectionnes.length > 0 ? '#C9822A' : '#E6E0D6',
              color: produitsSelectionnes.length > 0 ? 'white' : '#6B6357',
              border: 'none',
              borderRadius: '8px',
              cursor: produitsSelectionnes.length > 0 ? 'pointer' : 'default',
              fontFamily: 'Poppins, Arial, sans-serif',
              fontWeight: 500,
              whiteSpace: 'nowrap',
            }}
          >
            {preparationEtiquettes
              ? 'Préparation...'
              : `🖨️ Imprimer les étiquettes${produitsSelectionnes.length > 0 ? ' (' + produitsSelectionnes.length + ')' : ''}`}
          </button>
        )}
      </div>

      <h2>{voirArchives ? 'Produits archivés' : 'Liste des produits'}</h2>

      {!voirArchives && (
        <>
          <p style={{ fontSize: '15px', fontWeight: 600, color: '#2B2620', marginBottom: '4px' }}>
            Valeur totale du stock : {produitsFiltres.reduce((total, p) => total + p.prix_achat * quantiteActuelle(p.id), 0).toLocaleString()} FCFA
          </p>
          <p style={{ fontSize: '15px', fontWeight: 600, color: '#2B2620', marginBottom: '16px' }}>
            Bénéfice total du stock : {produitsFiltres.reduce((total, p) => total + (p.prix_vente - p.prix_achat) * quantiteActuelle(p.id), 0).toLocaleString()} FCFA
          </p>
        </>
      )}

      {chargement ? (
        <p style={{ color: '#6B6357' }}>Chargement...</p>
      ) : produitsFiltres.length === 0 ? (
        <p style={{ color: '#6B6357' }}>{voirArchives ? 'Aucun produit archivé.' : 'Aucun produit pour le moment.'}</p>
      ) : (
        <table cellPadding="10" style={{ borderCollapse: 'collapse', width: '100%', backgroundColor: 'white', border: '1px solid #E6E0D6', borderRadius: '10px', overflow: 'hidden' }}>
          <thead>
            <tr style={{ backgroundColor: '#F7F5F2' }}>
              {!voirArchives && (
                <th style={{ textAlign: 'center', fontSize: '13px', color: '#6B6357' }}>
                  <input
                    type="checkbox"
                    checked={produitsFiltres.length > 0 && produitsFiltres.every((p) => produitsSelectionnes.includes(p.id))}
                    onChange={() => basculerToutSelectionner(produitsFiltres)}
                    title="Tout sélectionner"
                  />
                </th>
              )}
              <th style={{ textAlign: 'left', fontSize: '13px', color: '#6B6357' }}>Nom</th>
              <th style={{ textAlign: 'left', fontSize: '13px', color: '#6B6357' }}>Catégorie</th>
              <th style={{ textAlign: 'left', fontSize: '13px', color: '#6B6357' }}>Prix d'achat</th>
              <th style={{ textAlign: 'left', fontSize: '13px', color: '#6B6357' }}>Prix de vente</th>
              <th style={{ textAlign: 'left', fontSize: '13px', color: '#6B6357' }}>Quantité</th>
              <th style={{ textAlign: 'left', fontSize: '13px', color: '#6B6357' }}>Bénéfice unit.</th>
              <th style={{ textAlign: 'left', fontSize: '13px', color: '#6B6357' }}>Bénéfice total</th>
              <th style={{ textAlign: 'left', fontSize: '13px', color: '#6B6357' }}>Alerte</th>
              <th style={{ textAlign: 'left', fontSize: '13px', color: '#6B6357' }}>Code</th>
              <th style={{ textAlign: 'left', fontSize: '13px', color: '#6B6357' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {produitsFiltres.map((p) => {
              const qte = quantiteActuelle(p.id)
              return (
                <tr key={p.id} style={{ backgroundColor: qte <= p.seuil_alerte ? '#FDECE1' : 'white', borderTop: '1px solid #E6E0D6' }}>
                  {!voirArchives && (
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={produitsSelectionnes.includes(p.id)}
                        onChange={() => basculerSelectionProduit(p.id)}
                      />
                    </td>
                  )}
                  <td>{p.nom}</td>
                  <td>{p.categorie}</td>
                  <td>{p.prix_achat} FCFA</td>
                  <td>{p.prix_vente} FCFA</td>
                  <td>{qte}</td>
                  <td>{(p.prix_vente - p.prix_achat).toLocaleString()} FCFA</td>
                  <td>{((p.prix_vente - p.prix_achat) * qte).toLocaleString()} FCFA</td>
                                    <td>{qte <= p.seuil_alerte ? '⚠️' : ''}</td>
                  <td>
                    {p.code_produit && (
                      <div style={{ textAlign: 'center' }}>
                        <QRCodeSVG value={p.code_produit} size={60} />
                        <p style={{ fontSize: 10 }}>{p.code_produit}</p>
                      </div>
                    )}
                  </td>
                  <td>
                    {voirArchives ? (
                      <button style={styleBoutonAction} onClick={() => reactiverProduit(p.id)}>Réactiver</button>
                    ) : (
                      <>
                        <button style={styleBoutonAction} onClick={() => commencerModification(p)}>Modifier</button>
                        <button style={{ ...styleBoutonAction, color: '#B71C1C' }} onClick={() => supprimerProduit(p.id, p.nom)}>Supprimer</button>
                      </>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {scannerOuvert && (
        <ScannerProduit
          onScan={gererCodeScanne}
          onClose={() => setScannerOuvert(false)}
        />
      )}

      {impressionOuverte && (
        <>
          <style>{`
            @media print {
              body * { visibility: hidden; }
              #zone-etiquettes-impression, #zone-etiquettes-impression * { visibility: visible; }
              #zone-etiquettes-impression {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                margin: 0;
                padding: 10mm;
              }
              @page { margin: 8mm; }
            }
          `}</style>

          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(43, 38, 32, 0.85)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '20px',
            }}
          >
            <div
              style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '20px',
                maxWidth: '820px',
                width: '100%',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                fontFamily: 'Poppins, Arial, sans-serif',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 style={{ margin: 0 }}>
                  🖨️ Étiquettes à imprimer ({produitsSelectionnes.length})
                </h3>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={lancerImpression}
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
                    Imprimer
                  </button>
                  <button
                    onClick={() => setImpressionOuverte(false)}
                    style={{
                      padding: '9px 16px',
                      border: '1px solid #E6E0D6',
                      borderRadius: '8px',
                      background: 'white',
                      color: '#6B6357',
                      cursor: 'pointer',
                      fontFamily: 'Poppins, Arial, sans-serif',
                      fontWeight: 500,
                    }}
                  >
                    Fermer
                  </button>
                </div>
              </div>

              <p style={{ fontSize: '13px', color: '#6B6357', marginTop: 0, marginBottom: '14px' }}>
                Aperçu avant impression. Chaque étiquette contient le QR code du produit, son nom et son prix de vente — à découper et coller sur le produit.
              </p>

              <div style={{ overflowY: 'auto', border: '1px solid #E6E0D6', borderRadius: '8px', padding: '10px' }}>
                <div
                  id="zone-etiquettes-impression"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, 50mm)',
                    gap: '3mm',
                    justifyContent: 'start',
                  }}
                >
                  {produits
                    .filter((p) => produitsSelectionnes.includes(p.id))
                    .map((p) => (
                      <div
                        key={p.id}
                        style={{
                          width: '50mm',
                          height: '32mm',
                          border: '1px dashed #B8AFA0',
                          borderRadius: '2mm',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '2mm',
                          padding: '2mm',
                          boxSizing: 'border-box',
                          breakInside: 'avoid',
                        }}
                      >
                        {p.code_produit && <QRCodeSVG value={p.code_produit} size={64} />}
                        <div style={{ overflow: 'hidden' }}>
                          <div
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              color: '#2B2620',
                              lineHeight: 1.2,
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                          >
                            {p.nom}
                          </div>
                          <div style={{ fontSize: '11px', fontWeight: 700, color: '#B5691F', marginTop: '2mm' }}>
                            {Number(p.prix_vente).toLocaleString('fr-FR')} FCFA
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default Produits