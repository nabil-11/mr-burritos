import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { PromoCode } from '@/lib/models/PromoCode'
import { requireAuth } from '@/lib/auth'
import { promoCodeFields } from '@/lib/promoCodes'
import { canManagePromos, failPromo } from './access'

export async function GET(req: NextRequest) {
  try {
    requireAuth(req)
    await connectDB()
    return NextResponse.json(await PromoCode.find().sort({ createdAt: -1 }).lean())
  } catch (e: unknown) {
    return failPromo(e)
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!canManagePromos(requireAuth(req).role)) throw new Error('Forbidden')
    await connectDB()
    const body = await req.json().catch(() => ({}))
    const code = await PromoCode.create(promoCodeFields(body ?? {}, true))
    return NextResponse.json(code, { status: 201 })
  } catch (e: unknown) {
    return failPromo(e)
  }
}
