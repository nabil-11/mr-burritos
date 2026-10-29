import { NextResponse } from 'next/server'
import { getBuilderCategories } from '@/lib/builder'
import { resolveExtras, type MenuExtras, type ResolvedSuggestion } from '@/lib/menuExtras'

/**
 * GET /api/menu/extras — les suggestions du panier (« Une boisson avec ça ? »),
 * pour le tiroir et la page panier, qui n'ont pas la carte sous la main.
 *
 * Lecture seule, mise en cache comme la page d'accueil : la carte ne change
 * pas d'une minute à l'autre. Les produits sont allégés de leurs suppléments —
 * une suggestion s'ajoute telle quelle, d'un geste.
 */
export const revalidate = 300

const slim = (s: ResolvedSuggestion): ResolvedSuggestion => ({
  ...s,
  products: s.products.map((p) => ({ ...p, description: { fr: '' }, supplements: [] })),
})

export async function GET() {
  try {
    const extras = resolveExtras(await getBuilderCategories())
    const body: MenuExtras = {
      cart: extras.cart.map(slim),
      upsell: extras.upsell.map(slim),
      afterAdd: extras.afterAdd ? slim(extras.afterAdd) : null,
      drinkIds: extras.drinkIds,
    }
    return NextResponse.json(body)
  } catch {
    // Une base injoignable ne doit pas casser le panier : pas de suggestion, c'est tout.
    return NextResponse.json({ cart: [], upsell: [], afterAdd: null, drinkIds: [] } satisfies MenuExtras)
  }
}
