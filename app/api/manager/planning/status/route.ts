import { NextRequest, NextResponse } from 'next/server'
import { PlanningValidation } from '@/lib/models/PlanningValidation'
import { failJson as fail, requireManager } from '@/lib/managerAuth'
import { DEFAULT_TIME_ZONE, dayOf } from '@/lib/reportTime'
import { deadlineAt, deadlinePassed, nextMondays, readDeadlineSetting } from '@/lib/planningDeadline'

export const dynamic = 'force-dynamic'

/**
 * GET /api/manager/planning/status — les deux prochaines semaines de planning
 * (leur lundi), et pour chacune : validée ou non, par qui, et son échéance.
 *
 * `deadline.weekday` 0 est lundi, comme lib/planning. `deadlineAt` est
 * l'instant de l'échéance (le jour réglé avant ce lundi, à l'heure réglée à
 * Tunis) en ISO UTC. Le réglage vit dans Configuration, clé
 * `planning.validationDeadline` ; absent ou invalide, jeudi 18:00.
 *
 * Lecture seule. Errors are `{ error, code }`: 401 unauthorized,
 * 403 forbidden, 500 server_error.
 */
export async function GET(req: NextRequest) {
  try {
    const who = await requireManager(req)
    if (who instanceof Response) return who

    const now = new Date()
    const deadline = await readDeadlineSetting()
    const mondays = nextMondays(dayOf(now, DEFAULT_TIME_ZONE), 2)
    const marks = (await PlanningValidation.find({ weekStart: { $in: mondays } })
      .select('weekStart validatedBy validatedAt')
      .lean()) as { weekStart: string; validatedBy?: { name?: string } | null; validatedAt?: Date }[]
    const byWeek = new Map(marks.map((m) => [m.weekStart, m]))

    return NextResponse.json(
      {
        tz: DEFAULT_TIME_ZONE,
        deadline,
        weeks: mondays.map((monday) => {
          const mark = byWeek.get(monday)
          const at = deadlineAt(monday, deadline)
          return {
            monday,
            validated: Boolean(mark),
            validatedBy: mark ? (mark.validatedBy?.name ?? '') : null,
            validatedAt: mark?.validatedAt ? new Date(mark.validatedAt).toISOString() : null,
            deadlineAt: at.toISOString(),
            deadlinePassed: deadlinePassed(at, now),
          }
        }),
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch {
    return fail(500, 'server_error', 'Erreur serveur')
  }
}
