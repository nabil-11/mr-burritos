import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { connectDB } from '@/lib/mongodb'
import { requireAuth } from '@/lib/auth'
import { callerFrom } from '@/lib/caisseCaller'
import { EmployeeEntry } from '@/lib/models/EmployeeEntry'
import { employeeError } from '../../../../fields'

type Ctx = { params: Promise<{ id: string; entryId: string }> }

/**
 * POST /api/employees/[id]/entries/[entryId]/cancel — annule une prime, une
 * retenue ou un paiement hors caisse. La ligne reste, barrée, hors du compte.
 * Ce que le tiroir a versé s'annule sur sa recette, pas ici.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    requireAuth(req)
    const { id, entryId } = await params
    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(entryId)) {
      return NextResponse.json({ error: 'Non trouvé' }, { status: 404 })
    }
    await connectDB()
    const entry = await EmployeeEntry.findOneAndUpdate(
      { _id: entryId, employee: id, cancelledAt: null },
      { $set: { cancelledAt: new Date(), cancelledBy: { name: callerFrom(req).name } } },
      { returnDocument: 'after' }
    )
    if (!entry) return NextResponse.json({ error: 'Ligne introuvable ou déjà annulée' }, { status: 404 })
    return NextResponse.json(entry)
  } catch (e: unknown) {
    return employeeError(e)
  }
}
