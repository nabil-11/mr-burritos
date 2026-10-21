import mongoose from 'mongoose'
import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { PromoCode } from '@/lib/models/PromoCode'
import { requireAuth } from '@/lib/auth'
import { checkAgainstStored, promoCodeFields, type CodeDoc } from '@/lib/promoCodes'
import { canManagePromos, failPromo } from '../access'

type Ctx = { params: Promise<{ id: string }> }

/**
 * Renaming a code already used is allowed: the orders keep the name they were
 * placed with, so its count simply starts again under the new name.
 */
export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    if (!canManagePromos(requireAuth(req).role)) throw new Error('Forbidden')
    await connectDB()
    const { id } = await params
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: 'Non trouvé' }, { status: 404 })
    const stored = (await PromoCode.findById(id).lean()) as CodeDoc | null
    if (!stored) return NextResponse.json({ error: 'Non trouvé' }, { status: 404 })
    const fields = promoCodeFields((await req.json().catch(() => ({}))) ?? {}, false)
    checkAgainstStored(fields, stored)
    const code = await PromoCode.findByIdAndUpdate(id, fields, { returnDocument: 'after', runValidators: true })
    return NextResponse.json(code)
  } catch (e: unknown) {
    return failPromo(e)
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    if (!canManagePromos(requireAuth(req).role)) throw new Error('Forbidden')
    await connectDB()
    const { id } = await params
    if (mongoose.isValidObjectId(id)) await PromoCode.findByIdAndDelete(id)
    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    return failPromo(e)
  }
}
