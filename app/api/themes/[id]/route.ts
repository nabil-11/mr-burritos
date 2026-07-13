import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { Theme } from '@/lib/models/Theme'
import { requireAuth } from '@/lib/auth'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  await connectDB()
  const { id } = await params
  const theme = await Theme.findById(id)
  if (!theme) return NextResponse.json({ error: 'Non trouvé' }, { status: 404 })
  return NextResponse.json(theme)
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    requireAuth(req)
    await connectDB()
    const { id } = await params
    const body = await req.json()
    const theme = await Theme.findByIdAndUpdate(id, body, { new: true })
    if (!theme) return NextResponse.json({ error: 'Non trouvé' }, { status: 404 })
    return NextResponse.json(theme)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur serveur'
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    requireAuth(req)
    await connectDB()
    const { id } = await params
    await Theme.findByIdAndUpdate(id, { isActive: false })
    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur serveur'
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 })
  }
}
