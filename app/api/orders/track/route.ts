import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { Order } from '@/lib/models/Order'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const phone = searchParams.get('phone')?.trim()
  if (!phone) return NextResponse.json({ error: 'Numéro requis' }, { status: 400 })

  await connectDB()
  const orders = await Order.find({ 'customer.phone': phone })
    .sort({ createdAt: -1 })
    .limit(10)
    .select('orderNumber status total type createdAt customer reference')
    .lean()

  return NextResponse.json(orders)
}
