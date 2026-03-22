import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { Reservation } from '@/lib/models/Reservation'
import { requireAuth } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    requireAuth(req)
    await connectDB()
    const reservations = await Reservation.find().sort({ date: -1 }).limit(100)
    return NextResponse.json(reservations)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur serveur'
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB()
    const body = await req.json()
    const reservation = await Reservation.create(body)
    return NextResponse.json(reservation, { status: 201 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur serveur'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
