import { NextRequest, NextResponse } from 'next/server'
import { overview } from '@/lib/employeeAccount'
import { failJson as fail, requireManager } from '@/lib/managerAuth'
import { resolveMonth, teamOf } from '@/lib/managerTeam'
import { currentMonth } from '@/lib/payroll'

export const dynamic = 'force-dynamic'

/**
 * GET /api/manager/team?month=YYYY-MM — the team's month for the owner's phone.
 *
 * Read-only: it only calls `overview`, which reads. The shape is a whitelist
 * (lib/managerTeam): no phone, CIN, address, notes or opening balance.
 * `month` is in Africa/Tunis, defaults to the current month, and a future month
 * is clamped to it.
 *
 * Errors are `{ error, code }`: 401 unauthorized, 403 forbidden,
 * 400 bad_request, 500 server_error.
 */
export async function GET(req: NextRequest) {
  try {
    const who = await requireManager(req)
    if (who instanceof Response) return who

    const thisMonth = currentMonth()
    const month = resolveMonth(req.nextUrl.searchParams.get('month'), thisMonth)
    if (!month) return fail(400, 'bad_request', 'Paramètre month invalide : AAAA-MM attendu')

    const list = await overview(month)
    return NextResponse.json(teamOf(list, month, thisMonth), { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return fail(500, 'server_error', 'Erreur serveur')
  }
}
