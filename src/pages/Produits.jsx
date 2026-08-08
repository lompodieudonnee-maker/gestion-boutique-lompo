import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

function Produits() {
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

    const { error } = await supabase.from('products').insert([
      {
        nom: nom,
        categorie: categorie,
        prix_achat: parseFloat(prixAchat),
        prix_vente: parseFloat(prixVente),
        quantite: parseInt(quantite),
        seuil_alerte: parseInt(seuilAlerte),
      },
    ])

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
    const confirmation = window.confirm(`Voulez-vous vraiment supprimer "${nomProduit}" ?`)
    if (!confirmation) return

    const { error } = await supabase.from('products').delete().eq('id', id)

    if (error) {
      alert('Erreur lors de la suppression : ' + error.message)
    } else {
      chargerProduits()
    }
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>📦 Gestion des Produits</h1>

      <form
        onSubmit={modeEdition ? enregistrerModification : ajouterProduit}
        style={{ marginBottom: '30px', padding: '15px', border: '1px solid #ccc', borderRadius: '8px' }}
      >
        <h2>{modeEdition ? '✏️ Modifier le produit' : 'Ajouter un produit'}</h2>

        <div style={{ marginBottom: '10px' }}>
          <label>Nom : </label>
          <input value={nom} onChange={(e) => setNom(e.target.value)} required />
        </div>

        <div style={{ marginBottom: '10px' }}>
          <label>Catégorie : </label>
          <input value={categorie} onChange={(e) => setCategorie(e.target.value)} />
        </div>

        <div style={{ marginBottom: '10px' }}>
          <label>Prix d'achat (FCFA) : </label>
          <input type="number" value={prixAchat} onChange={(e) => setPrixAchat(e.target.value)} required />
        </div>

        <div style={{ marginBottom: '10px' }}>
          <label>Prix de vente (FCFA) : </label>
          <input type="number" value={prixVente} onChange={(e) => setPrixVente(e.target.value)} required />
        </div>

        <div style={{ marginBottom: '10px' }}>
          <label>Quantité : </label>
          <input type="number" value={quantite} onChange={(e) => setQuantite(e.target.value)} required />
        </div>

        <div style={{ marginBottom: '10px' }}>
          <label>Seuil d'alerte : </label>
          <input type="number" value={seuilAlerte} onChange={(e) => setSeuilAlerte(e.target.value)} />
        </div>

        <button type="submit">{modeEdition ? 'Enregistrer les modifications' : 'Ajouter le produit'}</button>

        {modeEdition && (
          <button type="button" onClick={reinitialiserFormulaire} style={{ marginLeft: '10px' }}>
            Annuler
          </button>
        )}
      </form>

      <h2>Liste des produits</h2>

      {chargement ? (
        <p>Chargement...</p>
      ) : produits.length === 0 ? (
        <p>Aucun produit pour le moment.</p>
      ) : (
        <table border="1" cellPadding="8" style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Catégorie</th>
              <th>Prix d'achat</th>
              <th>Prix de vente</th>
              <th>Quantité</th>
              <th>Alerte</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {produits.map((p) => (
              <tr key={p.id} style={{ backgroundColor: p.quantite <= p.seuil_alerte ? '#ffe0e0' : 'white' }}>
                <td>{p.nom}</td>
                <td>{p.categorie}</td>
                <td>{p.prix_achat} FCFA</td>
                <td>{p.prix_vente} FCFA</td>
                <td>{p.quantite}</td>
                <td>{p.quantite <= p.seuil_alerte ? '⚠️ Stock faible' : '✅'}</td>
                <td>
                  <button onClick={() => commencerModification(p)}>✏️ Modifier</button>{' '}
                  <button onClick={() => supprimerProduit(p.id, p.nom)}>🗑️ Supprimer</button>
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