import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { Order } from '@/lib/models/Order'
import { orderBus } from '@/lib/orderBus'
import { sendPushToCustomer, sendPushToDelivery } from '@/lib/fcm'
import { DEFAULT_PREP_MINUTES } from '@/lib/orderTimers'

/**
 * The caisse takes an order in hand.
 *
 * A web order lands as "en attente" and waits for someone to accept it. When
 * the cashier does it from the till the preparation clock starts from *now* —
 * not from when the customer ordered — and where it lands depends on how the
 * food leaves:
 *
 * - `pickup`: straight to "en préparation", marked `autoReady` so the sweep
 *   carries it to "prête" when the time is up; the till may well be closed by
 *   then.
 * - `delivery`: only as far as "confirmée", which is the status the driver app
 *   picks orders up from, and never auto-ready — moving a delivery along on a
 *   timer would take it out from under the driver. Same reasoning as
 *   AUTO_READY_TYPE in lib/orderTimers.
 *
 * Like the cancel route next door, this is a narrow unauthenticated door for
 * the caisse: it only ever performs this one transition, and only on an order
 * that is still waiting.
 */

/** Only an order nobody has taken yet can be accepted. */
const ACCEPTABLE = ['pending', 'confirmed']

/** Guard rails on what a till may ask for, in minutes. */
const MIN_PREP = 1
const MAX_PREP = 180

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    await connectDB()
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const asked = Number(body?.preparationDuration)
    const minutes = Number.isFinite(asked)
      ? Math.min(MAX_PREP, Math.max(MIN_PREP, Math.round(asked)))
      : DEFAULT_PREP_MINUTES

    const order = await Order.findById(id)
    if (!order) return NextResponse.json({ error: 'Non trouvé' }, { status: 404 })
    if (!ACCEPTABLE.includes(order.status)) {
      return NextResponse.json(
        { error: `Commande deja ${order.status === 'cancelled' ? 'annulee' : 'prise en charge'}` },
        { status: 409 }
      )
    }

    const isDelivery = order.type === 'delivery'
    order.status = isDelivery ? 'confirmed' : 'preparing'
    order.confirmedAt = new Date()
    order.preparationDuration = minutes
    order.autoReady = !isDelivery
    await order.save()

    const saved = order.toObject()
    orderBus.emit('order-status', saved)

    // A confirmed delivery is an offer on the drivers' board — the same
    // announcement the status route makes when staff confirm one.
    if (isDelivery) {
      orderBus.emit('confirmed-delivery', saved)
      sendPushToDelivery(
        '🛵 Nouvelle livraison disponible !',
        `#${order.orderNumber} — ${order.total} DT${order.customer?.address ? ` • ${order.customer.address}` : ''}`,
        { orderId: String(order._id), orderNumber: order.orderNumber, type: 'confirmed-delivery' }
      ).catch(() => {})
    }

    // The customer is waiting at home for exactly this word.
    if (order.customer?.phone) {
      sendPushToCustomer(
        order.customer.phone,
        '👨‍🍳 Commande en préparation',
        `#${order.orderNumber} — prête dans ${minutes} min`,
        { orderId: String(order._id), orderNumber: order.orderNumber }
      ).catch(() => {})
    }

    return NextResponse.json(saved)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur serveur'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
