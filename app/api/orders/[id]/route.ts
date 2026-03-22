import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { Order } from '@/lib/models/Order'
import { requireAuth } from '@/lib/auth'

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
    const { status } = await req.json()
    const order = await Order.findByIdAndUpdate(id, { status }, { new: true })
    if (!order) return NextResponse.json({ error: 'Non trouvé' }, { status: 404 })
    return NextResponse.json(order)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur serveur'
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 })
  }
}
