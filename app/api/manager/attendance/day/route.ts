import { NextRequest, NextResponse } from 'next/server'
import { requireManager } from '@/lib/managerAuth'
import { badRequest, failFromError, readBody } from '@/lib/managerWrite'
import { validateDay } from '@/lib/attendanceData'

export const dynamic = 'force-dynamic'

/**
 * PUT /api/manager/attendance/day — la validation du jour : la seule écriture.
 *
 * Body : { date, rows: [{ employeeId, asPlanned?: true, status: 'present' |
 * 'absent', justification?, shifts?: [{ from, to }] (2 au plus), note? (200) }] }.
 * `asPlanned` : présent aux horaires du planning. Le serveur recalcule toutes les
 * minutes ; il ignore `unplanned`, `*Minutes`, auteur, historique et photo du
 * planning s'ils figurent dans le corps. La première validation exige une ligne
 * par employé planifié `travail` (sinon `missing_rows`) ; ensuite on peut
 * n'envoyer que les lignes modifiées. Le premier qui valide reste celui qu'on lit ;
 * on ne dévalide pas. Rejouer le même corps ne change rien (`changed` 0).
 *
 * Écriture : l'en-tête Bearer seul, jamais le cookie. L'auteur est l'e-mail du
 * compte, relu en base. La fenêtre se lit sur l'horloge du serveur : un gérant
 * avant le début du jour + 3 (Tunis), un admin toujours, un jour futur jamais.
 *
 * Returns { ok, date, validatedBy, validatedAt, alreadyValidated, changed, day }
 * (`day` : le corps de GET /api/manager/attendance). Errors are `{ error, code }`:
 * 401 unauthorized, 403 forbidden, 403 window_closed, 400 bad_request,
 * future_day, invalid_shifts, shifts_overlap, shifts_required, absent_not_planned,
 * missing_rows (+ `employeeIds`), 404 not_found (employé), 409 conflict (une ligne
 * change sans cesse sous nous : renvoyer le même corps), 500 server_error.
 */
export async function PUT(req: NextRequest) {
  try {
    const who = await requireManager(req, { bearerOnly: true })
    if (who instanceof Response) return who

    const body = await readBody(req)
    if (!body) return badRequest('Corps JSON attendu')

    const result = await validateDay(body, who, new Date())
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    return failFromError(e)
  }
}
