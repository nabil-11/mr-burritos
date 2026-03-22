import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { Order } from '@/lib/models/Order'

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
  const query: Record<string, unknown> = {}
  if (status) query.status = status
  const orders = await Order.find(query).sort({ createdAt: -1 }).limit(100)
  return NextResponse.json(orders)
}

export async function POST(req: NextRequest) {
  try {
    await connectDB()
    const body = await req.json()
    const orderNumber = generateOrderNumber()
    const order = await Order.create({ ...body, orderNumber })
    return NextResponse.json(order, { status: 201 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur serveur'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
