import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

function PretsInterBoutiques() {
  const employeConnecte = JSON.parse(localStorage.getItem('employeConnecte'))

  const [boutiques, setBoutiques] = useState([])
  const [chargement, setChargement] = useState(true)

  const [boutiquePreteuseId, setBoutiquePreteuseId] = useState('')
  const [boutiqueEmprunteuseId, setBoutiqueEmprunteuseId] = useState('')

  const [produitsPreteuse, setProduitsPreteuse] = useState([])
  const [produitsEmprunteuse, setProduitsEmprunteuse] = useState([])

  const [produitPreteurId, setProduitPreteurId] = useState('')
  const [produitEmprunteurId, setProduitEmprunteurId] = useState('')

  const [rechercheProduitPreteur, setRechercheProduitPreteur] = useState('')
  const [rechercheProduitEmprunteur, setRechercheProduitEmprunteur] = useState('')

  const [stockPreteur, setStockPreteur] = useState(null)
  const [quantite, setQuantite] = useState('')
  const [envoi, setEnvoi] = useState(false)

  const [prets, setPrets] = useState([])
  const [traitementPretId, setTraitementPretId] = useState(null)

  useEffect(() => {
    chargerBoutiques()
    chargerPrets()
  }, [])

  useEffect(() => {
    setProduitPreteurId('')
    setStockPreteur(null)
    if (boutiquePreteuseId) chargerProduits(boutiquePreteuseId, setProduitsPreteuse)
    else setProduitsPreteuse([])
  }, [boutiquePreteuseId])

  useEffect(() => {
    setProduitEmprunteurId('')
    if (boutiqueEmprunteuseId) chargerProduits(boutiqueEmprunteuseId, setProduitsEmprunteuse)
    else setProduitsEmprunteuse([])
  }, [boutiqueEmprunteuseId])

  useEffect(() => {
    if (produitPreteurId) chargerStock(produitPreteurId, setStockPreteur)
    else setStockPreteur(null)
  }, [produitPreteurId])

  async function chargerBoutiques() {
    const { data } = await supabase.from('boutiques').select('id, nom').order('nom', { ascending: true })
    setBoutiques(data || [])
    setChargement(false)
  }

  async function chargerProduits(boutiqueId, setter) {
    const { data } = await supabase
      .from('products')
      .select('id, nom')
      .eq('boutique_id', boutiqueId)
      .order('nom', { ascending: true })
    setter(data || [])
  }

  async function chargerStock(produitId, setter) {
    const { data } = await supabase
      .from('stock_mouvements')
      .select('quantite')
      .eq('produit_id', produitId)
    const total = (data || []).reduce((s, m) => s + Number(m.quantite), 0)
    setter(total)
  }

  async function chargerPrets() {
    const { data } = await supabase
      .from('prets_inter_boutiques')
      .select('*')
      .order('created_at', { ascending: false })
    setPrets(data || [])
  }

  function nomBoutique(id) {
    return boutiques.find((b) => String(b.id) === String(id))?.nom || '—'
  }

  async function enregistrerPret() {
    if (!boutiquePreteuseId || !boutiqueEmprunteuseId) {
      alert('Choisissez la boutique prêteuse et la boutique emprunteuse.')
      return
    }
    if (String(boutiquePreteuseId) === String(boutiqueEmprunteuseId)) {
      alert('Les deux boutiques doivent être différentes.')
      return
    }
    if (!produitPreteurId || !produitEmprunteurId) {
      alert('Choisissez le produit dans chaque boutique.')
      return
    }
    const qte = parseInt(quantite, 10)
    if (!qte || qte <= 0) {
      alert('Entrez une quantité valide.')
      return
    }
    if (stockPreteur !== null && qte > stockPreteur) {
      if (!confirm(`Attention : le stock disponible pour ce produit dans la boutique prêteuse est de ${stockPreteur}. Continuer quand même ?`)) return
    }

    setEnvoi(true)

    const produitPreteur = produitsPreteuse.find((p) => String(p.id) === String(produitPreteurId))
    const produitEmprunteur = produitsEmprunteuse.find((p) => String(p.id) === String(produitEmprunteurId))

    await supabase.from('stock_mouvements').insert({
      boutique_id: boutiquePreteuseId,
      produit_id: produitPreteurId,
      employe_id: employeConnecte?.id || null,
      type_mouvement: 'Sortie',
      quantite: -Math.abs(qte),
      motif: `Prêt vers ${nomBoutique(boutiqueEmprunteuseId)}`,
    })

    await supabase.from('stock_mouvements').insert({
      boutique_id: boutiqueEmprunteuseId,
      produit_id: produitEmprunteurId,
      employe_id: employeConnecte?.id || null,
      type_mouvement: 'Entrée',
      quantite: Math.abs(qte),
      motif: `Prêt reçu de ${nomBoutique(boutiquePreteuseId)}`,
    })

    const { error } = await supabase.from('prets_inter_boutiques').insert({
      boutique_preteuse_id: boutiquePreteuseId,
      boutique_emprunteuse_id: boutiqueEmprunteuseId,
      produit_preteur_id: produitPreteurId,
      produit_emprunteur_id: produitEmprunteurId,
      nom_produit: produitPreteur?.nom || produitEmprunteur?.nom || '',
      quantite: qte,
      statut: 'en_cours',
    })

    setEnvoi(false)

    if (error) {
      alert("Le mouvement de stock a été enregistré, mais l'enregistrement du prêt a échoué : " + error.message)
      return
    }

    setProduitPreteurId('')
    setProduitEmprunteurId('')
    setQuantite('')
    setStockPreteur(null)
    chargerPrets()
    alert('Prêt enregistré. Le stock des deux boutiques a été mis à jour.')
  }

  async function marquerRembourse(pret) {
    if (!confirm(`Confirmer que ${nomBoutique(pret.boutique_emprunteuse_id)} a rendu ${pret.quantite} x ${pret.nom_produit} à ${nomBoutique(pret.boutique_preteuse_id)} ?`)) return

    setTraitementPretId(pret.id)

    await supabase.from('stock_mouvements').insert({
      boutique_id: pret.boutique_emprunteuse_id,
      produit_id: pret.produit_emprunteur_id,
      employe_id: employeConnecte?.id || null,
      type_mouvement: 'Sortie',
      quantite: -Math.abs(pret.quantite),
      motif: `Remboursement du prêt à ${nomBoutique(pret.boutique_preteuse_id)}`,
    })

    await supabase.from('stock_mouvements').insert({
      boutique_id: pret.boutique_preteuse_id,
      produit_id: pret.produit_preteur_id,
      employe_id: employeConnecte?.id || null,
      type_mouvement: 'Entrée',
      quantite: Math.abs(pret.quantite),
      motif: `Remboursement reçu de ${nomBoutique(pret.boutique_emprunteuse_id)}`,
    })

    await supabase
      .from('prets_inter_boutiques')
      .update({ statut: 'rembourse', date_remboursement: new Date().toISOString() })
      .eq('id', pret.id)

    setTraitementPretId(null)
    chargerPrets()
  }

  const produitsPreteuseFiltres = produitsPreteuse.filter((p) =>
    p.nom.toLowerCase().includes(rechercheProduitPreteur.toLowerCase())
  )
  const produitsEmprunteuseFiltres = produitsEmprunteuse.filter((p) =>
    p.nom.toLowerCase().includes(rechercheProduitEmprunteur.toLowerCase())
  )

  const pretsEnCours = prets.filter((p) => p.statut === 'en_cours')
  const pretsRembourses = prets.filter((p) => p.statut === 'rembourse')

  const styleInput = {
    padding: '9px 12px',
    marginBottom: '8px',
    border: '1px solid #E6E0D6',
    borderRadius: '8px',
    fontSize: '14px',
    fontFamily: 'Poppins, Arial, sans-serif',
    width: '100%',
    boxSizing: 'border-box',
  }
  const styleBouton = {
    padding: '9px 16px',
    backgroundColor: '#C9822A',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
    fontFamily: 'Poppins, Arial, sans-serif',
  }
  const styleCarte = {
    marginBottom: '20px',
    padding: '18px',
    backgroundColor: 'white',
    border: '1px solid #E6E0D6',
    borderRadius: '10px',
    boxShadow: '0 2px 8px rgba(43, 38, 32, 0.06)',
  }

  if (chargement) return <p style={{ padding: '20px' }}>Chargement...</p>

  return (
    <div style={{ padding: '20px', fontFamily: 'Poppins, Arial, sans-serif' }}>
      <h2>🔄 Prêts entre boutiques</h2>
      <p style={{ color: '#6B6357', fontSize: '14px', marginBottom: '20px', maxWidth: '700px' }}>
        Quand une boutique manque d'un produit qu'une autre boutique possède, enregistrez un prêt ici : le stock des
        deux boutiques est mis à jour immédiatement. Une fois le produit rendu, marquez le prêt comme remboursé — le
        stock repart alors dans l'autre sens.
      </p>

      <div style={styleCarte}>
        <h4 style={{ marginTop: 0 }}>Nouveau prêt</h4>

        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '260px' }}>
            <strong>Boutique prêteuse (qui donne)</strong>
            <div style={{ marginTop: '8px' }}>
              <select style={styleInput} value={boutiquePreteuseId} onChange={(e) => setBoutiquePreteuseId(e.target.value)}>
                <option value="">-- Choisir --</option>
                {boutiques.map((b) => (
                  <option key={b.id} value={b.id}>{b.nom}</option>
                ))}
              </select>
            </div>
            {boutiquePreteuseId && (
              <>
                <input
                  style={styleInput}
                  placeholder="🔍 Rechercher un produit..."
                  value={rechercheProduitPreteur}
                  onChange={(e) => setRechercheProduitPreteur(e.target.value)}
                />
                <select style={styleInput} value={produitPreteurId} onChange={(e) => setProduitPreteurId(e.target.value)}>
                  <option value="">-- Choisir un produit --</option>
                  {produitsPreteuseFiltres.map((p) => (
                    <option key={p.id} value={p.id}>{p.nom}</option>
                  ))}
                </select>
                {stockPreteur !== null && (
                  <p style={{ fontSize: '13px', color: '#6B6357' }}>
                    Stock disponible : <strong>{stockPreteur}</strong>
                  </p>
                )}
              </>
            )}
          </div>

          <div style={{ flex: 1, minWidth: '260px' }}>
            <strong>Boutique emprunteuse (qui reçoit)</strong>
            <div style={{ marginTop: '8px' }}>
              <select style={styleInput} value={boutiqueEmprunteuseId} onChange={(e) => setBoutiqueEmprunteuseId(e.target.value)}>
                <option value="">-- Choisir --</option>
                {boutiques
                  .filter((b) => String(b.id) !== String(boutiquePreteuseId))
                  .map((b) => (
                    <option key={b.id} value={b.id}>{b.nom}</option>
                  ))}
              </select>
            </div>
            {boutiqueEmprunteuseId && (
              <>
                <input
                  style={styleInput}
                  placeholder="🔍 Rechercher le produit correspondant..."
                  value={rechercheProduitEmprunteur}
                  onChange={(e) => setRechercheProduitEmprunteur(e.target.value)}
                />
                <select style={styleInput} value={produitEmprunteurId} onChange={(e) => setProduitEmprunteurId(e.target.value)}>
                  <option value="">-- Choisir le produit correspondant --</option>
                  {produitsEmprunteuseFiltres.map((p) => (
                    <option key={p.id} value={p.id}>{p.nom}</option>
                  ))}
                </select>
                <p style={{ fontSize: '12px', color: '#6B6357' }}>
                  Choisissez le même produit dans le catalogue de cette boutique (le nom peut différer légèrement).
                </p>
              </>
            )}
          </div>
        </div>

        <div style={{ marginTop: '10px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            style={{ ...styleInput, width: '140px' }}
            type="number"
            placeholder="Quantité"
            value={quantite}
            onChange={(e) => setQuantite(e.target.value)}
          />
          <button style={styleBouton} onClick={enregistrerPret} disabled={envoi}>
            {envoi ? 'Enregistrement...' : '✅ Enregistrer le prêt'}
          </button>
        </div>
      </div>

      <div style={styleCarte}>
        <h4 style={{ marginTop: 0 }}>Prêts en cours ({pretsEnCours.length})</h4>
        {pretsEnCours.length === 0 ? (
          <p style={{ color: '#6B6357', fontSize: '14px' }}>Aucun prêt en cours.</p>
        ) : (
          pretsEnCours.map((pret) => (
            <div
              key={pret.id}
              style={{ padding: '12px', marginBottom: '10px', border: '1px solid #E6E0D6', borderRadius: '8px', backgroundColor: '#FDF6EC' }}
            >
              <div style={{ fontSize: '13px', color: '#6B6357', marginBottom: '4px' }}>
                {new Date(pret.created_at).toLocaleString('fr-FR')}
              </div>
              <div>
                <strong>{nomBoutique(pret.boutique_preteuse_id)}</strong> → <strong>{nomBoutique(pret.boutique_emprunteuse_id)}</strong> : {pret.quantite} x {pret.nom_produit}
              </div>
              <button
                onClick={() => marquerRembourse(pret)}
                disabled={traitementPretId === pret.id}
                style={{ ...styleBouton, backgroundColor: '#2E7D32', marginTop: '8px' }}
              >
                {traitementPretId === pret.id ? '...' : '✅ Marquer comme remboursé'}
              </button>
            </div>
          ))
        )}
      </div>

      {pretsRembourses.length > 0 && (
        <div style={styleCarte}>
          <h4 style={{ marginTop: 0 }}>Historique des prêts remboursés</h4>
          {pretsRembourses.map((pret) => (
            <div key={pret.id} style={{ padding: '10px', marginBottom: '8px', borderBottom: '1px solid #E6E0D6', fontSize: '13px' }}>
              {nomBoutique(pret.boutique_preteuse_id)} → {nomBoutique(pret.boutique_emprunteuse_id)} : {pret.quantite} x {pret.nom_produit}
              {' — '}prêté le {new Date(pret.created_at).toLocaleDateString('fr-FR')}, remboursé le{' '}
              {pret.date_remboursement ? new Date(pret.date_remboursement).toLocaleDateString('fr-FR') : '—'}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default PretsInterBoutiques
