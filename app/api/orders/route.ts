import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { Order } from '@/lib/models/Order'
import '@/lib/models/User' // register User schema so populate('assignedDelivery') resolves
import { sendPushToAll } from '@/lib/fcm'
import { orderBus } from '@/lib/orderBus'

function generateOrderNumber(): string {
  const now = new Date()
  const date = now.toISOString().slice(0, 10).replace(/-/g, '')
  const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  return `MB-${date}-${rand}`
}

// An order is "en retard" once it passes its prep deadline
// (confirmedAt + preparationDuration minutes). After this much extra grace
// past the deadline, it is considered abandoned and auto-cancelled.
const LATE_GRACE_MS = 60 * 60 * 1000 // 1 hour

/**
 * Lazy expiration: auto-cancel active orders left more than LATE_GRACE_MS past
 * their prep deadline. Runs on read so no cron job is needed. Only touches
 * confirmed/preparing orders — a "ready" order's food is already made, and
 * delivered/cancelled are terminal. A no-op (zero writes) when nothing is overdue.
 */
async function autoCancelOverdueOrders(): Promise<void> {
  await Order.updateMany(
    {
      status: { $in: ['confirmed', 'preparing'] },
      confirmedAt: { $type: 'date' },
      $expr: {
        $lt: [
          {
            $add: [
              '$confirmedAt',
              { $multiply: [{ $ifNull: ['$preparationDuration', 30] }, 60_000] },
              LATE_GRACE_MS,
            ],
          },
          new Date(),
        ],
      },
    },
    { $set: { status: 'cancelled' } }
  )
}

export async function GET(req: NextRequest) {
  try {
    await connectDB()
    await autoCancelOverdueOrders()
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const type = searchParams.get('type')
    const assignedDelivery = searchParams.get('assignedDelivery')
    const from = searchParams.get('from') // ISO date — filters createdAt >= from
    const to = searchParams.get('to')     // ISO date — filters createdAt <= to
    const query: Record<string, unknown> = {}
    if (status) query.status = status
    if (type) query.type = type
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
