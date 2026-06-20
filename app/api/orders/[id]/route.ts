import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { Order } from '@/lib/models/Order'
import { requireAuth } from '@/lib/auth'
import { sendPushToCustomer, sendPushToDelivery } from '@/lib/fcm'
import { orderBus } from '@/lib/orderBus'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  await connectDB()
  const { id } = await params
  const order = await Order.findById(id)
  if (!order) return NextResponse.json({ error: 'Non trouvé' }, { status: 404 })
  return NextResponse.json(order)
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const caller = requireAuth(req)
    await connectDB()
    const { id } = await params
    const body = await req.json()
    const { status, preparationDuration, deliveryFee, acceptOrder } = body

    // Delivery user accepts an order
    if (acceptOrder && caller.role === 'delivery') {
      const order = await Order.findById(id)
      if (!order) return NextResponse.json({ error: 'Non trouvé' }, { status: 404 })
      if (order.status !== 'confirmed') {
        return NextResponse.json({ error: 'Commande non disponible' }, { status: 400 })
      }
      const updated = await Order.findByIdAndUpdate(
        id,
        { status: 'preparing', assignedDelivery: caller.userId },
        { new: true }
      )
      return NextResponse.json(updated)
    }

    const updateData: Record<string, unknown> = { status }

    if (status === 'confirmed') {
      updateData.confirmedAt = new Date()
      if (preparationDuration) updateData.preparationDuration = preparationDuration
      if (typeof deliveryFee === 'number') {
        updateData.deliveryFee = Math.max(0, Math.min(10, deliveryFee))
      }
    }

    const order = await Order.findByIdAndUpdate(id, updateData, { new: true })
    if (!order) return NextResponse.json({ error: 'Non trouvé' }, { status: 404 })

    // ── Notify delivery users when a delivery order is confirmed ─────────────
    if (status === 'confirmed' && order.type === 'delivery') {
      const orderObj = order.toObject()

      // Instant in-process push to delivery SSE streams on the same instance
      orderBus.emit('confirmed-delivery', orderObj)

      // FCM push for delivery-app devices on other instances / background
      sendPushToDelivery(
        '🛵 Nouvelle livraison disponible !',
        `#${order.orderNumber} — ${order.total} DT${order.customer?.address ? ` • ${order.customer.address}` : ''}`,
        { orderId: String(order._id), orderNumber: order.orderNumber, type: 'confirmed-delivery' }
      ).catch(() => {})
    }

    // ── Notify customer when order is ready ──────────────────────────────────
    if (status === 'ready' && order.customer?.phone) {
      const typeLabel = order.type === 'delivery' ? 'Livraison' : 'À emporter'
      sendPushToCustomer(
        order.customer.phone,
        '🍔 Commande prête!',
        `#${order.orderNumber} est prête pour ${typeLabel}`,
        { orderId: String(order._id), orderNumber: order.orderNumber }
      ).catch(() => {})
    }

    return NextResponse.json(order)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur serveur'
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 })
  }
}
