import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getBoutiqueId } from '../lib/boutique'
function Produits() {
  const employe = JSON.parse(localStorage.getItem('employeConnecte'))
  const boutiqueId = getBoutiqueId()
  const [produits, setProduits] = useState([])
  const [chargement, setChargement] = useState(true)

  const [nom, setNom] = useState('')
  const [categorie, setCategorie] = useState('')
  const [prixAchat, setPrixAchat] = useState('')
  const [prixVente, setPrixVente] = useState('')
  const [quantite, setQuantite] = useState('')
  const [seuilAlerte, setSeuilAlerte] = useState('')

  const [modeEdition, setModeEdition] = useState(false)
  const [idEnEdition, setIdEnEdition] = useState(null)

  async function chargerProduits() {
    setChargement(true)
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('boutique_id', boutiqueId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Erreur de chargement :', error)
    } else {
      setProduits(data)
    }
    setChargement(false)
  }

  useEffect(() => {
    chargerProduits()
  }, [])

  function reinitialiserFormulaire() {
    setNom('')
    setCategorie('')
    setPrixAchat('')
    setPrixVente('')
    setQuantite('')
    setSeuilAlerte('')
    setModeEdition(false)
    setIdEnEdition(null)
  }

  async function ajouterProduit(e) {
    e.preventDefault()

    const { error } = await supabase.from('products').insert({
      nom: nom,
      categorie: categorie,
      prix_achat: parseFloat(prixAchat),
      prix_vente: parseFloat(prixVente),
      quantite: parseInt(quantite),
      seuil_alerte: parseInt(seuilAlerte),
      boutique_id: boutiqueId,
    })

    if (error) {
      alert('Erreur lors de l\'ajout : ' + error.message)
    } else {
      reinitialiserFormulaire()
      chargerProduits()
    }
  }

  function commencerModification(produit) {
    setModeEdition(true)
    setIdEnEdition(produit.id)
    setNom(produit.nom)
    setCategorie(produit.categorie || '')
    setPrixAchat(produit.prix_achat)
    setPrixVente(produit.prix_vente)
    setQuantite(produit.quantite)
    setSeuilAlerte(produit.seuil_alerte || '')
  }

  async function enregistrerModification(e) {
    e.preventDefault()

    const { error } = await supabase
      .from('products')
      .update({
        nom: nom,
        categorie: categorie,
        prix_achat: parseFloat(prixAchat),
        prix_vente: parseFloat(prixVente),
        quantite: parseInt(quantite),
        seuil_alerte: parseInt(seuilAlerte),
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

  return (
    <div style={{ padding: '20px', fontFamily: 'Poppins, Arial, sans-serif' }}>
      <h1>📦 Gestion des Produits</h1>

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

        <div style={styleChamp}>
          <label>Quantité : </label><br />
          <input style={styleInput} type="number" value={quantite} onChange={(e) => setQuantite(e.target.value)} />
        </div>

        <div style={styleChamp}>
          <label>Seuil d'alerte : </label><br />
          <input style={styleInput} type="number" value={seuilAlerte} onChange={(e) => setSeuilAlerte(e.target.value)} />
        </div>

        <button type="submit" style={styleBoutonPrimaire}>{modeEdition ? 'Enregistrer' : 'Ajouter'}</button>

        {modeEdition && (
          <button type="button" onClick={reinitialiserFormulaire} style={styleBoutonSecondaire}>
            Annuler
          </button>
        )}
      </form>

      <h2>Liste des produits</h2>
  
<p style={{ fontSize: '15px', fontWeight: 600, color: '#2B2620', marginBottom: '16px' }}>
  Bénéfice total du stock : {produits.reduce((total, p) => total + (p.prix_vente - p.prix_achat) * p.quantite, 0).toLocaleString()} FCFA
</p>

      {chargement ? (
        <p style={{ color: '#6B6357' }}>Chargement...</p>
      ) : produits.length === 0 ? (
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
            </tr>
          </thead>
          <tbody>
            {produits.map((p) => (
              <tr key={p.id} style={{ backgroundColor: p.quantite <= p.seuil_alerte ? '#FDECE1' : 'white', borderTop: '1px solid #E6E0D6' }}>
                <td>{p.nom}</td>
                <td>{p.categorie}</td>
                <td>{p.prix_achat} FCFA</td>
                <td>{p.prix_vente} FCFA</td>
                <td>{p.quantite}</td>
                <td>{(p.prix_vente - p.prix_achat).toLocaleString()} FCFA</td>
                <td>{((p.prix_vente - p.prix_achat) * p.quantite).toLocaleString()} FCFA</td>
                <td>{p.quantite <= p.seuil_alerte ? '⚠️' : ''}</td>
                <td>
                  <button style={styleBoutonAction} onClick={() => commencerModification(p)}>Modifier</button>
                  <button style={{ ...styleBoutonAction, color: '#B71C1C' }} onClick={() => supprimerProduit(p.id, p.nom)}>Supprimer</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default Produits