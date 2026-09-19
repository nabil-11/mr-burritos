import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { OrderInputError, quoteWebBasket } from '@/lib/orderPricing'

/**
 * POST /api/orders/quote — what a website basket costs right now.
 *
 * Nothing is saved. The cart page asks this whenever the basket changes, so
 * the figure it shows is the figure POST /api/orders will charge, and a dish
 * that left the menu since it was added is flagged on its own line instead of
 * failing the whole order at the last step.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const items = Array.isArray(body?.items) ? body.items : null
    if (!items) return NextResponse.json({ error: 'Panier illisible' }, { status: 400 })
    await connectDB()
    return NextResponse.json(await quoteWebBasket(items))
  } catch (e: unknown) {
    if (e instanceof OrderInputError) return NextResponse.json({ error: e.message }, { status: e.status })
    const msg = e instanceof Error ? e.message : 'Erreur serveur'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
