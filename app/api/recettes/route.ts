import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { Recette } from '@/lib/models/Recette'
import { requireCaisseOrAuth } from '@/lib/caisseAuth'
import { RecetteError, openRecette, recetteTotals, type RecetteTotals } from '@/lib/recette'

/**
 * Till sessions.
 *
 * Everything here is money, so nothing here is anonymous: unlike the order
 * routes — which the caisse and the kiosk call without announcing themselves —
 * these need either a back-office session or the till key. See lib/caisseAuth.
 */

type Doc = { _id: unknown; status?: string; totals?: RecetteTotals | null }

/** GET /api/recettes — the last sessions, newest first, figures included. */
export async function GET(req: NextRequest) {
  try {
    requireCaisseOrAuth(req)
    await connectDB()
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') // open | closed
    const limit = Math.min(Number(searchParams.get('limit')) || 50, 200)

    const recettes = await Recette.find(status ? { status } : {})
      .sort({ openedAt: -1 })
      .limit(limit)
      .lean()

    const withTotals = await Promise.all(
      (recettes as Doc[]).map(async (r) => ({ ...r, totals: await recetteTotals(r) }))
    )
    return NextResponse.json(withTotals)
  } catch (e: unknown) {
    return fail(e)
  }
}

/** POST /api/recettes — ouverture de caisse. */
export async function POST(req: NextRequest) {
  try {
    const caller = requireCaisseOrAuth(req)
    const body = await req.json().catch(() => ({}))
    const recette = await openRecette({
      userId: caller.userId,
      userName: body.userName ?? caller.name,
      openingFloat: Number(body.openingFloat) || 0,
      notes: typeof body.notes === 'string' ? body.notes : '',
    })
    return NextResponse.json(recette, { status: 201 })
  } catch (e: unknown) {
    return fail(e)
  }
}

function fail(e: unknown) {
  if (e instanceof RecetteError) return NextResponse.json({ error: e.message }, { status: e.status })
  const msg = e instanceof Error ? e.message : 'Erreur serveur'
  const status = msg === 'Unauthorized' ? 401 : 500
  return NextResponse.json({ error: msg }, { status })
}
