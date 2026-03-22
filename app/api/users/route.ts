import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { connectDB } from '@/lib/mongodb'
import { User } from '@/lib/models/User'
import { requireAuth } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    requireAuth(req)
    await connectDB()
    const users = await User.find().select('-password').sort({ createdAt: -1 })
    return NextResponse.json(users)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur serveur'
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    requireAuth(req)
    await connectDB()
    const body = await req.json()
    const hashed = await bcrypt.hash(body.password, 12)
    const user = await User.create({ ...body, password: hashed })
    const { password: _p, ...safe } = user.toObject()
    void _p
    return NextResponse.json(safe, { status: 201 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur serveur'
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 })
  }
}
