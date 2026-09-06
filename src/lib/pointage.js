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

// À appeler IMMÉDIATEMENT au clic (avant tout await), pour ouvrir l'onglet pendant que le navigateur
// considère encore l'action comme déclenchée par l'utilisateur (sinon le bloqueur de pop-up l'empêche).
// On y mettra l'adresse WhatsApp une fois les informations prêtes (voir envoyerWhatsAppPointage).
export function ouvrirFenetreWhatsApp() {
  try {
    return window.open('', '_blank')
  } catch (e) {
    return null
  }
}

// Ouvre WhatsApp avec un message pré-rempli vers le numéro du responsable (l'employé doit appuyer sur Envoyer).
// Si fenetreExistante est fournie (via ouvrirFenetreWhatsApp), on l'utilise pour éviter le bloqueur de pop-up ;
// sinon on tente un window.open classique (peut être bloqué si appelé après un await).
export function envoyerWhatsAppPointage(numeroBrut, message, fenetreExistante) {
  const numero = (numeroBrut || '').replace(/[^0-9]/g, '')
  if (!numero) {
    if (fenetreExistante) fenetreExistante.close()
    return false
  }
  const url = `https://wa.me/${numero}?text=${encodeURIComponent(message)}`
  if (fenetreExistante) {
    fenetreExistante.location.href = url
  } else {
    window.open(url, '_blank')
  }
  return true
}
