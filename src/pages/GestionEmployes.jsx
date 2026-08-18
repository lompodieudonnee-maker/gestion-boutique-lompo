import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getBoutiqueId } from '../lib/boutique'

const PERMISSIONS = [
  { cle: 'voir_finances', label: 'Voir les finances (bénéfices, dettes)' },
  { cle: 'peut_gerer_fournisseurs', label: 'Gérer les fournisseurs' },
]

function GestionEmployes() {
  const [employes, setEmployes] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState('')

  const [nom, setNom] = useState('')
  const [pin, setPin] = useState('')
  const [role, setRole] = useState('employe')

  const employeConnecte = JSON.parse(localStorage.getItem('employeConnecte'))
  const boutiqueId = getBoutiqueId()

  useEffect(() => {
    chargerEmployes()
  }, [])

  async function chargerEmployes() {
    setChargement(true)
    const { data, error } = await supabase
      .from('employes')
      .select('*')
      .eq('boutique_id', employeConnecte.boutiqueId)
      .order('created_at', { ascending: true })

    if (error) {
      setErreur("Erreur lors du chargement des employés")
    } else {
      setEmployes(data)
    }
    setChargement(false)
  }

  async function handleAjouterEmploye(e) {
    e.preventDefault()
    setErreur('')

    if (pin.length !== 4) {
      setErreur('Le code PIN doit contenir 4 chiffres')
      return
    }

    const { error } = await supabase
      .from('employes')
      .insert({
        nom,
        pin,
        role,
                boutique_id: boutiqueId,
        voir_finances: false,
        peut_gerer_fournisseurs: false,
      })

    if (error) {
      setErreur("Erreur lors de l'ajout de l'employé (le PIN est peut-être déjà utilisé)")
      return
    }

    setNom('')
    setPin('')
    setRole('employe')
    chargerEmployes()
  }

  async function handleTogglePermission(employe, cle) {
    const { error } = await supabase
      .from('employes')
      .update({ [cle]: !employe[cle] })
      .eq('id', employe.id)

    if (error) {
      setErreur('Erreur lors de la mise à jour des permissions')
      return
    }
    chargerEmployes()
  }

  async function handleSupprimer(id) {
    if (!confirm('Supprimer cet employé ?')) return

    const { error } = await supabase
      .from('employes')
      .delete()
      .eq('id', id)

    if (error) {
      setErreur("Erreur lors de la suppression")
      return
    }
    chargerEmployes()
  }

  if (chargement) return <p style={{ padding: '20px' }}>Chargement...</p>

  return (
    <div style={{ padding: '20px' }}>
      <h2>🔑 Gestion des employés</h2>

      {erreur && <p style={{ color: 'red' }}>{erreur}</p>}

      <form onSubmit={handleAjouterEmploye} style={{ marginBottom: '30px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
        <h3>Ajouter un employé</h3>
        <input
          type="text"
          placeholder="Nom"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          required
          style={{ marginRight: '10px', padding: '8px' }}
        />
        <input
          type="password"
          inputMode="numeric"
          maxLength="4"
          placeholder="Code PIN (4 chiffres)"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          required
          style={{ marginRight: '10px', padding: '8px', width: '150px' }}
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          style={{ marginRight: '10px', padding: '8px' }}
        >
          <option value="employe">Employé</option>
          <option value="proprietaire">Propriétaire</option>
        </select>
        <button type="submit" style={{ padding: '8px 16px' }}>Ajouter</button>
      </form>

      <h3>Liste des employés</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ backgroundColor: '#333', color: 'white' }}>
            <th style={{ padding: '10px', textAlign: 'left' }}>Nom</th>
            <th style={{ padding: '10px', textAlign: 'left' }}>Rôle</th>
            {PERMISSIONS.map((p) => (
              <th key={p.cle} style={{ padding: '10px', textAlign: 'center' }}>{p.label}</th>
            ))}
            <th style={{ padding: '10px' }}></th>
          </tr>
        </thead>
        <tbody>
          {employes.map((employe) => (
            <tr key={employe.id} style={{ borderBottom: '1px solid #ddd' }}>
              <td style={{ padding: '10px' }}>{employe.nom}</td>
              <td style={{ padding: '10px' }}>{employe.role}</td>
              {PERMISSIONS.map((p) => (
                <td key={p.cle} style={{ padding: '10px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={employe.role === 'proprietaire' ? true : !!employe[p.cle]}
                    disabled={employe.role === 'proprietaire'}
                    onChange={() => handleTogglePermission(employe, p.cle)}
                  />
                </td>
              ))}
              <td style={{ padding: '10px' }}>
                {employe.role !== 'proprietaire' && (
                  <button onClick={() => handleSupprimer(employe.id)} style={{ color: 'red', border: 'none', background: 'none', cursor: 'pointer' }}>
                    Supprimer
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default GestionEmployes
