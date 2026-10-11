import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getBoutiqueId } from '../lib/boutique'
import { fetchAllRows } from '../lib/fetchAll'

// Date du jour au format AAAA-MM-JJ (heure locale du téléphone / ordinateur)
function dateDuJour() {
  const d = new Date()
  const mois = String(d.getMonth() + 1).padStart(2, '0')
  const jour = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mois}-${jour}`
}

// Date AAAA-MM-JJ (heure locale) d'une date enregistrée en base
function dateLocale(valeur) {
  const d = new Date(valeur)
  const mois = String(d.getMonth() + 1).padStart(2, '0')
  const jour = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mois}-${jour}`
}

function Depenses() {
  const [depenses, setDepenses] = useState([])
  const [categorie, setCategorie] = useState('')
  const [description, setDescription] = useState('')
  const [montant, setMontant] = useState('')
  const [dateDepense, setDateDepense] = useState(dateDuJour())

  // Modification d'une dépense existante
  const [depenseEnEdition, setDepenseEnEdition] = useState(null) // id de la dépense en cours de modification
  const [editCategorie, setEditCategorie] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editMontant, setEditMontant] = useState('')
  const [editDate, setEditDate] = useState('')
  const [enregistrementEdition, setEnregistrementEdition] = useState(false)

  // Chiffres alignés sur le Tableau de bord (depuis le début)
  const [totalVentes, setTotalVentes] = useState(0)
  const [coutProduitsVendus, setCoutProduitsVendus] = useState(0)
  const [totalAchats, setTotalAchats] = useState(0)
  const [chargementChiffres, setChargementChiffres] = useState(true)

  const employe = JSON.parse(localStorage.getItem('employeConnecte'))
  const boutiqueId = getBoutiqueId()
  const peutVoirFinances =
    employe?.role === 'proprietaire' || employe?.role === 'superadmin' || employe?.voir_finances === true

  useEffect(() => {
    chargerDepenses()
    chargerChiffres()
  }, [])

  async function chargerDepenses() {
    const { data, error } = await supabase
      .from('depenses')
      .select('*')
      .eq('boutique_id', boutiqueId)
      .order('created_at', { ascending: false })
    if (!error) setDepenses(data || [])
  }

  // Même calcul que le Tableau de bord (onglet "Total") :
  // ventes non annulées, coût d'achat des produits réellement vendus.
  // Lecture paginée pour ne rien perdre sur les boutiques avec beaucoup d'historique.
  async function chargerChiffres() {
    setChargementChiffres(true)

    const { data: ventes } = await fetchAllRows('sales', boutiqueId, 'id, total, annulee')
    const ventesValides = (ventes || []).filter((v) => !v.annulee)
    const idsVentesValides = new Set(ventesValides.map((v) => v.id))
    setTotalVentes(ventesValides.reduce((s, v) => s + Number(v.total || 0), 0))

    const { data: items } = await fetchAllRows('sale_items', boutiqueId, 'sale_id, product_id, quantite')
    const { data: produits } = await supabase
      .from('products')
      .select('id, prix_achat')
      .eq('boutique_id', boutiqueId)
    const prixAchatParProduit = {}
    ;(produits || []).forEach((p) => { prixAchatParProduit[p.id] = Number(p.prix_achat || 0) })
    const cout = (items || [])
      .filter((item) => idsVentesValides.has(item.sale_id))
      .reduce((s, item) => s + (prixAchatParProduit[item.product_id] || 0) * Number(item.quantite || 0), 0)
    setCoutProduitsVendus(cout)

    const { data: achats } = await fetchAllRows('achats', boutiqueId, 'montant_total')
    setTotalAchats((achats || []).reduce((s, a) => s + Number(a.montant_total || 0), 0))

    setChargementChiffres(false)
  }

  async function ajouterDepense() {
    if (!montant || Number(montant) <= 0) {
      alert('Entrez un montant valide')
      return
    }
    if (!dateDepense) {
      alert('Choisissez la date de la dépense')
      return
    }
    if (dateDepense > dateDuJour()) {
      alert('La date de la dépense ne peut pas être dans le futur.')
      return
    }

    const nouvelleDepense = { categorie, description, montant: Number(montant), boutique_id: boutiqueId }
    // Dépense d'un jour passé : on la rattache à ce jour-là (à midi) pour qu'elle
    // compte dans le bénéfice du bon jour. Dépense du jour : heure réelle de saisie.
    if (dateDepense !== dateDuJour()) {
      nouvelleDepense.created_at = new Date(`${dateDepense}T12:00:00`).toISOString()
    }

    const { error } = await supabase.from('depenses').insert([nouvelleDepense])
    if (error) {
      alert('Erreur : ' + error.message)
      return
    }
    setCategorie('')
    setDescription('')
    setMontant('')
    setDateDepense(dateDuJour())
    chargerDepenses()
  }

  function ouvrirEdition(d) {
    setDepenseEnEdition(d.id)
    setEditCategorie(d.categorie || '')
    setEditDescription(d.description || '')
    setEditMontant(String(d.montant ?? ''))
    setEditDate(d.created_at ? dateLocale(d.created_at) : dateDuJour())
  }

  function fermerEdition() {
    setDepenseEnEdition(null)
  }

  async function enregistrerEdition(d) {
    if (!editMontant || Number(editMontant) <= 0) {
      alert('Entrez un montant valide')
      return
    }
    if (!editDate) {
      alert('Choisissez la date de la dépense')
      return
    }
    if (editDate > dateDuJour()) {
      alert('La date de la dépense ne peut pas être dans le futur.')
      return
    }

    const modifications = {
      categorie: editCategorie,
      description: editDescription,
      montant: Number(editMontant),
    }
    // On ne touche à la date que si elle a vraiment été changée (on garde sinon l'heure d'origine)
    if (!d.created_at || editDate !== dateLocale(d.created_at)) {
      modifications.created_at = new Date(`${editDate}T12:00:00`).toISOString()
    }

    setEnregistrementEdition(true)
    const { error } = await supabase.from('depenses').update(modifications).eq('id', d.id)
    setEnregistrementEdition(false)

    if (error) {
      alert('Erreur : ' + error.message)
      return
    }
    setDepenseEnEdition(null)
    chargerDepenses()
  }

  async function supprimerDepense(d) {
    let avertissement = `Supprimer cette dépense de ${Number(d.montant).toLocaleString('fr-FR')} FCFA ?\n\n${d.categorie || 'Sans catégorie'}${d.description ? ' — ' + d.description : ''}\n\nCette action est définitive.`
    if (d.categorie === 'Salaire') {
      avertissement += "\n\n⚠️ C'est un salaire : le paiement restera visible dans Gestion Employés, mais il ne comptera plus dans les dépenses."
    }
    if (!window.confirm(avertissement)) return

    const { error } = await supabase.from('depenses').delete().eq('id', d.id)
    if (error) {
      alert('Erreur : ' + error.message)
      return
    }
    if (depenseEnEdition === d.id) setDepenseEnEdition(null)
    chargerDepenses()
  }

  const totalDepenses = depenses.reduce((somme, d) => somme + Number(d.montant || 0), 0)
  const beneficeVentes = totalVentes - coutProduitsVendus
  const resultat = beneficeVentes - totalDepenses

  const styleBouton = {
    padding: '10px 20px',
    backgroundColor: '#C9822A',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
    fontFamily: 'Poppins, Arial, sans-serif',
  }

  const styleBoutonSecondaire = {
    padding: '6px 12px',
    backgroundColor: 'white',
    border: '1px solid #E6E0D6',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '12px',
    fontFamily: 'Poppins, Arial, sans-serif',
  }

  const styleInput = {
    padding: '9px 12px',
    marginRight: '8px',
    marginBottom: '8px',
    border: '1px solid #E6E0D6',
    borderRadius: '6px',
    fontSize: '14px',
    fontFamily: 'Poppins, Arial, sans-serif',
  }

  const styleCarte = {
    flex: '1 1 180px',
    padding: '18px',
    borderRadius: '10px',
    textAlign: 'left',
    border: '1px solid #E6E0D6',
    boxShadow: '0 2px 8px rgba(43, 38, 32, 0.06)',
  }

  const styleTitreCarte = { fontSize: '13px', color: '#6B6357', marginBottom: '6px', fontWeight: 500 }
  const styleValeurCarte = { fontSize: '22px', fontWeight: 700 }
  const styleDetailCarte = { fontSize: '12px', marginTop: '4px', color: '#6B6357' }
  const fcfa = (n) => `${Number(n || 0).toLocaleString('fr-FR')} FCFA`

  return (
    <div style={{ padding: '20px' }}>
      <h2>💵 Dépenses & Bénéfices</h2>

      {peutVoirFinances ? (
        <>
          <p style={{ fontSize: '13px', color: '#6B6357', margin: '-6px 0 12px' }}>
            Chiffres depuis le début (mêmes calculs que l'onglet « Total » du Tableau de bord).
          </p>
          <div style={{ display: 'flex', gap: '15px', marginBottom: '25px', flexWrap: 'wrap', opacity: chargementChiffres ? 0.5 : 1 }}>
            <div style={{ ...styleCarte, backgroundColor: '#EAF5EC' }}>
              <div style={styleTitreCarte}>Total Ventes</div>
              <div style={{ ...styleValeurCarte, color: '#2E7D32' }}>{fcfa(totalVentes)}</div>
              <div style={styleDetailCarte}>Ventes annulées exclues</div>
            </div>
            <div style={{ ...styleCarte, backgroundColor: beneficeVentes >= 0 ? '#EAF5EC' : '#FBEAEA' }}>
              <div style={styleTitreCarte}>Bénéfice sur ventes</div>
              <div style={{ ...styleValeurCarte, color: beneficeVentes >= 0 ? '#2E7D32' : '#B71C1C' }}>{fcfa(beneficeVentes)}</div>
              <div style={styleDetailCarte}>Ventes − {fcfa(coutProduitsVendus)} de coût d'achat</div>
            </div>
            <div style={{ ...styleCarte, backgroundColor: '#FBEAEA' }}>
              <div style={styleTitreCarte}>Total Dépenses</div>
              <div style={{ ...styleValeurCarte, color: '#B71C1C' }}>{fcfa(totalDepenses)}</div>
            </div>
            <div style={{ ...styleCarte, backgroundColor: resultat >= 0 ? '#EAF5EC' : '#FBEAEA' }}>
              <div style={styleTitreCarte}>Résultat après dépenses</div>
              <div style={{ ...styleValeurCarte, color: resultat >= 0 ? '#2E7D32' : '#B71C1C' }}>{fcfa(resultat)}</div>
              <div style={styleDetailCarte}>Bénéfice sur ventes − dépenses</div>
            </div>
            <div style={{ ...styleCarte, backgroundColor: '#FDECE1' }}>
              <div style={styleTitreCarte}>Total Achats Fournisseurs</div>
              <div style={{ ...styleValeurCarte, color: '#C9822A' }}>{fcfa(totalAchats)}</div>
              <div style={styleDetailCarte}>
                Pour information : le stock acheté n'est pas une perte, seul le coût des produits vendus compte dans le bénéfice.
              </div>
            </div>
          </div>
        </>
      ) : (
        <div style={{ ...styleCarte, backgroundColor: '#FBEAEA', marginBottom: '25px', maxWidth: '300px' }}>
          <div style={styleTitreCarte}>Total Dépenses</div>
          <div style={{ ...styleValeurCarte, color: '#B71C1C' }}>{fcfa(totalDepenses)}</div>
        </div>
      )}

      <div style={{ marginBottom: '20px', padding: '18px', backgroundColor: '#FFFFFF', border: '1px solid #E6E0D6', borderRadius: '10px' }}>
        <h4>Ajouter une dépense</h4>
        <input
          style={styleInput}
          placeholder="Catégorie (ex: transport, loyer)"
          value={categorie}
          onChange={(e) => setCategorie(e.target.value)}
        />
        <input
          style={styleInput}
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <input
          style={styleInput}
          placeholder="Montant"
          type="number"
          value={montant}
          onChange={(e) => setMontant(e.target.value)}
        />
        <div style={{ display: 'inline-block', verticalAlign: 'top' }}>
          <label style={{ display: 'block', fontSize: '12px', color: '#6B6357', marginBottom: '2px' }}>
            Date de la dépense
          </label>
          <input
            style={styleInput}
            type="date"
            value={dateDepense}
            max={dateDuJour()}
            onChange={(e) => setDateDepense(e.target.value)}
          />
        </div>
        <p style={{ fontSize: '12px', color: '#6B6357', margin: '0 0 10px' }}>
          💡 Si la dépense concerne un autre jour (ex : courant du 07/10), choisissez ce jour-là : elle sera comptée dans le bénéfice du bon jour.
        </p>
        <button style={styleBouton} onClick={ajouterDepense}>+ Ajouter la dépense</button>
      </div>

      <h4>Historique des dépenses</h4>
      {depenses.length === 0 && <p>Aucune dépense enregistrée.</p>}
      {depenses.map((d) => (
        <div
          key={d.id}
          style={{
            padding: '14px',
            marginBottom: '8px',
            border: depenseEnEdition === d.id ? '2px solid #C9822A' : '1px solid #E6E0D6',
            borderRadius: '10px',
            backgroundColor: '#fff',
          }}
        >
          {depenseEnEdition === d.id ? (
            <div>
              <div style={{ fontWeight: 600, marginBottom: '8px', color: '#6B4A1F' }}>✏️ Modifier la dépense</div>
              <input
                style={styleInput}
                placeholder="Catégorie"
                value={editCategorie}
                onChange={(e) => setEditCategorie(e.target.value)}
              />
              <input
                style={styleInput}
                placeholder="Description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
              <input
                style={styleInput}
                placeholder="Montant"
                type="number"
                value={editMontant}
                onChange={(e) => setEditMontant(e.target.value)}
              />
              <div style={{ display: 'inline-block', verticalAlign: 'top' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#6B6357', marginBottom: '2px' }}>
                  Date de la dépense
                </label>
                <input
                  style={styleInput}
                  type="date"
                  value={editDate}
                  max={dateDuJour()}
                  onChange={(e) => setEditDate(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <button
                  style={{ ...styleBouton, padding: '8px 16px', backgroundColor: '#2E7D32' }}
                  onClick={() => enregistrerEdition(d)}
                  disabled={enregistrementEdition}
                >
                  {enregistrementEdition ? 'Enregistrement...' : '✅ Enregistrer'}
                </button>
                <button style={{ ...styleBoutonSecondaire, padding: '8px 16px' }} onClick={fermerEdition}>
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
              <div>
                <strong>{d.categorie || 'Sans catégorie'}</strong>
                {d.description && <span style={{ color: '#6B6357' }}> — {d.description}</span>}
                {d.created_at && (
                  <div style={{ fontSize: '12px', color: '#6B6357', marginTop: '3px' }}>
                    📅 {new Date(d.created_at).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </div>
                )}
                {peutVoirFinances && (
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <button style={{ ...styleBoutonSecondaire, color: '#6B4A1F' }} onClick={() => ouvrirEdition(d)}>
                      ✏️ Modifier
                    </button>
                    <button style={{ ...styleBoutonSecondaire, color: '#B71C1C' }} onClick={() => supprimerDepense(d)}>
                      🗑️ Supprimer
                    </button>
                  </div>
                )}
              </div>
              <div style={{ fontWeight: 700, color: '#B71C1C', whiteSpace: 'nowrap' }}>-{fcfa(d.montant)}</div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default Depenses
