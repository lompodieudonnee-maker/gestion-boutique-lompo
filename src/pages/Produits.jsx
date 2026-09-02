import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getBoutiqueId } from '../lib/boutique'
import { QRCodeSVG } from "qrcode.react";
function Produits() {
  const employe = JSON.parse(localStorage.getItem('employeConnecte'))
  const boutiqueId = getBoutiqueId()
  const [produits, setProduits] = useState([])
  const [mouvements, setMouvements] = useState([])
  const [chargement, setChargement] = useState(true)
  const [recherche, setRecherche] = useState('')

  const [nom, setNom] = useState('')
  const [categorie, setCategorie] = useState('')
  const [prixAchat, setPrixAchat] = useState('')
  const [prixVente, setPrixVente] = useState('')
  const [quantite, setQuantite] = useState('')
  const [seuilAlerte, setSeuilAlerte] = useState('')
  const [codeProduit, setCodeProduit] = useState('')

  const [modeEdition, setModeEdition] = useState(false)
  const [idEnEdition, setIdEnEdition] = useState(null)

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
    const confirmation = window.confirm('Voulez-vous vraiment supprimer ' + nomProduit + ' ?')
    if (!confirmation) return

        const { error } = await supabase.from('products').delete().eq('id', id)
    if (error) {
      alert('Erreur lors de la suppression : ' + error.message)
    } else {
      chargerProduits()
    }
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

  const produitsFiltres = produits.filter((p) =>
    p.nom.toLowerCase().includes(recherche.toLowerCase()) ||
    (p.categorie && p.categorie.toLowerCase().includes(recherche.toLowerCase()))
  )

  return (
    <div style={{ padding: '20px', fontFamily: 'Poppins, Arial, sans-serif' }}>
      <h1>📦 Gestion des Produits</h1>
              <div style={styleChamp}>
          <label>Seuil d'alerte : </label><br />
          <input style={styleInput} type="number" value={seuilAlerte} onChange={(e) => setSeuilAlerte(e.target.value)} />
        </div>

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

        <button type="submit" style={styleBoutonPrimaire}>{modeEdition ? 'Enregistrer' : 'Ajouter'}</button>
                <div style={styleChamp}>
          <label>Code produit (scannez ou laissez vide) : </label><br />
          <input style={styleInput} value={codeProduit} onChange={(e) => setCodeProduit(e.target.value)} placeholder="Laissez vide pour générer un QR" />
        </div>

        {modeEdition && (
          <button type="button" onClick={reinitialiserFormulaire} style={styleBoutonSecondaire}>
            Annuler
          </button>
        )}
      </form>

      <input
        type="text"
        placeholder="🔍 Rechercher un produit..."
        value={recherche}
        onChange={(e) => setRecherche(e.target.value)}
        style={{ ...styleInput, width: '100%', maxWidth: '400px', marginBottom: '16px' }}
      />

      <h2>Liste des produits</h2>

      <p style={{ fontSize: '15px', fontWeight: 600, color: '#2B2620', marginBottom: '4px' }}>
        Valeur totale du stock : {produitsFiltres.reduce((total, p) => total + p.prix_achat * quantiteActuelle(p.id), 0).toLocaleString()} FCFA
      </p>
      <p style={{ fontSize: '15px', fontWeight: 600, color: '#2B2620', marginBottom: '16px' }}>
        Bénéfice total du stock : {produitsFiltres.reduce((total, p) => total + (p.prix_vente - p.prix_achat) * quantiteActuelle(p.id), 0).toLocaleString()} FCFA
      </p>

      {chargement ? (
        <p style={{ color: '#6B6357' }}>Chargement...</p>
      ) : produitsFiltres.length === 0 ? (
        <p style={{ color: '#6B6357' }}>Aucun produit pour le moment.</p>
      ) : (
        <table cellPadding="10" style={{ borderCollapse: 'collapse', width: '100%', backgroundColor: 'white', border: '1px solid #E6E0D6', borderRadius: '10px', overflow: 'hidden' }}>
          <thead>
            <tr style={{ backgroundColor: '#F7F5F2' }}>
              <th style={{ textAlign: 'left', fontSize: '13px', color: '#6B6357' }}>Nom</th>
              <th style={{ textAlign: 'left', fontSize: '13px', color: '#6B6357' }}>Catégorie</th>
              <th style={{ textAlign: 'left', fontSize: '13px', color: '#6B6357' }}>Prix d'achat</th>
              <th style={{ textAlign: 'left', fontSize: '13px', color: '#6B6357' }}>Prix de vente</th>
              <th style={{ textAlign: 'left', fontSize: '13px', color: '#6B6357' }}>Quantité</th>
              <th style={{ textAlign: 'left', fontSize: '13px', color: '#6B6357' }}>Bénéfice unit.</th>
              <th style={{ textAlign: 'left', fontSize: '13px', color: '#6B6357' }}>Bénéfice total</th>
              <th style={{ textAlign: 'left', fontSize: '13px', color: '#6B6357' }}>Alerte</th>
              <th style={{ textAlign: 'left', fontSize: '13px', color: '#6B6357' }}>Actions</th>
                            <th style={{ textAlign: 'left', fontSize: '13px', color: '#6B6357' }}>Code</th>
              <th style={{ textAlign: 'left', fontSize: '13px', color: '#6B6357' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {produitsFiltres.map((p) => {
              const qte = quantiteActuelle(p.id)
              return (
                <tr key={p.id} style={{ backgroundColor: qte <= p.seuil_alerte ? '#FDECE1' : 'white', borderTop: '1px solid #E6E0D6' }}>
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
                    <button style={styleBoutonAction} onClick={() => commencerModification(p)}>Modifier</button>
                    <button style={{ ...styleBoutonAction, color: '#B71C1C' }} onClick={() => supprimerProduit(p.id, p.nom)}>Supprimer</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default Produits