import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { Reservation } from '@/lib/models/Reservation'
import { requireAuth } from '@/lib/auth'

type Ctx = { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    requireAuth(req)
    await connectDB()
    const { id } = await params
    const { status } = await req.json()
    const reservation = await Reservation.findByIdAndUpdate(id, { status }, { new: true })
    if (!reservation) return NextResponse.json({ error: 'Non trouvé' }, { status: 404 })
    return NextResponse.json(reservation)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur serveur'
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 })
  }
}
