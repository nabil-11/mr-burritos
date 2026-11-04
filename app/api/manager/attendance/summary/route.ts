import { NextRequest, NextResponse } from 'next/server'
import { requireManager } from '@/lib/managerAuth'
import { failFromError } from '@/lib/managerWrite'
import { parseSummaryRange } from '@/lib/attendance'
import { loadSummary } from '@/lib/attendanceData'
import { DEFAULT_TIME_ZONE, dayOf } from '@/lib/reportTime'

export const dynamic = 'force-dynamic'

/**
 * GET /api/manager/attendance/summary?from=&to=&employeeId? — les heures
 * réelles d'une période, par employé et en total.
 *
 * Les jours validés seulement comptent. `validatedDays` : jours validés où
 * l'employé a une ligne ; `unvalidatedDays` : jours passés non validés où le
 * planning le met au travail (ses heures sont alors incomplètes). Avec
 * `employeeId`, l'employé porte aussi `days`. `totals` additionne les employés.
 *
 * Lecture seule. Errors are `{ error, code }`: 401 unauthorized, 403 forbidden,
 * 400 bad_request, 400 range_too_long (plus de 92 jours, bornes comprises),
 * 404 not_found (employeeId), 500 server_error.
 */
export async function GET(req: NextRequest) {
  try {
    const who = await requireManager(req)
    if (who instanceof Response) return who

    const q = req.nextUrl.searchParams
    const { from, to } = parseSummaryRange(q.get('from'), q.get('to'))
    const today = dayOf(new Date(), DEFAULT_TIME_ZONE)
    const body = await loadSummary(from, to, today, q.get('employeeId') || null)
    return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    return failFromError(e)
  }
}
