import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { Theme } from '@/lib/models/Theme'
import { requireAuth } from '@/lib/auth'

export async function GET() {
  await connectDB()
  const themes = await Theme.find({ isActive: true }).sort({ order: 1 })
  return NextResponse.json(themes)
}

export async function POST(req: NextRequest) {
  try {
    requireAuth(req)
    await connectDB()
    const body = await req.json()
    const theme = await Theme.create(body)
    return NextResponse.json(theme, { status: 201 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur serveur'
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 })
  }
}
