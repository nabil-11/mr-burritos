import mongoose from 'mongoose'
import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { Order } from '@/lib/models/Order'
import '@/lib/models/User' // register User schema so populate('assignedDelivery') resolves
import { sendPushToAll } from '@/lib/fcm'
import { orderBus } from '@/lib/orderBus'
import { ORDER_SOURCE_LABELS } from '@/lib/orderSource'
import { isDuplicateKey, nextOrderNumber } from '@/lib/orderNumber'
import { OrderInputError, priceOrder } from '@/lib/orderPricing'
import { autoReadyOnSiteOrders, autoSettleOverdueOrders } from '@/lib/orderTimers'
import { getOpenRecette } from '@/lib/recette'

export async function GET(req: NextRequest) {
  try {
    await connectDB()
    await autoReadyOnSiteOrders()
    await autoSettleOverdueOrders()
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const type = searchParams.get('type')
    const source = searchParams.get('source') // website | counter | kiosk
    const recette = searchParams.get('recette') // till session id
    const assignedDelivery = searchParams.get('assignedDelivery')
    const from = searchParams.get('from') // ISO date — filters createdAt >= from
    const to = searchParams.get('to')     // ISO date — filters createdAt <= to
    const query: Record<string, unknown> = {}
    if (status) query.status = status
    if (type) query.type = type
    if (source) query.source = source
    if (recette) query.recette = recette
    if (assignedDelivery) query.assignedDelivery = assignedDelivery
    if (from || to) {
      const createdAt: Record<string, Date> = {}
      if (from) createdAt.$gte = new Date(from)
      if (to) createdAt.$lte = new Date(to)
      query.createdAt = createdAt
    }
    const orders = await Order.find(query).sort({ createdAt: -1 }).limit(100)
      .populate('assignedDelivery', 'name phone')
    return NextResponse.json(orders)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur serveur'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/**
 * POST /api/orders — the website, the kiosk and the till all place orders here.
 *
 * The order is built by lib/orderPricing from what the menu says, not from
 * what the client says: prices, promo, remise bounds and the fields a channel
 * may set are all decided server-side. A client whose total disagreed is told
 * so in `repriced` — the order itself is never lost over it.
 */
export async function POST(req: NextRequest) {
  try {
    await connectDB()
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Commande illisible' }, { status: 400 })
    }
    const { doc, claimedTotal } = await priceOrder(body as Record<string, unknown>)

    // An order created already in hand (caisse, borne) never passes through
    // the status route, so nothing else would stamp `confirmedAt` — and that
    // stamp is what the preparation countdown and the overdue sweep count from.
    const confirmedAt = doc.status === 'confirmed' || doc.status === 'preparing' ? new Date() : undefined
    // The order falls into whichever till session is open right now. None open
    // means none stamped: a sale is never refused because the caisse was not
    // started, it simply lands outside the day's recette.
    const recette = await getOpenRecette()

    let order
    for (let attempt = 0; ; attempt++) {
      try {
        order = await Order.create({
          ...doc,
          confirmedAt,
          recette: recette?._id ?? null,
          orderNumber: await nextOrderNumber(),
        })
        break
      } catch (err) {
        if (isDuplicateKey(err) && attempt < 5) continue
        throw err
      }
    }

    // ── Instant in-process push to all connected SSE streams ──────────────
    orderBus.emit('new-order', order.toObject())

    // ── FCM push (fire-and-forget) — reaches managers on other instances ───
    const typeLabel = doc.type === 'delivery' ? 'Livraison' : 'À emporter'
    sendPushToAll(
      '🌯 Nouvelle commande !',
      `#${order.orderNumber} — ${ORDER_SOURCE_LABELS[doc.source]} — ${typeLabel} — ${doc.total} DT`,
      { orderId: String(order._id), orderNumber: order.orderNumber }
    ).catch(() => {})

    const saved = order.toObject()
    return NextResponse.json(
      claimedTotal !== null ? { ...saved, repriced: { claimed: claimedTotal, total: doc.total } } : saved,
      { status: 201 }
    )
  } catch (e: unknown) {
    if (e instanceof OrderInputError) return NextResponse.json({ error: e.message }, { status: e.status })
    // A field the schema requires is missing — a customer with no name, say.
    // The caller's mistake, answered as one: not a server error.
    if (e instanceof mongoose.Error.ValidationError) {
      const fields = Object.keys(e.errors)
      const error = fields.some((f) => f.startsWith('customer.'))
        ? 'Nom et telephone du client requis'
        : `Commande incomplete (${fields.join(', ')})`
      return NextResponse.json({ error }, { status: 400 })
    }
    const msg = e instanceof Error ? e.message : 'Erreur serveur'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
