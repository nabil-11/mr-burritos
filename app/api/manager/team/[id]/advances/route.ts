import { NextRequest, NextResponse } from 'next/server'
import { accountOf } from '@/lib/employeeAccount'
import { failJson as fail, requireManager } from '@/lib/managerAuth'
import { advanceHistoryOf } from '@/lib/managerAdvances'

export const dynamic = 'force-dynamic'

/**
 * GET /api/manager/team/:id/advances — one employee's whole advance history.
 *
 * Read-only: `accountOf` reads. Advances only (not salary paid from the till),
 * newest first; cancelled ones are listed with `cancelled: true` and left out
 * of `totals` and `months`. Whitelisted shape (lib/managerAdvances): the
 * recette number, never its id.
 *
 * Errors are `{ error, code }`: 401 unauthorized, 403 forbidden,
 * 404 not_found (unknown or invalid id), 500 server_error.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const who = await requireManager(req)
    if (who instanceof Response) return who

    const { id } = await ctx.params
    const account = await accountOf(id)
    if (!account) return fail(404, 'not_found', 'Employé introuvable')

    return NextResponse.json(advanceHistoryOf(account), { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return fail(500, 'server_error', 'Erreur serveur')
  }
}
