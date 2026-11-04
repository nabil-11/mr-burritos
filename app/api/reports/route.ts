import { NextRequest, NextResponse } from 'next/server'
import { getTokenFromRequest } from '@/lib/auth'
import { loadReport, normalizeReportRange } from '@/lib/reportData'
import { safeTimeZone } from '@/lib/reportTime'

/**
 * GET /api/reports?from=YYYY-MM-DD&to=YYYY-MM-DD&tz=Africa/Tunis
 *
 * Le rapport d'une période, recette par recette — la règle et les deux
 * questions ajoutées à côté des totaux sont dans lib/reportData (partagé avec
 * GET /api/manager/reports), le calcul dans lib/recetteReport.
 *
 * Réservé au back-office : ce sont les comptes du restaurant. La caisse a ses
 * propres routes (/api/recettes) et ne lit pas celle-ci.
 */
export async function GET(req: NextRequest) {
  if (!getTokenFromRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const tz = safeTimeZone(searchParams.get('tz'))
    const { from, to } = normalizeReportRange(searchParams.get('from'), searchParams.get('to'), tz)
    const report = await loadReport(from, to, tz)
    return NextResponse.json(report, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur serveur'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
