import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { connectDB } from '@/lib/mongodb'
import { Supplement } from '@/lib/models/Supplement'
import { requireAuth } from '@/lib/auth'
import { supplementFields, syncProducts } from './fields'

export async function GET() {
  await connectDB()
  const supplements = await Supplement.find({ isActive: true })
  return NextResponse.json(supplements)
}

export async function POST(req: NextRequest) {
  try {
    requireAuth(req)
    await connectDB()
    const body = await req.json()
    const supplement = await Supplement.create(supplementFields(body))
    await syncProducts(String(supplement._id), body.productIds)
    // The menu on the home page is cached for five minutes; show it now.
    revalidatePath('/')
    return NextResponse.json(supplement, { status: 201 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur serveur'
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 })
  }
}
