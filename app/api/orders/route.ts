import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { Order } from '@/lib/models/Order'
import '@/lib/models/User' // register User schema so populate('assignedDelivery') resolves
import { sendPushToAll } from '@/lib/fcm'
import { orderBus } from '@/lib/orderBus'
import { ORDER_SOURCE_LABELS, normalizeOrderSource } from '@/lib/orderSource'
import { autoReadyOnSiteOrders, autoSettleOverdueOrders } from '@/lib/orderTimers'

function generateOrderNumber(): string {
  const now = new Date()
  const date = now.toISOString().slice(0, 10).replace(/-/g, '')
  const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  return `MB-${date}-${rand}`
}


export async function GET(req: NextRequest) {
  try {
    await connectDB()
    await autoReadyOnSiteOrders()
    await autoSettleOverdueOrders()
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const type = searchParams.get('type')
    const source = searchParams.get('source') // website | counter | kiosk
    const assignedDelivery = searchParams.get('assignedDelivery')
    const from = searchParams.get('from') // ISO date — filters createdAt >= from
    const to = searchParams.get('to')     // ISO date — filters createdAt <= to
    const query: Record<string, unknown> = {}
    if (status) query.status = status
    if (type) query.type = type
    if (source) query.source = source
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

export async function POST(req: NextRequest) {
  try {
    await connectDB()
    const body = await req.json()
    const orderNumber = generateOrderNumber()
    // An unknown or missing source falls back to the public site — the only
    // caller that has no reason to announce itself.
    const source = normalizeOrderSource(body.source)
    // An order created already confirmed (caisse, borne) never passes through
    // the status route, so nothing else would ever stamp `confirmedAt` — and
    // that stamp is what the preparation countdown and the overdue sweep both
    // count from.
    const startedNow = body.status === 'confirmed' || body.status === 'preparing'
    const confirmedAt = body.confirmedAt ?? (startedNow ? new Date() : undefined)
    const order = await Order.create({ ...body, source, confirmedAt, orderNumber })

    // ── Instant in-process push to all connected SSE streams ──────────────
    // Emitting synchronously here means any manager with an open SSE connection
    // on the SAME server instance receives the notification in < 10 ms.
    orderBus.emit('new-order', order.toObject())

    // ── FCM push (fire-and-forget) — reaches managers on other instances ───
    const typeLabel = body.type === 'delivery' ? 'Livraison' : 'À emporter'
    sendPushToAll(
      '🌯 Nouvelle commande !',
      `#${orderNumber} — ${ORDER_SOURCE_LABELS[source]} — ${typeLabel} — ${body.total ?? '?'} DT`,
      { orderId: String(order._id), orderNumber }
    ).catch(() => {})

    return NextResponse.json(order, { status: 201 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur serveur'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
