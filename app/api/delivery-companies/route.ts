import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { DeliveryCompany } from '@/lib/models/DeliveryCompany'
import { requireAuth } from '@/lib/auth'

export async function GET() {
  await connectDB()
  const companies = await DeliveryCompany.find().sort({ name: 1 }).lean()
  return NextResponse.json(companies)
}

export async function POST(req: NextRequest) {
  try {
    requireAuth(req)
    await connectDB()
    const body = await req.json()
    const company = await DeliveryCompany.create(body)
    return NextResponse.json(company, { status: 201 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur serveur'
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 })
  }
}
