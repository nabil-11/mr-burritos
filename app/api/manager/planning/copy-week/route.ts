import { NextRequest, NextResponse } from 'next/server'
import { failJson as fail, requireManager } from '@/lib/managerAuth'
import { badRequest, failFromError, readBody } from '@/lib/managerWrite'
import { copyPlanning } from '@/lib/planningData'
import { copyWeekRequest, parseCopyWeek } from '@/lib/planningDeadline'
import { DEFAULT_TIME_ZONE, dayOf } from '@/lib/reportTime'

export const dynamic = 'force-dynamic'

/**
 * POST /api/manager/planning/copy-week — recopie la semaine d'avant.
 *
 * Body : { week: 'AAAA-MM-JJ' } — le lundi visé, une semaine après la semaine
 * en cours (la semaine en cours ou une passée : 400 past_week) et au plus tard
 * dans un an (400 bad_request). Appelle `copyPlanning({ mode: 'week', from: week - 7, weeks: 1 })`
 * (lib/planningData) : les jours de la semaine visée sont remplacés, pour tous
 * les employés actifs.
 *
 * Écriture : l'en-tête Bearer seul, jamais le cookie. L'auteur est l'e-mail du
 * compte, relu en base.
 *
 * Returns `{ ok: true, days, employees }`. Errors are `{ error, code }`:
 * 401 unauthorized, 403 forbidden, 400 bad_request, 400 past_week,
 * 404 not_found (aucun employé actif), 500 server_error.
 */
export async function POST(req: NextRequest) {
  try {
    const who = await requireManager(req, { bearerOnly: true })
    if (who instanceof Response) return who

    const body = await readBody(req)
    if (!body) return badRequest('Corps JSON attendu')
    const week = parseCopyWeek(body.week, dayOf(new Date(), DEFAULT_TIME_ZONE))
    if (!week.ok) {
      return week.code === 'past_week'
        ? fail(400, 'past_week', 'Cette semaine est déjà passée')
        : badRequest('week invalide : le lundi de la semaine, AAAA-MM-JJ')
    }

    const done = await copyPlanning(copyWeekRequest(week.monday), who.email)
    return NextResponse.json({ ok: true, ...done }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    return failFromError(e)
  }
}
