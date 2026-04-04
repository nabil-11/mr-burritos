import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { Order } from '@/lib/models/Order'
import { requireAuth } from '@/lib/auth'
import { sendPushToCustomer } from '@/lib/fcm'

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
    requireAuth(req)
    await connectDB()
    const { id } = await params
    const { status, preparationDuration } = await req.json()
    
    const updateData: Record<string, unknown> = { status }
    
    if (status === 'confirmed') {
      updateData.confirmedAt = new Date()
      if (preparationDuration) {
        updateData.preparationDuration = preparationDuration
      }
    }
    
    const order = await Order.findByIdAndUpdate(id, updateData, { new: true })
    if (!order) return NextResponse.json({ error: 'Non trouvé' }, { status: 404 })

    // Send push notification when order is ready
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
