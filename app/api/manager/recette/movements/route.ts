import { NextRequest, NextResponse } from 'next/server'
import { failJson as fail, requireManager } from '@/lib/managerAuth'
import { badRequest, failFromError, readBody } from '@/lib/managerWrite'
import { movementOf, parseMovementBody, type MovementDoc } from '@/lib/managerRecette'
import { recetteView } from '@/lib/managerRecetteData'
import { addMovementOnce, getOpenRecette } from '@/lib/recette'

export const dynamic = 'force-dynamic'

/**
 * POST /api/manager/recette/movements — un mouvement de caisse, une fois.
 *
 * Body : { recetteId, key, kind: achat | depense | apport | retrait, label?,
 * amount, note?, employeeId? }.
 *
 * `key` est générée par l'app à l'ouverture du formulaire (16 à 64 caractères,
 * lettres, chiffres, tirets) et gardée pour les nouvelles tentatives : le
 * même `key` sur la même recette n'écrit jamais deux lignes, l'écriture est
 * atomique (lib/recette addMovementOnce). Un rejeu rend 200 avec la ligne déjà
 * écrite et `replayed: true`.
 *
 * `employeeId` : une avance. Le serveur impose kind depense et motif avance ;
 * « salaire » demandé par un client est refusé. Un employé parti ne reçoit
 * plus d'avance. Un seul mouvement par appel.
 *
 * Écriture : l'en-tête Bearer seul, jamais le cookie. L'auteur est l'e-mail du
 * compte, relu en base ; le corps n'en porte pas.
 *
 * Returns 201 `{ movement, recette: Obj }` (200 avec `replayed: true` au
 * rejeu). Errors are `{ error, code }`: 401 unauthorized, 403 forbidden,
 * 400 bad_request, 404 no_open_recette, 409 key_conflict (même clé, autre
 * type, montant, libellé ou employé : `{ movement: la ligne gardée, recette: Obj }`), 409 recette_closed (aussi quand
 * `recetteId` n'est pas la recette ouverte), 500 server_error.
 */
export async function POST(req: NextRequest) {
  try {
    const who = await requireManager(req, { bearerOnly: true })
    if (who instanceof Response) return who

    const body = await readBody(req)
    if (!body) return badRequest('Corps JSON attendu')
    const parsed = parseMovementBody(body)
    if (!parsed.ok) return badRequest(parsed.message)
    const { recetteId, key, input } = parsed.value

    const open = (await getOpenRecette()) as { _id: unknown } | null
    if (!open) return fail(404, 'no_open_recette', 'Aucune recette ouverte')
    if (String(open._id) !== recetteId) return fail(409, 'recette_closed', 'Cette recette est clôturée')

    const done = await addMovementOnce(recetteId, input, { userId: who._id, name: who.email }, key)
    const line = done.movement as { toObject?: () => unknown }
    const movement = movementOf((typeof line.toObject === 'function' ? line.toObject() : line) as MovementDoc)
    // Même clé, autre demande : on ne rend pas en silence une ligne qui n'est
    // pas celle qu'on a demandée. Même pattern que figures_changed.
    if (done.conflict) {
      return fail(409, 'key_conflict', 'Cette clé a déjà servi pour un autre mouvement', {
        movement,
        recette: await recetteView(done.recette),
      })
    }
    return NextResponse.json(
      { movement, recette: await recetteView(done.recette), ...(done.replayed ? { replayed: true } : {}) },
      { status: done.replayed ? 200 : 201, headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (e) {
    return failFromError(e)
  }
}
