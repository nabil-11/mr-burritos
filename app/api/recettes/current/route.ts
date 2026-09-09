import { NextResponse } from 'next/server'
import { cashDifference, emptyTotals, getOpenRecette, recetteTotals } from '@/lib/recette'

/**
 * GET /api/recettes/current — the session running right now, with live
 * figures, or `{ recette: null }` when the till is closed.
 *
 * Polled by the button in the back-office sidebar and by the caisse, so it
 * stays small: the header of the session and its totals, no order list. It
 * reports the state of the till at this instant, so it is never prerendered.
 */
export const dynamic = 'force-dynamic'
export async function GET() {
  try {
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
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
