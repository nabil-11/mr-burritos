import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { Recette } from '@/lib/models/Recette'
import { callerFrom } from '@/lib/caisseCaller'
import {
  RecetteError,
  cashDifference,
  cashInDrawer,
  closeRecette,
  recetteOrders,
  recetteTotals,
} from '@/lib/recette'

type Ctx = { params: Promise<{ id: string }> }

/** GET /api/recettes/[id] — one session, its figures and its orders. */
export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    await connectDB()
    const { id } = await params
    const recette = await Recette.findById(id).lean()
    if (!recette) return NextResponse.json({ error: 'Recette introuvable' }, { status: 404 })

    const [totals, orders] = await Promise.all([
      recetteTotals(recette),
      recetteOrders((recette as { _id: unknown })._id),
    ])
    return NextResponse.json({
      recette,
      totals,
      cashDifference: cashDifference(recette, totals),
      cashInDrawer: cashInDrawer(recette, totals),
      orders,
    })
  } catch (e: unknown) {
    return fail(e)
  }
}

/**
 * PATCH /api/recettes/[id] — clôture de caisse.
 *
 * Closing is one-way: there is no route back to `open`. A session that was
 * closed by mistake is corrected by opening the next one, not by reopening a
 * report whose figures are already frozen.
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const caller = callerFrom(req, body.userName)
    const recette = await closeRecette(id, {
      userId: caller.userId,
      userName: caller.name,
      closingCash: body.closingCash === '' || body.closingCash == null ? null : Number(body.closingCash),
      notes: body.notes,
    })
    return NextResponse.json(recette)
  } catch (e: unknown) {
    return fail(e)
  }
}

function fail(e: unknown) {
  if (e instanceof RecetteError) return NextResponse.json({ error: e.message }, { status: e.status })
  const msg = e instanceof Error ? e.message : 'Erreur serveur'
  return NextResponse.json({ error: msg }, { status: 500 })
}
