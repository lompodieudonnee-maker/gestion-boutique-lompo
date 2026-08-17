import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import './Stock.css'

function Proforma() {
  const employe = JSON.parse(localStorage.getItem('employeConnecte'))
  const boutiqueId = employe?.boutique_id

  const [produits, setProduits] = useState([])
  const [clients, setClients] = useState([])
  const [commandesClient, setCommandesClient] = useState([])
  const [proformas, setProformas] = useState([])

  const [clientSelectionne, setClientSelectionne] = useState('')
  const [panier, setPanier] = useState([])

  const [proformaOuvert, setProformaOuvert] = useState(null)

  const [chargement, setChargement] = useState(true)

  useEffect(() => {
    chargerTout()
  }, [])

  async function chargerTout() {
    setChargement(true)

    const { data: produitsData } = await supabase
      .from('products')
      .select('id, nom, prix_vente')
      .eq('boutique_id', boutiqueId)
    setProduits(produitsData || [])

    const { data: clientsData } = await supabase
      .from('clients')
      .select('id, nom')
      .eq('boutique_id', boutiqueId)
    setClients(clientsData || [])

    const { data: commandesData } = await supabase
      .from('commandes_client')
      .select('*, clients(nom), commande_client_items(*, products(nom))')
      .eq('boutique_id', boutiqueId)
      .order('created_at', { ascending: false })
    setCommandesClient(commandesData || [])

    await chargerProformas()

    setChargement(false)
  }

  async function chargerProformas() {
    const { data } = await supabase
      .from('proformas')
      .select('*, clients(nom), proforma_items(*, products(nom))')
      .eq('boutique_id', boutiqueId)
      .order('created_at', { ascending: false })
    setProformas(data || [])
  }

  // --- Panier (création indépendante) ---
  function ajouterAuPanier(produit) {
    const existe = panier.find((i) => i.id === produit.id)
    if (existe) {
      setPanier(panier.map((i) => (i.id === produit.id ? { ...i, quantite: i.quantite + 1 } : i)))
    } else {
      setPanier([...panier, { ...produit, quantite: 1 }])
    }
  }

  function changerQuantite(id, quantite) {
    if (quantite < 1) return
    setPanier(panier.map((i) => (i.id === id ? { ...i, quantite } : i)))
  }

  function retirerDuPanier(id) {
    setPanier(panier.filter((i) => i.id !== id))
  }

  async function creerProforma() {
    if (panier.length === 0) {
      alert('Le panier est vide')
      return
    }

    const { data: proforma, error } = await supabase
      .from('proformas')
      .insert({
        boutique_id: boutiqueId,
        client_id: clientSelectionne || null,
        employe_id: employe?.id,
      })
      .select()
      .single()

    if (error) {
      alert('Erreur : ' + error.message)
      return
    }

    const lignes = panier.map((item) => ({
      proforma_id: proforma.id,
      produit_id: item.id,
      quantite: item.quantite,
      prix_unitaire: item.prix_vente,
    }))

    const { error: erreurItems } = await supabase.from('proforma_items').insert(lignes)

    if (erreurItems) {
      alert('Erreur lors de l\'enregistrement des articles : ' + erreurItems.message)
      return
    }

    setPanier([])
    setClientSelectionne('')
    chargerProformas()
    alert('Proforma créé.')
  }

  // --- Génération depuis une commande existante ---
  async function genererProformaDepuisCommande(commande) {
    const { data: proforma, error } = await supabase
      .from('proformas')
      .insert({
        boutique_id: boutiqueId,
        client_id: commande.client_id,
        employe_id: employe?.id,
        commande_id: commande.id,
      })
      .select()
      .single()

    if (error) {
      alert('Erreur : ' + error.message)
      return
    }

    const lignes = commande.commande_client_items.map((item) => ({
      proforma_id: proforma.id,
      produit_id: item.produit_id,
      quantite: item.quantite,
      prix_unitaire: item.prix_unitaire,
    }))

    const { error: erreurItems } = await supabase.from('proforma_items').insert(lignes)

    if (erreurItems) {
      alert('Erreur lors de l\'enregistrement des articles : ' + erreurItems.message)
      return
    }

    chargerProformas()
    alert(`Proforma généré depuis la commande n°${commande.id}.`)
  }

  function totalProforma(proforma) {
    return proforma.proforma_items.reduce(
      (s, item) => s + Number(item.prix_unitaire) * Number(item.quantite),
      0
    )
  }

  if (chargement) return <div className="stock-page">Chargement...</div>

  return (
    <div className="stock-page">
      <h1>Proforma</h1>

      <div className="stock-formulaire" style={{ maxWidth: '500px', marginBottom: '25px' }}>
        <h3 style={{ marginTop: 0 }}>Créer un proforma</h3>
        <label>
          Client (optionnel)
          <select value={clientSelectionne} onChange={(e) => setClientSelectionne(e.target.value)}>
            <option value="">-- Sans client précis --</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.nom}</option>
            ))}
          </select>
        </label>

        <label>
          Ajouter un produit
          <select
            value=""
            onChange={(e) => {
              const produit = produits.find((p) => p.id === Number(e.target.value))
              if (produit) ajouterAuPanier(produit)
            }}
          >
            <option value="">-- Choisir un produit --</option>
            {produits.map((p) => (
              <option key={p.id} value={p.id}>{p.nom} ({p.prix_vente} FCFA)</option>
            ))}
          </select>
        </label>

        {panier.length > 0 && (
          <table className="stock-tableau" style={{ marginTop: '10px' }}>
            <thead>
              <tr>
                <th>Produit</th>
                <th>Qté</th>
                <th>Sous-total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {panier.map((item) => (
                <tr key={item.id}>
                  <td>{item.nom}</td>
                  <td>
                    <input
                      type="number"
                      value={item.quantite}
                      onChange={(e) => changerQuantite(item.id, parseInt(e.target.value))}
                      style={{ width: '60px' }}
                    />
                  </td>
                  <td>{item.prix_vente * item.quantite} FCFA</td>
                  <td>
                    <button type="button" onClick={() => retirerDuPanier(item.id)}>Retirer</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <button type="button" onClick={creerProforma} style={{ marginTop: '10px' }}>
          Créer le proforma
        </button>
      </div>

      <h3>Générer depuis une commande client</h3>
      <table className="stock-tableau" style={{ marginBottom: '25px' }}>
        <thead>
          <tr>
            <th>Date</th>
            <th>Client</th>
            <th>Articles</th>
            <th>Statut</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {commandesClient.map((cmd) => (
            <tr key={cmd.id}>
              <td>{new Date(cmd.created_at).toLocaleDateString('fr-FR')}</td>
              <td>{cmd.clients?.nom}</td>
              <td>{cmd.commande_client_items.map((it) => `${it.products?.nom} x${it.quantite}`).join(', ')}</td>
              <td>{cmd.statut}</td>
              <td>
                <button onClick={() => genererProformaDepuisCommande(cmd)}>Générer proforma</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Liste des proformas</h3>
      <table className="stock-tableau">
        <thead>
          <tr>
            <th>N°</th>
            <th>Date</th>
            <th>Client</th>
            <th>Articles</th>
            <th>Total</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {proformas.map((p) => (
            <tr key={p.id}>
              <td>Proforma n°{p.numero}</td>
              <td>{new Date(p.created_at).toLocaleDateString('fr-FR')}</td>
              <td>{p.clients?.nom || '-'}</td>
              <td>{p.proforma_items.map((it) => `${it.products?.nom} x${it.quantite}`).join(', ')}</td>
              <td>{totalProforma(p)} FCFA</td>
              <td>
                <button onClick={() => setProformaOuvert(p)}>Voir</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {proformaOuvert && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setProformaOuvert(null)}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '10px',
              padding: '25px',
              maxWidth: '450px',
              width: '90%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0, color: '#b8860b' }}>Proforma n°{proformaOuvert.numero}</h2>
            <p>Date : {new Date(proformaOuvert.created_at).toLocaleDateString('fr-FR')}</p>
            <p>Client : {proformaOuvert.clients?.nom || 'Non précisé'}</p>
            <table className="stock-tableau" style={{ marginTop: '10px' }}>
              <thead>
                <tr>
                  <th>Produit</th>
                  <th>Qté</th>
                  <th>Prix unit.</th>
                  <th>Sous-total</th>
                </tr>
              </thead>
              <tbody>
                {proformaOuvert.proforma_items.map((it) => (
                  <tr key={it.id}>
                    <td>{it.products?.nom}</td>
                    <td>{it.quantite}</td>
                    <td>{it.prix_unitaire} FCFA</td>
                    <td>{it.prix_unitaire * it.quantite} FCFA</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h3 style={{ textAlign: 'right', color: '#b8860b' }}>
              Total : {totalProforma(proformaOuvert)} FCFA
            </h3>
            <button onClick={() => setProformaOuvert(null)} style={{ marginTop: '10px' }}>
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default Proforma