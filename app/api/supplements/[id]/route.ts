import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { connectDB } from '@/lib/mongodb'
import { Supplement } from '@/lib/models/Supplement'
import { Product } from '@/lib/models/Product'
import { requireAuth } from '@/lib/auth'
import { supplementFields, syncProducts } from '../fields'

type Ctx = { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    requireAuth(req)
    await connectDB()
    const { id } = await params
    const body = await req.json()
    const supplement = await Supplement.findByIdAndUpdate(id, supplementFields(body), { new: true, runValidators: true })
    if (!supplement) return NextResponse.json({ error: 'Non trouvé' }, { status: 404 })
    await syncProducts(id, body.productIds)
    revalidatePath('/')
    return NextResponse.json(supplement)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur serveur'
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 })
  }
}

/**
 * Deletes for good. Past orders are unaffected: each order line keeps its own
 * copy of the supplement's name and price. The products offering it lose it.
 */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    requireAuth(req)
    await connectDB()
    const { id } = await params
    const deleted = await Supplement.findByIdAndDelete(id)
    if (!deleted) return NextResponse.json({ error: 'Non trouvé' }, { status: 404 })
    await Product.updateMany({ supplements: id }, { $pull: { supplements: id } })
    revalidatePath('/')
    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur serveur'
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 })
  }
}
