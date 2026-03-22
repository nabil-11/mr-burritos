import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { Configuration } from '@/lib/models/Configuration'
import { requireAuth } from '@/lib/auth'

export async function GET() {
  await connectDB()
  const configs = await Configuration.find()
  return NextResponse.json(configs)
}

export async function POST(req: NextRequest) {
  try {
    requireAuth(req)
    await connectDB()
    const body = await req.json()
    const config = await Configuration.findOneAndUpdate({ key: body.key }, body, { upsert: true, new: true })
    return NextResponse.json(config, { status: 201 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur serveur'
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 })
  }
}
