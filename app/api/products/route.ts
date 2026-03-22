import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { Product } from '@/lib/models/Product'
import { requireAuth } from '@/lib/auth'

export async function GET(req: NextRequest) {
  await connectDB()
  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category')
  const query: Record<string, unknown> = { isActive: true }
  if (category) query.category = category
  const products = await Product.find(query).populate('category').populate('supplements')
  return NextResponse.json(products)
}

export async function POST(req: NextRequest) {
  try {
    requireAuth(req)
    await connectDB()
    const body = await req.json()
    const product = await Product.create(body)
    return NextResponse.json(product, { status: 201 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur serveur'
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 })
  }
}
