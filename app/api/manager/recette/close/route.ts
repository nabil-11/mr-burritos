import { NextRequest, NextResponse } from 'next/server'
import { failJson as fail, requireManager } from '@/lib/managerAuth'
import { badRequest, failFromError, readBody } from '@/lib/managerWrite'
import { closedOf, figuresChanged, parseCloseBody } from '@/lib/managerRecette'
import { blockersFor, drawerExpected, recetteView } from '@/lib/managerRecetteData'
import { cashDifference, cashInDrawer, closeRecette, getOpenRecette, recetteTotals } from '@/lib/recette'

export const dynamic = 'force-dynamic'

/**
 * POST /api/manager/recette/close — clôture la recette ouverte.
 *
 * Body : { recetteId, closingCash: number | null, notCounted: boolean,
 * expectedCash: number, notes? }.
 *   — compté : `closingCash` de 0 à 1000000 (virgule acceptée, 2 décimales),
 *     `notCounted: false` ;
 *   — non compté : `closingCash: null` avec `notCounted: true`, rien d'autre.
 * `expectedCash` est le chiffre que l'écran a montré : si le serveur en a un
 * autre (plus de 0,005 DT d'écart), rien n'est clos et la réponse porte la
 * recette fraîche pour que l'écran se relise.
 *
 * Gardes, dans l'ordre : aucune recette ouverte ; `recetteId` n'est pas la
 * recette ouverte ; des commandes en cours (pending, confirmed, preparing) ;
 * des chiffres qui ont bougé. Puis `closeRecette` (lib/recette), dont le
 * passage ouvert -> clos est atomique : deux clôtures simultanées, une seule
 * passe, l'autre reçoit 409 recette_closed. La recette clôturée est figée,
 * comme celle de la caisse. L'ancien PATCH /api/recettes/:id reste tel quel.
 *
 * Écriture : l'en-tête Bearer seul, jamais le cookie. L'auteur est l'e-mail du
 * compte, relu en base.
 *
 * Returns `{ recette: { number, closedAt, closedBy, closingCash, cashExpected,
 * cashDifference } }`. Errors are `{ error, code }`: 401 unauthorized,
 * 403 forbidden, 400 bad_request, 404 no_open_recette, 409 orders_in_progress
 * (+ `blockers`), 409 figures_changed (+ `recette: Obj`), 409 recette_closed,
 * 500 server_error.
 */
export async function POST(req: NextRequest) {
  try {
    const who = await requireManager(req, { bearerOnly: true })
    if (who instanceof Response) return who

    const body = await readBody(req)
    if (!body) return badRequest('Corps JSON attendu')
    const parsed = parseCloseBody(body)
    if (!parsed.ok) return badRequest(parsed.message)
    const { recetteId, closingCash, expectedCash, notes } = parsed.value

    const open = (await getOpenRecette()) as { _id: unknown; status?: string; openingFloat?: number } | null
    if (!open) return fail(404, 'no_open_recette', 'Aucune recette ouverte')
    if (String(open._id) !== recetteId) return fail(409, 'recette_closed', 'Cette recette est clôturée')

    const { blockers } = await blockersFor(open._id)
    if (blockers.count > 0) {
      return fail(409, 'orders_in_progress', 'Des commandes sont encore en cours', { blockers })
    }
    if (figuresChanged(expectedCash, await drawerExpected(open))) {
      return fail(409, 'figures_changed', 'Les chiffres ont changé', { recette: await recetteView(open) })
    }

    const closed = await closeRecette(recetteId, { userId: who._id as string, userName: who.email, closingCash, notes })
    const totals = await recetteTotals(closed, { persist: false })
    return NextResponse.json(
      {
        recette: closedOf(closed, {
          cashExpected: cashInDrawer(closed, totals),
          cashDifference: cashDifference(closed, totals),
        }),
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (e) {
    return failFromError(e)
  }
}
