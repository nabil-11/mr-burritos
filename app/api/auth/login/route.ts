import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { connectDB } from '@/lib/mongodb'
import { User } from '@/lib/models/User'
import { signToken } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    await connectDB()
    const { email, password } = await req.json()

    const user = await User.findOne({ email: email.toLowerCase(), isActive: true })
    if (!user) return NextResponse.json({ error: 'Identifiants invalides' }, { status: 401 })

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) return NextResponse.json({ error: 'Identifiants invalides' }, { status: 401 })

    const token = signToken({ userId: user._id.toString(), email: user.email, role: user.role })

    const res = NextResponse.json({ user: { id: user._id, name: user.name, email: user.email, role: user.role } })
    res.cookies.set('token', token, { httpOnly: true, maxAge: 60 * 60 * 24 * 7 })
    return res
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
