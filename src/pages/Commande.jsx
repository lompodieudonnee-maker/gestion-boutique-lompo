import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import './Stock.css'
import { getBoutiqueId } from '../lib/boutique'

function Commande() {
  const employe = JSON.parse(localStorage.getItem('employeConnecte'))
  const boutiqueId = getBoutiqueId()
  const [ongletPrincipal, setOngletPrincipal] = useState('client')

  const [produits, setProduits] = useState([])

  const [clients, setClients] = useState([])
  const [commandesClient, setCommandesClient] = useState([])
  const [clientSelectionne, setClientSelectionne] = useState('')
  const [panierClient, setPanierClient] = useState([])

  const [fournisseurs, setFournisseurs] = useState([])
  const [commandesFournisseur, setCommandesFournisseur] = useState([])
  const [fournisseurSelectionne, setFournisseurSelectionne] = useState('')
  const [panierFournisseur, setPanierFournisseur] = useState([])

  const [chargement, setChargement] = useState(true)

  useEffect(() => {
    chargerTout()
  }, [])

  async function chargerTout() {
    setChargement(true)

    const { data: produitsData } = await supabase
      .from('products')
      .select('id, nom, prix_vente, prix_achat')
      .eq('boutique_id', boutiqueId)
    setProduits(produitsData || [])

    const { data: clientsData } = await supabase
      .from('clients')
      .select('id, nom')
      .eq('boutique_id', boutiqueId)
    setClients(clientsData || [])

    const { data: fournisseursData } = await supabase
      .from('fournisseurs')
      .select('id, nom')
      .eq('boutique_id', boutiqueId)
    setFournisseurs(fournisseursData || [])

    await chargerCommandesClient()
    await chargerCommandesFournisseur()

    setChargement(false)
  }

  async function chargerCommandesClient() {
    const { data } = await supabase
      .from('commandes_client')
      .select('*, clients(nom), commande_client_items(*, products(nom))')
      .eq('boutique_id', boutiqueId)
      .order('created_at', { ascending: false })
    setCommandesClient(data || [])
  }

  async function chargerCommandesFournisseur() {
    const { data } = await supabase
      .from('commandes_fournisseur')
      .select('*, fournisseurs(nom), commande_fournisseur_items(*, products(nom))')
      .eq('boutique_id', boutiqueId)
      .order('created_at', { ascending: false })
    setCommandesFournisseur(data || [])
  }

  // ============================================================
  // COMMANDES CLIENTS
  // ============================================================

  function ajouterAuPanierClient(produit) {
    const existe = panierClient.find((i) => i.id === produit.id)
    if (existe) {
      setPanierClient(panierClient.map((i) => (i.id === produit.id ? { ...i, quantite: i.quantite + 1 } : i)))
    } else {
      setPanierClient([...panierClient, { ...produit, quantite: 1 }])
    }
  }

  function changerQuantitePanierClient(id, quantite) {
    if (quantite < 1) return
    setPanierClient(panierClient.map((i) => (i.id === id ? { ...i, quantite } : i)))
  }

  function retirerDuPanierClient(id) {
    setPanierClient(panierClient.filter((i) => i.id !== id))
  }

  async function creerCommandeClient() {
    if (!clientSelectionne) {
      alert('Sélectionnez un client')
      return
    }
    if (panierClient.length === 0) {
      alert('Le panier est vide')
      return
    }

    const { data: commande, error } = await supabase
      .from('commandes_client')
      .insert({
        boutique_id: boutiqueId,
        client_id: clientSelectionne,
        employe_id: employe?.id,
        statut: 'En attente',
      })
      .select()
      .single()

    if (error) {
      alert('Erreur : ' + error.message)
      return
    }

    const lignes = panierClient.map((item) => ({
      commande_id: commande.id,
      produit_id: item.id,
      quantite: item.quantite,
      prix_unitaire: item.prix_vente,
    }))

    const { error: erreurItems } = await supabase.from('commande_client_items').insert(lignes)

    if (erreurItems) {
      alert('Erreur lors de l\'enregistrement des articles : ' + erreurItems.message)
      return
    }

    for (const item of panierClient) {
      await supabase.from('stock_mouvements').insert({
        boutique_id: boutiqueId,
        produit_id: item.id,
        employe_id: employe?.id,
        type_mouvement: 'Sortie',
        quantite: -item.quantite,
        motif: `Réservation commande client n°${commande.id}`,
      })
    }

    setPanierClient([])
    setClientSelectionne('')
    chargerCommandesClient()
    alert('Commande créée et stock réservé.')
  }

  async function changerStatutCommandeClient(commande, nouveauStatut) {
    const { error } = await supabase
      .from('commandes_client')
      .update({ statut: nouveauStatut })
      .eq('id', commande.id)

    if (error) {
      alert('Erreur : ' + error.message)
      return
    }

    if (nouveauStatut === 'Récupérée') {
      const total = commande.commande_client_items.reduce(
        (s, item) => s + Number(item.prix_unitaire) * Number(item.quantite),
        0
      )

      const { data: vente, error: erreurVente } = await supabase
        .from('sales')
        .insert({
          total,
          mode_paiement: 'Espèces',
          boutique_id: boutiqueId,
          employe_id: employe?.id,
        })
        .select()
        .single()

      if (!erreurVente) {
        const lignesVente = commande.commande_client_items.map((item) => ({
          sale_id: vente.id,
          product_id: item.produit_id,
          nom_produit: item.products?.nom || '',
          quantite: item.quantite,
          prix_unitaire: item.prix_unitaire,
          boutique_id: boutiqueId,
        }))
        await supabase.from('sale_items').insert(lignesVente)
      }
    }

    if (nouveauStatut === 'Annulée') {
      for (const item of commande.commande_client_items) {
        await supabase.from('stock_mouvements').insert({
          boutique_id: boutiqueId,
          produit_id: item.produit_id,
          employe_id: employe?.id,
          type_mouvement: 'Entrée',
          quantite: item.quantite,
          motif: `Annulation commande client n°${commande.id}`,
        })
      }
    }

    chargerCommandesClient()
  }

  // ============================================================
  // COMMANDES FOURNISSEURS
  // ============================================================

  function ajouterAuPanierFournisseur(produit) {
    const existe = panierFournisseur.find((i) => i.id === produit.id)
    if (existe) {
      setPanierFournisseur(
        panierFournisseur.map((i) => (i.id === produit.id ? { ...i, quantite: i.quantite + 1 } : i))
      )
    } else {
      setPanierFournisseur([...panierFournisseur, { ...produit, quantite: 1 }])
    }
  }

  function changerQuantitePanierFournisseur(id, quantite) {
    if (quantite < 1) return
    setPanierFournisseur(panierFournisseur.map((i) => (i.id === id ? { ...i, quantite } : i)))
  }

  function retirerDuPanierFournisseur(id) {
    setPanierFournisseur(panierFournisseur.filter((i) => i.id !== id))
  }

  async function creerCommandeFournisseur() {
    if (!fournisseurSelectionne) {
      alert('Sélectionnez un fournisseur')
      return
    }
    if (panierFournisseur.length === 0) {
      alert('Le panier est vide')
      return
    }

    const { data: commande, error } = await supabase
      .from('commandes_fournisseur')
      .insert({
        boutique_id: boutiqueId,
        fournisseur_id: fournisseurSelectionne,
        employe_id: employe?.id,
        statut: 'En attente',
      })
      .select()
      .single()

    if (error) {
      alert('Erreur : ' + error.message)
      return
    }

    const lignes = panierFournisseur.map((item) => ({
      commande_id: commande.id,
      produit_id: item.id,
      quantite: item.quantite,
    }))

    const { error: erreurItems } = await supabase.from('commande_fournisseur_items').insert(lignes)

    if (erreurItems) {
      alert('Erreur lors de l\'enregistrement des articles : ' + erreurItems.message)
      return
    }

    setPanierFournisseur([])
    setFournisseurSelectionne('')
    chargerCommandesFournisseur()
    alert('Commande fournisseur créée.')
  }

  async function changerStatutCommandeFournisseur(commande, nouveauStatut) {
    const { error } = await supabase
      .from('commandes_fournisseur')
      .update({ statut: nouveauStatut })
      .eq('id', commande.id)

    if (error) {
      alert('Erreur : ' + error.message)
      return
    }

    if (nouveauStatut === 'Reçue') {
      const nomFournisseur = commande.fournisseurs?.nom || ''

      for (const item of commande.commande_fournisseur_items) {
        const produit = produits.find((p) => p.id === item.produit_id)
        const montantLigne = Number(produit?.prix_achat || 0) * Number(item.quantite)

        await supabase.from('achats').insert({
          fournisseur_id: commande.fournisseur_id,
          description: `Commande n°${commande.id} : ${item.products?.nom || ''}`,
          montant_total: montantLigne,
          montant_paye: 0,
          statut: 'en cours',
          boutique_id: boutiqueId,
          produit_id: item.produit_id,
          quantite: item.quantite,
        })

        await supabase.from('stock_mouvements').insert({
          boutique_id: boutiqueId,
          produit_id: item.produit_id,
          employe_id: employe?.id,
          type_mouvement: 'Entrée',
          quantite: item.quantite,
          motif: `Commande fournisseur n°${commande.id} : ${nomFournisseur}`,
        })
      }
    }

    chargerCommandesFournisseur()
  }

  if (chargement) return <div className="stock-page">Chargement...</div>

  return (
    <div className="stock-page">
      <h1>Commandes</h1>

      <div className="stock-onglets">
        <button
          className={ongletPrincipal === 'client' ? 'actif' : ''}
          onClick={() => setOngletPrincipal('client')}
        >
          Commandes clients
        </button>
        <button
          className={ongletPrincipal === 'fournisseur' ? 'actif' : ''}
          onClick={() => setOngletPrincipal('fournisseur')}
        >
          Commandes fournisseurs
        </button>
      </div>

      {ongletPrincipal === 'client' && (
        <div>
          <div className="stock-formulaire" style={{ maxWidth: '500px', marginBottom: '25px' }}>
            <label>
              Client
              <select value={clientSelectionne} onChange={(e) => setClientSelectionne(e.target.value)}>
                <option value="">-- Choisir un client --</option>
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
                  if (produit) ajouterAuPanierClient(produit)
                }}
              >
                <option value="">-- Choisir un produit --</option>
                {produits.map((p) => (
                  <option key={p.id} value={p.id}>{p.nom} ({p.prix_vente} FCFA)</option>
                ))}
              </select>
            </label>

            {panierClient.length > 0 && (
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
                  {panierClient.map((item) => (
                    <tr key={item.id}>
                      <td>{item.nom}</td>
                      <td>
                        <input
                          type="number"
                          value={item.quantite}
                          onChange={(e) => changerQuantitePanierClient(item.id, parseInt(e.target.value))}
                          style={{ width: '60px' }}
                        />
                      </td>
                      <td>{item.prix_vente * item.quantite} FCFA</td>
                      <td>
                        <button type="button" onClick={() => retirerDuPanierClient(item.id)}>Retirer</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <button type="button" onClick={creerCommandeClient} style={{ marginTop: '10px' }}>
              Créer la commande
            </button>
          </div>

          <h3>Liste des commandes clients</h3>
          <table className="stock-tableau">
            <thead>
              <tr>
                <th>Date</th>
                <th>Client</th>
                <th>Articles</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {commandesClient.map((cmd) => (
                <tr key={cmd.id}>
                  <td>{new Date(cmd.created_at).toLocaleDateString('fr-FR')}</td>
                  <td>{cmd.clients?.nom}</td>
                  <td>
                    {cmd.commande_client_items.map((it) => `${it.products?.nom} x${it.quantite}`).join(', ')}
                  </td>
                  <td>{cmd.statut}</td>
                  <td>
                    {cmd.statut === 'En attente' && (
                      <button onClick={() => changerStatutCommandeClient(cmd, 'Confirmée')}>Confirmer</button>
                    )}
                    {cmd.statut === 'Confirmée' && (
                      <button onClick={() => changerStatutCommandeClient(cmd, 'Prête')}>Marquer prête</button>
                    )}
                    {cmd.statut === 'Prête' && (
                      <button onClick={() => changerStatutCommandeClient(cmd, 'Récupérée')}>Récupérée</button>
                    )}
                    {!['Récupérée', 'Annulée'].includes(cmd.statut) && (
                      <button onClick={() => changerStatutCommandeClient(cmd, 'Annulée')} style={{ color: '#B71C1C' }}>
                        Annuler
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {ongletPrincipal === 'fournisseur' && (
        <div>
          <div className="stock-formulaire" style={{ maxWidth: '500px', marginBottom: '25px' }}>
            <label>
              Fournisseur
              <select value={fournisseurSelectionne} onChange={(e) => setFournisseurSelectionne(e.target.value)}>
                <option value="">-- Choisir un fournisseur --</option>
                {fournisseurs.map((f) => (
                  <option key={f.id} value={f.id}>{f.nom}</option>
                ))}
              </select>
            </label>

            <label>
              Ajouter un produit
              <select
                value=""
                onChange={(e) => {
                  const produit = produits.find((p) => p.id === Number(e.target.value))
                  if (produit) ajouterAuPanierFournisseur(produit)
                }}
              >
                <option value="">-- Choisir un produit --</option>
                {produits.map((p) => (
                  <option key={p.id} value={p.id}>{p.nom}</option>
                ))}
              </select>
            </label>

            {panierFournisseur.length > 0 && (
              <table className="stock-tableau" style={{ marginTop: '10px' }}>
                <thead>
                  <tr>
                    <th>Produit</th>
                    <th>Qté</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {panierFournisseur.map((item) => (
                    <tr key={item.id}>
                      <td>{item.nom}</td>
                      <td>
                        <input
                          type="number"
                          value={item.quantite}
                          onChange={(e) => changerQuantitePanierFournisseur(item.id, parseInt(e.target.value))}
                          style={{ width: '60px' }}
                        />
                      </td>
                      <td>
                        <button type="button" onClick={() => retirerDuPanierFournisseur(item.id)}>Retirer</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <button type="button" onClick={creerCommandeFournisseur} style={{ marginTop: '10px' }}>
              Créer la commande
            </button>
          </div>

          <h3>Liste des commandes fournisseurs</h3>
          <table className="stock-tableau">
            <thead>
              <tr>
                <th>Date</th>
                <th>Fournisseur</th>
                <th>Articles</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {commandesFournisseur.map((cmd) => (
                <tr key={cmd.id}>
                  <td>{new Date(cmd.created_at).toLocaleDateString('fr-FR')}</td>
                  <td>{cmd.fournisseurs?.nom}</td>
                  <td>
                    {cmd.commande_fournisseur_items.map((it) => `${it.products?.nom} x${it.quantite}`).join(', ')}
                  </td>
                  <td>{cmd.statut}</td>
                  <td>
                    {cmd.statut === 'En attente' && (
                      <button onClick={() => changerStatutCommandeFournisseur(cmd, 'Confirmée')}>Confirmer</button>
                    )}
                    {cmd.statut === 'Confirmée' && (
                      <button onClick={() => changerStatutCommandeFournisseur(cmd, 'Prête')}>Marquer prête</button>
                    )}
                    {cmd.statut === 'Prête' && (
                      <button onClick={() => changerStatutCommandeFournisseur(cmd, 'Reçue')}>Reçue</button>
                    )}
                    {!['Reçue', 'Annulée'].includes(cmd.statut) && (
                      <button onClick={() => changerStatutCommandeFournisseur(cmd, 'Annulée')} style={{ color: '#B71C1C' }}>
                        Annuler
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default Commande