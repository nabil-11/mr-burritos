import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { connectDB } from '@/lib/mongodb'
import { User } from '@/lib/models/User'
import { signToken } from '@/lib/auth'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function POST(req: NextRequest) {
  try {
    await connectDB()
    const { email, password } = await req.json()

    const user = await User.findOne({ email: email.toLowerCase(), isActive: true })
    if (!user) return NextResponse.json({ error: 'Identifiants invalides' }, { status: 401, headers: CORS })

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) return NextResponse.json({ error: 'Identifiants invalides' }, { status: 401, headers: CORS })

    const token = signToken({ userId: user._id.toString(), email: user.email, role: user.role })

    const res = NextResponse.json(
      { token, user: { id: user._id, name: user.name, email: user.email, role: user.role } },
      { headers: CORS }
    )
    res.cookies.set('token', token, { httpOnly: true, maxAge: 60 * 60 * 24 * 7 })
    return res
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500, headers: CORS })
  }
}
