import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { Recette } from '@/lib/models/Recette'
import { callerFrom } from '@/lib/caisseCaller'
import { RecetteError, openRecette, recetteTotals, type RecetteTotals } from '@/lib/recette'

/**
 * Till sessions.
 *
 * Open like the order routes: the till has nobody to log in as, and a caisse
 * that cannot open its own service is not a caisse. Who did it is recorded
 * from whoever the caller says they are — see lib/caisseCaller.
 */

type Doc = { _id: unknown; status?: string; totals?: RecetteTotals | null }

/** GET /api/recettes — the last sessions, newest first, figures included. */
export async function GET(req: NextRequest) {
  try {
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
    const body = await req.json().catch(() => ({}))
    const caller = callerFrom(req, body.userName)
    const recette = await openRecette({
      userId: caller.userId,
      userName: caller.name,
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
  return NextResponse.json({ error: msg }, { status: 500 })
}
