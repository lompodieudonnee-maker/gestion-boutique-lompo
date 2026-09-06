import { supabase } from './supabaseClient'

function dateDuJour() {
  return new Date().toISOString().split('T')[0]
}

export function heureLisible(date) {
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

// Renvoie le pointage du jour de cet employé (ou null s'il n'a encore rien pointé aujourd'hui)
export async function pointageDuJour(employeId) {
  const { data } = await supabase
    .from('pointages')
    .select('*')
    .eq('employe_id', employeId)
    .eq('date', dateDuJour())
    .maybeSingle()
  return data
}

// Enregistre l'heure d'arrivée du jour (crée la ligne si elle n'existe pas encore)
export async function enregistrerArrivee(employeId, boutiqueId) {
  const maintenant = new Date()
  const { data, error } = await supabase
    .from('pointages')
    .upsert(
      {
        employe_id: employeId,
        boutique_id: boutiqueId,
        date: dateDuJour(),
        heure_arrivee: maintenant.toISOString(),
      },
      { onConflict: 'employe_id,date', ignoreDuplicates: false }
    )
    .select()
    .single()

  return { data, error, heure: heureLisible(maintenant) }
}

// Enregistre l'heure de départ sur le pointage du jour déjà ouvert
export async function enregistrerDepart(pointageId) {
  const maintenant = new Date()
  const { data, error } = await supabase
    .from('pointages')
    .update({ heure_depart: maintenant.toISOString() })
    .eq('id', pointageId)
    .select()
    .single()

  return { data, error, heure: heureLisible(maintenant) }
}

// Ouvre WhatsApp avec un message pré-rempli vers le numéro du responsable (l'employé doit appuyer sur Envoyer)
export function envoyerWhatsAppPointage(numeroBrut, message) {
  const numero = (numeroBrut || '').replace(/[^0-9]/g, '')
  if (!numero) return false
  window.open(`https://wa.me/${numero}?text=${encodeURIComponent(message)}`, '_blank')
  return true
}
