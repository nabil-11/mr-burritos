import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { connectDB } from '@/lib/mongodb'
import { User } from '@/lib/models/User'
import { requireAuth } from '@/lib/auth'

type Ctx = { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    requireAuth(req)
    await connectDB()
    const { id } = await params
    const body = await req.json()
    const { newPassword, password: _pw, ...rest } = body
    void _pw

    const updateData: Record<string, unknown> = { ...rest }
    if (newPassword) {
      updateData.password = await bcrypt.hash(newPassword, 12)
    }

    const user = await User.findByIdAndUpdate(id, updateData, { new: true }).select('-password')
    if (!user) return NextResponse.json({ error: 'Non trouvé' }, { status: 404 })
    return NextResponse.json(user)
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
    await User.findByIdAndDelete(id)
    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur serveur'
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 })
  }
}
