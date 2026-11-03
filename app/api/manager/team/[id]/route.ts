import { NextRequest, NextResponse } from 'next/server'
import { accountOf } from '@/lib/employeeAccount'
import { failJson as fail, requireManager } from '@/lib/managerAuth'
import { detailOf, resolveMonth } from '@/lib/managerTeam'
import { currentMonth } from '@/lib/payroll'

export const dynamic = 'force-dynamic'

/**
 * GET /api/manager/team/:id?month=YYYY-MM — one employee's account.
 *
 * Read-only: `accountOf` reads. The month's lines come newest first, cancelled
 * ones kept with `cancelled: true` and left out of every total. Whitelisted
 * shape (lib/managerTeam): no phone, CIN, address, notes, opening balance or
 * recette id — only the recette number.
 *
 * Errors are `{ error, code }`: 401 unauthorized, 403 forbidden,
 * 400 bad_request, 404 not_found (unknown or invalid id), 500 server_error.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const who = await requireManager(req)
    if (who instanceof Response) return who

    const thisMonth = currentMonth()
    const month = resolveMonth(req.nextUrl.searchParams.get('month'), thisMonth)
    if (!month) return fail(400, 'bad_request', 'Paramètre month invalide : AAAA-MM attendu')

    const { id } = await ctx.params
    const account = await accountOf(id)
    if (!account) return fail(404, 'not_found', 'Employé introuvable')

    return NextResponse.json(detailOf(account, month, thisMonth), { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return fail(500, 'server_error', 'Erreur serveur')
  }
}
