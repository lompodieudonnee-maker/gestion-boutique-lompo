import { supabase } from './supabaseClient'

// Nombre de lignes récupérées par page. Supabase/PostgREST limite parfois le
// nombre de lignes renvoyées par une seule requête (souvent 1000) : au-delà,
// les lignes en trop sont simplement absentes de la réponse, SANS erreur.
// Cette fonction relit donc les mouvements de stock page par page jusqu'à
// avoir vraiment tout récupéré, pour que le stock calculé soit toujours exact
// même quand une boutique accumule beaucoup d'historique.
const TAILLE_PAGE = 1000

export async function chargerTousLesMouvementsStock(boutiqueId, colonnes = '*') {
  let tous = []
  let depart = 0

  while (true) {
    const { data, error } = await supabase
      .from('stock_mouvements')
      .select(colonnes)
      .eq('boutique_id', boutiqueId)
      .order('created_at', { ascending: false })
      .range(depart, depart + TAILLE_PAGE - 1)

    if (error) {
      console.error('Erreur de chargement des mouvements de stock :', error)
      return { data: tous, error }
    }

    tous = tous.concat(data || [])

    if (!data || data.length < TAILLE_PAGE) break
    depart += TAILLE_PAGE
  }

  return { data: tous, error: null }
}
