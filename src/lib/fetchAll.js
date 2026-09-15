import { supabase } from './supabaseClient'

// Récupère TOUTES les lignes d'une table pour une boutique, page par page.
// Pourquoi : Supabase/PostgREST peut limiter le nombre de lignes renvoyées par
// une seule requête (souvent 1000) — au-delà, les lignes en trop sont
// simplement absentes de la réponse, SANS message d'erreur. Pour une boutique
// active avec beaucoup d'historique (ventes, articles vendus...), une requête
// simple `.select()` peut donc silencieusement ne renvoyer qu'une partie des
// données, ce qui fausse des calculs comme le bénéfice. Cette fonction trie
// par "id" (toujours unique) pour garantir qu'aucune ligne n'est sautée ni
// comptée deux fois d'une page à l'autre.
const TAILLE_PAGE = 1000

export async function fetchAllRows(table, boutiqueId, colonnes = '*') {
  let tous = []
  let depart = 0

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(colonnes)
      .eq('boutique_id', boutiqueId)
      .order('id', { ascending: false })
      .range(depart, depart + TAILLE_PAGE - 1)

    if (error) {
      console.error(`Erreur de chargement de la table ${table} :`, error)
      return { data: tous, error }
    }

    tous = tous.concat(data || [])

    if (!data || data.length < TAILLE_PAGE) break
    depart += TAILLE_PAGE
  }

  return { data: tous, error: null }
}
