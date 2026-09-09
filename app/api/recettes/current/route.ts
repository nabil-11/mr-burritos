import { NextRequest, NextResponse } from 'next/server'
import { requireCaisseOrAuth } from '@/lib/caisseAuth'
import { cashDifference, emptyTotals, getOpenRecette, recetteTotals } from '@/lib/recette'

/**
 * GET /api/recettes/current — the session running right now, with live
 * figures, or `{ recette: null }` when the till is closed.
 *
 * This is what the open/close button in the sidebar polls, so it stays small:
 * the header of the session and its totals, no order list.
 */
export async function GET(req: NextRequest) {
  try {
    requireCaisseOrAuth(req)
    const recette = await getOpenRecette()
    if (!recette) return NextResponse.json({ recette: null, totals: emptyTotals(), cashDifference: null })

    const totals = await recetteTotals(recette)
    return NextResponse.json({
      recette,
      totals,
      cashDifference: cashDifference(recette, totals),
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur serveur'
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 })
  }
}
