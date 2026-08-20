import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getBoutiqueId } from '../lib/boutique'

function TableauDeBord({ setPageActive }) {
  const employe = JSON.parse(localStorage.getItem('employeConnecte'))
  const boutiqueId = getBoutiqueId()
  const peutVoirFinances = employe?.role === 'proprietaire' || employe?.voir_finances === true

  const [ongletPeriode, setOngletPeriode] = useState('aujourdhui')
  const [chargement, setChargement] = useState(true)

  const [chiffreAffaires, setChiffreAffaires] = useState(0)
  const [totalCash, setTotalCash] = useState(0)
  const [totalMobile, setTotalMobile] = useState(0)
  const [encaissement, setEncaissement] = useState(0)
  const [margeBrute, setMargeBrute] = useState(0)
  const [creditsPayes, setCreditsPayes] = useState(0)
  const [dettesClients, setDettesClients] = useState(0)

  const [nbProduits, setNbProduits] = useState(0)
  const [produitsAlerte, setProduitsAlerte] = useState(0)
  const [nbClients, setNbClients] = useState(0)
  const [nbFournisseurs, setNbFournisseurs] = useState(0)
  const [dettesFournisseurs, setDettesFournisseurs] = useState(0)
  const [employesListe, setEmployesListe] = useState([])
  const [employePerso, setEmployePerso] = useState(employe?.id || '')
  const [dateDebutPerso, setDateDebutPerso] = useState('')
  const [dateFinPerso, setDateFinPerso] = useState('')
  const [dernieresVentes, setDernieresVentes] = useState([])

  useEffect(() => {
    chargerDonnees()
  }, [ongletPeriode, employePerso, dateDebutPerso, dateFinPerso])

  function bornesPeriode() {
    const maintenant = new Date()

    if (ongletPeriode === 'aujourdhui') {
      const debut = new Date()
      debut.setHours(0, 0, 0, 0)
      return { debut, fin: maintenant, filtrerParDate: true }
    }

    if (ongletPeriode === 'semaine') {
      const debut = new Date()
      const jourSemaine = debut.getDay() === 0 ? 7 : debut.getDay() // lundi = 1 ... dimanche = 7
      debut.setDate(debut.getDate() - (jourSemaine - 1))
      debut.setHours(0, 0, 0, 0)
      return { debut, fin: maintenant, filtrerParDate: true }
    }

    if (ongletPeriode === 'mois') {
      const debut = new Date(maintenant.getFullYear(), maintenant.getMonth(), 1)
      debut.setHours(0, 0, 0, 0)
      return { debut, fin: maintenant, filtrerParDate: true }
    }

    if (ongletPeriode === 'perso' && dateDebutPerso && dateFinPerso) {
      const debut = new Date(dateDebutPerso)
      debut.setHours(0, 0, 0, 0)
      const fin = new Date(dateFinPerso)
      fin.setHours(23, 59, 59, 999)
      return { debut, fin, filtrerParDate: true }
    }

    // 'perso' (sans dates choisies) et 'total' : pas de filtre de date
    return { debut: null, fin: null, filtrerParDate: false }
  }

  async function chargerDonnees() {
    setChargement(true)

    const { debut, fin, filtrerParDate } = bornesPeriode()
    const filtrerParEmploye = ongletPeriode === 'perso'
    const idEmployeCible = peutVoirFinances ? (employePerso || employe?.id) : employe?.id

    // --- Ventes ---
        let requeteVentes = supabase.from('sales').select('id, total, mode_paiement, created_at, employe_id').eq('boutique_id', boutiqueId)
    if (filtrerParEmploye) requeteVentes = requeteVentes.eq('employe_id', idEmployeCible)
    const { data: ventes } = await requeteVentes

    const ventesFiltrees = filtrerParDate
      ? (ventes || []).filter((v) => new Date(v.created_at) >= debut && new Date(v.created_at) <= fin)
      : (ventes || [])
    // --- Dernières ventes (produits vendus) ---
    const idsVentesFiltrees = ventesFiltrees.map((v) => v.id)
    const dateParVente = {}
    ventesFiltrees.forEach((v) => { dateParVente[v.id] = v.created_at })

    const { data: itemsVentes } = await supabase
      .from('sale_items')
      .select('nom_produit, quantite, sale_id')
      .eq('boutique_id', boutiqueId)

    const itemsFiltres = (itemsVentes || [])
      .filter((item) => idsVentesFiltrees.includes(item.sale_id))
      .map((item) => ({ ...item, date: dateParVente[item.sale_id] }))
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 15)

    setDernieresVentes(itemsFiltres)
    const ca = ventesFiltrees.reduce((s, v) => s + Number(v.total || 0), 0)
    const cash = ventesFiltrees
      .filter((v) => v.mode_paiement === 'Espèces')
      .reduce((s, v) => s + Number(v.total || 0), 0)
    const mobile = ventesFiltrees
      .filter((v) => v.mode_paiement === 'Orange Money' || v.mode_paiement === 'Moov Money')
      .reduce((s, v) => s + Number(v.total || 0), 0)

    setChiffreAffaires(ca)
    setTotalCash(cash)
    setTotalMobile(mobile)
    setEncaissement(cash + mobile)

    // --- Dépenses ---
    let requeteDepenses = supabase.from('depenses').select('montant, created_at').eq('boutique_id', boutiqueId)
    const { data: depenses } = await requeteDepenses
    const depensesFiltrees = filtrerParDate
      ? (depenses || []).filter((d) => new Date(d.created_at) >= debut && new Date(d.created_at) <= fin)
      : (depenses || [])
    const totalDepenses = depensesFiltrees.reduce((s, d) => s + Number(d.montant || 0), 0)

    // --- Achats fournisseurs ---
    const { data: achats } = await supabase
      .from('achats')
      .select('montant_total, montant_paye, created_at, date_achat')
      .eq('boutique_id', boutiqueId)
    const achatsFiltres = filtrerParDate
      ? (achats || []).filter((a) => {
          const dateA = new Date(a.date_achat || a.created_at)
          return dateA >= debut && dateA <= fin
        })
      : (achats || [])
    const totalAchats = achatsFiltres.reduce((s, a) => s + Number(a.montant_total || 0), 0)

    setMargeBrute(ca - totalDepenses - totalAchats)

    // Dettes fournisseurs (toujours globales)
    const dettesF = (achats || []).reduce(
      (s, a) => s + (Number(a.montant_total) - Number(a.montant_paye)),
      0
    )
    setDettesFournisseurs(dettesF)

    // --- Crédits clients (toujours globaux, pas de date de paiement en base) ---
    const { data: credits } = await supabase
      .from('credits')
      .select('montant_total, montant_paye')
      .eq('boutique_id', boutiqueId)
    if (credits) {
      setCreditsPayes(credits.reduce((s, c) => s + Number(c.montant_paye || 0), 0))
      setDettesClients(
        credits.reduce((s, c) => s + (Number(c.montant_total) - Number(c.montant_paye)), 0)
      )
    }

    // --- Produits / alertes (toujours globaux) ---
    const { data: produits } = await supabase
      .from('products')
      .select('id, seuil_alerte')
      .eq('boutique_id', boutiqueId)
    const { data: mouvementsStock } = await supabase
      .from('stock_mouvements')
      .select('produit_id, quantite')
      .eq('boutique_id', boutiqueId)

    if (produits && mouvementsStock) {
      setNbProduits(produits.length)

      function quantiteActuelle(idProduit) {
        return mouvementsStock
          .filter((m) => String(m.produit_id) === String(idProduit))
          .reduce((total, m) => total + Number(m.quantite), 0)
      }

      const alertes = produits.filter(
        (p) => p.seuil_alerte != null && quantiteActuelle(p.id) <= Number(p.seuil_alerte)
      ).length
      setProduitsAlerte(alertes)
    }

    // --- Clients / Fournisseurs (comptages globaux) ---
    const { data: clientsData } = await supabase.from('clients').select('id').eq('boutique_id', boutiqueId)
    if (clientsData) setNbClients(clientsData.length)

    const { data: fournisseursData } = await supabase
      .from('fournisseurs')
      .select('id')
      .eq('boutique_id', boutiqueId)
    if (fournisseursData) setNbFournisseurs(fournisseursData.length)

    if (peutVoirFinances) {
      const { data: employesData } = await supabase
        .from('employes')
        .select('id, nom')
        .eq('boutique_id', boutiqueId)
      setEmployesListe(employesData || [])
    }

    setChargement(false)
  }

  const styleCarte = {
    flex: '1 1 200px',
    padding: '20px',
    borderRadius: '10px',
    textAlign: 'left',
    border: '1px solid #E6E0D6',
    boxShadow: '0 2px 8px rgba(43, 38, 32, 0.06)',
  }
  const styleTitre = { fontSize: '13px', color: '#6B6357', marginBottom: '6px', fontWeight: 500 }
  const styleValeur = { fontSize: '22px', fontWeight: 700 }

  const onglets = [
    { id: 'aujourdhui', label: "Aujourd'hui" },
    { id: 'semaine', label: 'Semaine' },
    { id: 'mois', label: 'Mois' },
    { id: 'perso', label: 'Perso' },
    { id: 'total', label: 'Total' },
  ]

  if (chargement) {
    return <div style={{ padding: '20px' }}>Chargement du tableau de bord...</div>
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'Poppins, Arial, sans-serif' }}>
      <button
  onClick={() => setPageActive('caisse')}
  style={{
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginTop: '15px',
    marginBottom: '15px',
    padding: '14px 20px',
    borderRadius: '10px',
    border: 'none',
    backgroundColor: '#C9822A',
    color: 'white',
    fontFamily: 'Poppins, Arial, sans-serif',
    fontWeight: 600,
    fontSize: '15px',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(43, 38, 32, 0.15)',
  }}
>
  🛒 Nouvelle vente
</button>

      <div style={{ display: 'flex', gap: '6px', marginTop: '15px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {onglets.map((o) => (
          <button
            key={o.id}
            onClick={() => setOngletPeriode(o.id)}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid #E6E0D6',
              backgroundColor: ongletPeriode === o.id ? '#C9822A' : 'white',
              color: ongletPeriode === o.id ? 'white' : '#6B6357',
              cursor: 'pointer',
              fontFamily: 'Poppins, Arial, sans-serif',
              fontWeight: 500,
              fontSize: '14px',
            }}
          >
            {o.label}
          </button>
        ))}
      </div>

      {ongletPeriode === 'perso' && (
        <div
          style={{
            display: 'flex',
            gap: '12px',
            alignItems: 'flex-end',
            flexWrap: 'wrap',
            backgroundColor: 'white',
            border: '1px solid #E6E0D6',
            borderRadius: '10px',
            padding: '14px 16px',
            marginBottom: '20px',
          }}
        >
          {peutVoirFinances && (
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#6B6357', marginBottom: '4px' }}>Employé</label>
              <select
                value={employePerso}
                onChange={(e) => setEmployePerso(e.target.value)}
                style={{ padding: '8px 10px', border: '1px solid #E6E0D6', borderRadius: '6px', fontFamily: 'Poppins, Arial, sans-serif' }}
              >
                {employesListe.map((e) => (
                  <option key={e.id} value={e.id}>{e.nom}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#6B6357', marginBottom: '4px' }}>Du</label>
            <input
              type="date"
              value={dateDebutPerso}
              onChange={(e) => setDateDebutPerso(e.target.value)}
              style={{ padding: '7px 10px', border: '1px solid #E6E0D6', borderRadius: '6px', fontFamily: 'Poppins, Arial, sans-serif' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#6B6357', marginBottom: '4px' }}>Au</label>
            <input
              type="date"
              value={dateFinPerso}
              onChange={(e) => setDateFinPerso(e.target.value)}
              style={{ padding: '7px 10px', border: '1px solid #E6E0D6', borderRadius: '6px', fontFamily: 'Poppins, Arial, sans-serif' }}
            />
          </div>

          {(dateDebutPerso || dateFinPerso) && (
            <button
              onClick={() => { setDateDebutPerso(''); setDateFinPerso('') }}
              style={{
                padding: '8px 14px',
                border: '1px solid #E6E0D6',
                borderRadius: '6px',
                background: 'white',
                color: '#6B6357',
                cursor: 'pointer',
                fontFamily: 'Poppins, Arial, sans-serif',
                fontSize: '13px',
              }}
            >
              Effacer les dates
            </button>
          )}
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px' }}>
        <div style={{ ...styleCarte, backgroundColor: '#EAF5EC' }}>
          <div style={styleTitre}>Chiffre d'affaires</div>
          <div style={{ ...styleValeur, color: '#2E7D32' }}>{chiffreAffaires.toLocaleString('fr-FR')} FCFA</div>
        </div>

        {peutVoirFinances && (
          <div style={{ ...styleCarte, backgroundColor: margeBrute >= 0 ? '#EAF5EC' : '#FBEAEA' }}>
          <div style={styleTitre}>Bénéfice</div>
            <div style={{ ...styleValeur, color: margeBrute >= 0 ? '#2E7D32' : '#B71C1C' }}>
              {margeBrute.toLocaleString('fr-FR')} FCFA
            </div>
          </div>
        )}

        <div style={{ ...styleCarte, backgroundColor: '#F3E2CB' }}>
          <div style={styleTitre}>Encaissement</div>
          <div style={{ ...styleValeur, color: '#A6691F' }}>{encaissement.toLocaleString('fr-FR')} FCFA</div>
        </div>

        <div style={{ ...styleCarte, backgroundColor: '#EDF1F5' }}>
          <div style={styleTitre}>Total Cash</div>
          <div style={{ ...styleValeur, color: '#37474F' }}>{totalCash.toLocaleString('fr-FR')} FCFA</div>
        </div>

        <div style={{ ...styleCarte, backgroundColor: '#EDF1F5' }}>
          <div style={styleTitre}>Total Mobile</div>
          <div style={{ ...styleValeur, color: '#37474F' }}>{totalMobile.toLocaleString('fr-FR')} FCFA</div>
        </div>

        {peutVoirFinances && (
          <>
            <div style={{ ...styleCarte, backgroundColor: '#E3F2E5' }}>
              <div style={styleTitre}>Crédits payés</div>
              <div style={{ ...styleValeur, color: '#2E7D32' }}>{creditsPayes.toLocaleString('fr-FR')} FCFA</div>
            </div>

            <div style={{ ...styleCarte, backgroundColor: dettesClients > 0 ? '#FCE4E4' : '#F2F1EE' }}>
              <div style={styleTitre}>Dettes clients</div>
              <div style={{ ...styleValeur, color: dettesClients > 0 ? '#C62828' : '#2B2620' }}>
                {dettesClients.toLocaleString('fr-FR')} FCFA
              </div>
            </div>
          </>
        )}

        <div style={{ ...styleCarte, backgroundColor: produitsAlerte > 0 ? '#FDECE1' : '#F2F1EE' }}>
          <div style={styleTitre}>Produits en stock</div>
          <div style={{ ...styleValeur, color: produitsAlerte > 0 ? '#C9822A' : '#2B2620' }}>{nbProduits}</div>
          {produitsAlerte > 0 && (
            <div style={{ fontSize: '13px', marginTop: '4px', color: '#C9822A' }}>⚠️ {produitsAlerte} en alerte stock</div>
          )}
        </div>

        <div style={{ ...styleCarte, backgroundColor: '#F3E2CB' }}>
          <div style={styleTitre}>Clients</div>
          <div style={{ ...styleValeur, color: '#A6691F' }}>{nbClients}</div>
        </div>

        <div style={{ ...styleCarte, backgroundColor: '#EDF1F5' }}>
          <div style={styleTitre}>Fournisseurs</div>
          <div style={{ ...styleValeur, color: '#37474F' }}>{nbFournisseurs}</div>
          {peutVoirFinances && (
            <div style={{ fontSize: '13px', marginTop: '4px', color: '#6B6357' }}>
              Dettes : {dettesFournisseurs.toLocaleString('fr-FR')} FCFA
            </div>
          )}
        </div>
      </div>
            <div
        style={{
          marginTop: '20px',
          backgroundColor: 'white',
          border: '1px solid #E6E0D6',
          borderRadius: '10px',
          padding: '18px',
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: '12px' }}>Derniers produits vendus</h3>
        {dernieresVentes.length === 0 ? (
          <p style={{ color: '#6B6357' }}>Aucune vente sur cette période.</p>
        ) : (
          <table cellPadding="8" style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr style={{ backgroundColor: '#F7F5F2' }}>
                <th style={{ textAlign: 'left', fontSize: '13px', color: '#6B6357' }}>Produit</th>
                <th style={{ textAlign: 'left', fontSize: '13px', color: '#6B6357' }}>Qté</th>
                <th style={{ textAlign: 'left', fontSize: '13px', color: '#6B6357' }}>Heure</th>
              </tr>
            </thead>
            <tbody>
              {dernieresVentes.map((item, index) => (
                <tr key={index} style={{ borderTop: '1px solid #E6E0D6' }}>
                  <td>{item.nom_produit}</td>
                  <td>{item.quantite}</td>
                  <td>
                    {new Date(item.date).toLocaleDateString('fr-FR')}{' '}
                    {new Date(item.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default TableauDeBord