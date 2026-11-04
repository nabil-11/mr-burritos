import { NextRequest, NextResponse } from 'next/server'
import { failJson as fail, requireManager } from '@/lib/managerAuth'
import { loadReport } from '@/lib/reportData'
import { DEFAULT_TIME_ZONE, addDays, dayOf } from '@/lib/reportTime'

export const dynamic = 'force-dynamic'

/**
 * GET /api/manager/reports?from=YYYY-MM-DD&to=YYYY-MM-DD — le rapport d'une
 * période pour le téléphone du gérant.
 *
 * Le même `RecetteReport` que GET /api/reports, sans y toucher : les deux
 * routes appellent `loadReport` (lib/reportData). Le fuseau est Africa/Tunis,
 * toujours. Sans dates, aujourd'hui ; seul `from`, ce seul jour ; `from` après
 * `to`, on échange comme le back-office.
 *
 * Lecture seule. Errors are `{ error, code }`: 401 unauthorized, 403 forbidden,
 * 400 bad_request (jour mal formé), 400 range_too_long (plus de 92 jours),
 * 500 server_error.
 */

const MAX_DAYS = 92
const DAY = /^\d{4}-\d{2}-\d{2}$/
/** Un vrai jour du calendrier : le 30 février n'en est pas un. */
const validDay = (s: string) => DAY.test(s) && addDays(s, 0) === s
const daysApart = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)

export async function GET(req: NextRequest) {
  try {
    const who = await requireManager(req)
    if (who instanceof Response) return who

    const fromParam = req.nextUrl.searchParams.get('from')
    const toParam = req.nextUrl.searchParams.get('to')
    if ((fromParam !== null && !validDay(fromParam)) || (toParam !== null && !validDay(toParam))) {
      return fail(400, 'bad_request', 'Dates invalides : AAAA-MM-JJ attendu')
    }

    let from = fromParam ?? toParam ?? dayOf(new Date(), DEFAULT_TIME_ZONE)
    let to = toParam ?? from
    if (from > to) [from, to] = [to, from]
    if (daysApart(from, to) + 1 > MAX_DAYS) return fail(400, 'range_too_long', `Période limitée à ${MAX_DAYS} jours`)

    const report = await loadReport(from, to, DEFAULT_TIME_ZONE)
    return NextResponse.json(report, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return fail(500, 'server_error', 'Erreur serveur')
  }
}
