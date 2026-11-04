import { NextRequest, NextResponse } from 'next/server'
import { requireManager } from '@/lib/managerAuth'
import { badRequest, failFromError, readBody } from '@/lib/managerWrite'
import { recetteView } from '@/lib/managerRecetteData'
import { cancelMovement } from '@/lib/recette'

export const dynamic = 'force-dynamic'

const OBJECT_ID = /^[0-9a-fA-F]{24}$/

/**
 * POST /api/manager/recette/movements/:movementId/cancel — annule une ligne.
 *
 * Body : { recetteId }. La ligne n'est pas supprimée : elle reste sur la
 * recette, barrée, avec l'heure et l'auteur, et sort des totaux
 * (`cancelMovement`, lib/recette).
 *
 * Écriture : l'en-tête Bearer seul, jamais le cookie. L'auteur est l'e-mail du
 * compte, relu en base.
 *
 * Returns `{ recette: Obj }`. Errors are `{ error, code }`: 401 unauthorized,
 * 403 forbidden, 400 bad_request, 404 not_found, 409 recette_closed,
 * 409 already_cancelled, 500 server_error.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ movementId: string }> }) {
  try {
    const who = await requireManager(req, { bearerOnly: true })
    if (who instanceof Response) return who

    const body = await readBody(req)
    if (!body) return badRequest('Corps JSON attendu')
    if (typeof body.recetteId !== 'string' || !OBJECT_ID.test(body.recetteId)) return badRequest('recetteId invalide')

    const { movementId } = await ctx.params
    const recette = await cancelMovement(body.recetteId, movementId, who.email, who._id)
    return NextResponse.json({ recette: await recetteView(recette) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    return failFromError(e)
  }
}
