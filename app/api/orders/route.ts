import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { Order } from '@/lib/models/Order'
import { sendPushToAll } from '@/lib/fcm'
import { orderBus } from '@/lib/orderBus'

function generateOrderNumber(): string {
  const now = new Date()
  const date = now.toISOString().slice(0, 10).replace(/-/g, '')
  const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  return `MB-${date}-${rand}`
}

export async function GET(req: NextRequest) {
  await connectDB()
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const type = searchParams.get('type')
  const assignedDelivery = searchParams.get('assignedDelivery')
  const query: Record<string, unknown> = {}
  if (status) query.status = status
  if (type) query.type = type
  if (assignedDelivery) query.assignedDelivery = assignedDelivery
  const orders = await Order.find(query).sort({ createdAt: -1 }).limit(100)
    .populate('assignedDelivery', 'name phone')
  return NextResponse.json(orders)
}

export async function POST(req: NextRequest) {
  try {
    await connectDB()
    const body = await req.json()
    const orderNumber = generateOrderNumber()
    const order = await Order.create({ ...body, orderNumber })

    // ── Instant in-process push to all connected SSE streams ──────────────
    // Emitting synchronously here means any manager with an open SSE connection
    // on the SAME server instance receives the notification in < 10 ms.
    orderBus.emit('new-order', order.toObject())

    // ── FCM push (fire-and-forget) — reaches managers on other instances ───
    const typeLabel = body.type === 'delivery' ? 'Livraison' : 'À emporter'
    sendPushToAll(
      '🌯 Nouvelle commande !',
      `#${orderNumber} — ${typeLabel} — ${body.total ?? '?'} DT`,
      { orderId: String(order._id), orderNumber }
    ).catch(() => {})

    return NextResponse.json(order, { status: 201 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur serveur'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
