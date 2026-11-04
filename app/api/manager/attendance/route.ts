import { NextRequest, NextResponse } from 'next/server'
import { requireManager } from '@/lib/managerAuth'
import { badRequest, failFromError } from '@/lib/managerWrite'
import { AttendanceError, editWindow, isRealDay } from '@/lib/attendance'
import { loadDay } from '@/lib/attendanceData'

export const dynamic = 'force-dynamic'

/**
 * GET /api/manager/attendance?date=AAAA-MM-JJ — le pointage d'un jour.
 *
 * `rows` : les employés planifiés `travail` ce jour-là et tous ceux qui ont
 * déjà une ligne. Un employé sans ligne se lit dans le planning du moment ; une
 * ligne enregistrée se lit dans sa photo. `others` : les actifs hors des lignes
 * (« Ajouter hors planning »). `canEdit` et `editableUntil` disent si ce compte
 * peut encore écrire ce jour (horloge du serveur).
 *
 * Aucune note de planning ni motif de maladie n'y figure (`maladie` y est
 * `absence`). Lecture seule. Errors are `{ error, code }`: 401 unauthorized,
 * 403 forbidden, 400 bad_request (date), 400 future_day, 500 server_error.
 */
export async function GET(req: NextRequest) {
  try {
    const who = await requireManager(req)
    if (who instanceof Response) return who

    const date = req.nextUrl.searchParams.get('date')
    if (!isRealDay(date)) return badRequest('date invalide : AAAA-MM-JJ')
    const now = new Date()
    if (editWindow(date, now, who.role).future) throw new AttendanceError('future_day', 'Ce jour n’a pas encore eu lieu')

    return NextResponse.json(await loadDay(date, now, who.role), { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    return failFromError(e)
  }
}
