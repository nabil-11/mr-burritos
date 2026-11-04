import { NextRequest, NextResponse } from 'next/server'
import { requireManager } from '@/lib/managerAuth'
import { failFromError } from '@/lib/managerWrite'
import { statusDates } from '@/lib/attendance'
import { loadStatus } from '@/lib/attendanceData'
import { DEFAULT_TIME_ZONE, dayOf } from '@/lib/reportTime'

export const dynamic = 'force-dynamic'

/**
 * GET /api/manager/attendance/status — l'état du pointage des trois derniers
 * jours (avant-hier, hier, aujourd'hui), le plus ancien d'abord.
 *
 * Pour chaque jour : combien d'employés y sont planifiés `travail`, s'il est
 * validé (par qui, quand), l'échéance de validation (`deadlineAt`, ISO UTC) et
 * si elle est passée, et `editableUntil` : l'instant où un gérant ne peut plus
 * écrire ce jour (début du jour + 3, Tunis). `deadline` est le réglage
 * `attendance.validationDeadline` ({ afterDays: 1, time: '12:00' } par défaut).
 *
 * Lecture seule. Errors are `{ error, code }`: 401 unauthorized,
 * 403 forbidden, 500 server_error.
 */
export async function GET(req: NextRequest) {
  try {
    const who = await requireManager(req)
    if (who instanceof Response) return who

    const now = new Date()
    const body = await loadStatus(now, who.role, statusDates(dayOf(now, DEFAULT_TIME_ZONE)))
    return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    return failFromError(e)
  }
}
