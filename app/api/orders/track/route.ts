import mongoose from 'mongoose'
import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { Order } from '@/lib/models/Order'
import { normalizeTnPhone, tnPhonePattern } from '@/lib/phone'

/**
 * GET /api/orders/track — a customer's recent orders, for the public tracker.
 *
 *  - `?phone=99123456` — orders placed with that number, however it was typed
 *    ("99 123 456", "+216…"): numbers are compared as digits.
 *  - `?ids=a,b,c` — the orders this device placed, remembered by the browser,
 *    so a returning customer sees them without typing anything.
 *
 * Anyone can type any number here, so the answer carries what a tracker needs
 * and nothing that identifies the person: no name, no phone, no address.
 */
const PUBLIC_FIELDS = 'orderNumber status total deliveryFee type createdAt confirmedAt preparationDuration'
const MAX_IDS = 10

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const rawPhone = searchParams.get('phone')
  const rawIds = searchParams.get('ids')

  let query: Record<string, unknown>
  if (rawIds !== null) {
    const ids = rawIds.split(',').map((s) => s.trim()).filter((s) => mongoose.isValidObjectId(s)).slice(0, MAX_IDS)
    if (!ids.length) return NextResponse.json([])
    query = { _id: { $in: ids } }
  } else {
    const phone = normalizeTnPhone(rawPhone)
    if (!phone) return NextResponse.json({ error: 'Numéro invalide — 8 chiffres attendus' }, { status: 400 })
    // Exact match first: every order stored since numbers were normalized.
    // The pattern catches the ones typed with spaces or a +216 before that.
    query = { $or: [{ 'customer.phone': phone }, { 'customer.phone': tnPhonePattern(phone) }] }
  }

  await connectDB()
  const orders = await Order.find(query).sort({ createdAt: -1 }).limit(10).select(PUBLIC_FIELDS).lean()
  return NextResponse.json(orders)
}
