import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { Category } from '@/lib/models/Category'
import { requireAuth } from '@/lib/auth'

export async function GET() {
  await connectDB()
  const categories = await Category.find({ isActive: true }).sort({ order: 1 })
  return NextResponse.json(categories)
}

export async function POST(req: NextRequest) {
  try {
    requireAuth(req)
    await connectDB()
    const body = await req.json()
    const category = await Category.create(body)
    return NextResponse.json(category, { status: 201 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur serveur'
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 })
  }
}
