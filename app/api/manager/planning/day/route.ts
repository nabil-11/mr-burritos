import { NextRequest, NextResponse } from 'next/server'
import { requireManager } from '@/lib/managerAuth'
import { badRequest, failFromError, readBody } from '@/lib/managerWrite'
import { mondayOf } from '@/lib/planning'
import { setPlanningDay } from '@/lib/planningData'
import { MAX_AHEAD_DAYS } from '@/lib/planningDeadline'
import { DEFAULT_TIME_ZONE, addDays, dayOf } from '@/lib/reportTime'

export const dynamic = 'force-dynamic'

/**
 * PUT /api/manager/planning/day — ce qu'un employé fait un jour précis.
 *
 * Body : { employeeId, date: 'AAAA-MM-JJ', kind, shifts?: [{ from, to }] (2 au
 * plus), note? }. `kind` : travail · repos · conge · maladie · absence ·
 * semaine (retire l'exception : le jour revient à la semaine type). `travail`
 * sans `shifts` suit la semaine type. Même écriture que PUT /api/planning
 * (`setPlanningDay`), avec en plus le refus d'un jour d'une semaine passée.
 *
 * Écriture : l'en-tête Bearer seul, jamais le cookie. L'auteur est l'e-mail du
 * compte, relu en base ; le corps n'en porte pas.
 *
 * Returns `{ ok: true }`. Errors are `{ error, code }`: 401 unauthorized,
 * 403 forbidden, 400 bad_request (aussi : date à plus d'un an, employé
 * inactif), 400 past_week (avant le lundi de cette semaine), 404 not_found (employé),
 * 500 server_error.
 */
export async function PUT(req: NextRequest) {
  try {
    const who = await requireManager(req, { bearerOnly: true })
    if (who instanceof Response) return who

    const body = await readBody(req)
    if (!body) return badRequest('Corps JSON attendu')

    // Le lundi de cette semaine : les jours passés de la semaine en cours restent
    // modifiables (hier, une maladie). Au plus un an devant, employé actif seulement.
    const today = dayOf(new Date(), DEFAULT_TIME_ZONE)
    await setPlanningDay(body, who.email, {
      minDate: mondayOf(today),
      maxDate: addDays(today, MAX_AHEAD_DAYS),
      activeOnly: true,
    })
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    return failFromError(e)
  }
}
