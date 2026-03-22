import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { Supplement } from '@/lib/models/Supplement'
import { requireAuth } from '@/lib/auth'

export async function GET() {
  await connectDB()
  const supplements = await Supplement.find({ isActive: true })
  return NextResponse.json(supplements)
}

export async function POST(req: NextRequest) {
  try {
    requireAuth(req)
    await connectDB()
    const body = await req.json()
    const supplement = await Supplement.create(body)
    return NextResponse.json(supplement, { status: 201 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur serveur'
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 })
  }
}
