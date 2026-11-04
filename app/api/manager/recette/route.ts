import { NextRequest, NextResponse } from 'next/server'
import { failJson as fail, requireManager } from '@/lib/managerAuth'
import { getOpenRecette } from '@/lib/recette'
import { recetteView } from '@/lib/managerRecetteData'

export const dynamic = 'force-dynamic'

/**
 * GET /api/manager/recette — la recette ouverte, pour la clôturer ou y noter
 * un mouvement depuis le téléphone.
 *
 * Returns `{ recette: null }` caisse fermée, sinon `{ recette: Obj }` : le
 * fond de caisse, ce que le tiroir doit contenir (`cashExpected`), les
 * mouvements (annulés compris, marqués), les commandes qui bloquent la
 * clôture (`blockers`: pending, confirmed, preparing) et le nombre de commandes
 * prêtes (`readyCount`, qui ne bloquent pas). Liste blanche : lib/managerRecette.
 *
 * Lecture seule. Errors are `{ error, code }`: 401 unauthorized,
 * 403 forbidden, 500 server_error.
 */
export async function GET(req: NextRequest) {
  try {
    const who = await requireManager(req)
    if (who instanceof Response) return who

    const open = await getOpenRecette()
    return NextResponse.json(
      { recette: open ? await recetteView(open) : null },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch {
    return fail(500, 'server_error', 'Erreur serveur')
  }
}
