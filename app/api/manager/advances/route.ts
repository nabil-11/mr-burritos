import { NextRequest, NextResponse } from 'next/server'
import { linesOfAll } from '@/lib/employeeAccount'
import { failJson as fail, requireManager } from '@/lib/managerAuth'
import { advancesInRange, resolveRange } from '@/lib/managerAdvances'
import { DEFAULT_TIME_ZONE, dayOf } from '@/lib/reportTime'

export const dynamic = 'force-dynamic'

/**
 * GET /api/manager/advances?from=YYYY-MM-DD&to=YYYY-MM-DD — every employee's
 * advances over a period, in Africa/Tunis days.
 *
 * Read-only: it reads the same lines as the account. No `from`/`to`: the
 * current month. At most 366 days. Cancelled advances are listed with
 * `cancelled: true` and excluded from `totals` and `byEmployee`.
 *
 * Errors are `{ error, code }`: 401 unauthorized, 403 forbidden,
 * 400 bad_request (bad day, from after to, range over 366 days), 500 server_error.
 */
export async function GET(req: NextRequest) {
  try {
    const who = await requireManager(req)
    if (who instanceof Response) return who

    const q = req.nextUrl.searchParams
    const range = resolveRange(q.get('from'), q.get('to'), dayOf(new Date(), DEFAULT_TIME_ZONE))
    if (!range) return fail(400, 'bad_request', 'Période invalide : from et to en AAAA-MM-JJ, 366 jours au plus')

    const list = await linesOfAll()
    return NextResponse.json(advancesInRange(list, range), { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return fail(500, 'server_error', 'Erreur serveur')
  }
}
