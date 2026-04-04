import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { DeviceToken } from '@/lib/models/DeviceToken'

export async function POST(req: NextRequest) {
  try {
    const { token, platform, phone } = await req.json()
    if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })

    await connectDB()
    // upsert — token may already be stored (e.g. app reopened)
    await DeviceToken.updateOne(
      { token },
      { $set: { token, platform: platform ?? 'android', phone: phone ?? null } },
      { upsert: true }
    )
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur serveur'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
