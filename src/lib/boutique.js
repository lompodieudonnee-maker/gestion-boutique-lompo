export function getBoutiqueId() {
  const employe = JSON.parse(localStorage.getItem('employeConnecte'))

  if (employe?.role === 'superadmin') {
    const idActive = localStorage.getItem('boutiqueActiveId')
    return idActive ? parseInt(idActive) : null
  }

  return employe?.boutique_id
}
