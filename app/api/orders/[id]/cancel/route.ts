import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { Order } from '@/lib/models/Order'
import { orderBus } from '@/lib/orderBus'
import { sendPushToDeliveryUser } from '@/lib/fcm'

/**
 * Cancelling a ticket from the caisse.
 *
 * The status route (PUT /api/orders/[id]) is for signed-in staff; the till has
 * no session, the same way it has none when it creates an order. So this is a
 * separate, deliberately narrow door: it only ever writes `cancelled`, and only
 * on an order that is still in play. Whatever put the order on the counter — a
 * ticket rung up here, or a web order the cashier took in hand — it is the till
 * that has to be able to call it off. A ticket already delivered, already
 * cancelled, or made and waiting ("prête") is refused: those go through the
 * back-office.
 */

/** Statuses a mistake can still be taken back from. */
const CANCELLABLE = ['pending', 'confirmed', 'preparing']

type Ctx = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Ctx) {
  try {
    await connectDB()
    const { id } = await params
    const order = await Order.findById(id)
    if (!order) return NextResponse.json({ error: 'Non trouvé' }, { status: 404 })
    if (!CANCELLABLE.includes(order.status)) {
      return NextResponse.json(
        { error: `Commande deja ${order.status === 'cancelled' ? 'annulee' : 'terminee'}` },
        { status: 409 }
      )
    }

    order.status = 'cancelled'
    await order.save()

    // Same in-process notification the status route sends, so an open
    // back-office or driver stream sees the cancellation immediately.
    const saved = order.toObject()
    orderBus.emit('order-status', saved)

    // A driver already carrying this one is about to make a trip for nothing.
    if (order.assignedDelivery) {
      sendPushToDeliveryUser(
        String(order.assignedDelivery),
        '❌ Commande annulée',
        `#${order.orderNumber} a été annulée`,
        {
          orderId: String(order._id),
          orderNumber: order.orderNumber,
          status: 'cancelled',
          type: 'order-status',
        }
      ).catch(() => {})
    }

    return NextResponse.json(order)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur serveur'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
