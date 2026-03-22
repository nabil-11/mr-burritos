import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { Review } from '@/lib/models/Review'

export async function GET(req: NextRequest) {
  await connectDB()
  const { searchParams } = new URL(req.url)
  const approvedOnly = searchParams.get('approved') === 'true'
  const query = approvedOnly ? { isApproved: true } : {}
  const reviews = await Review.find(query).sort({ createdAt: -1 }).lean()
  return NextResponse.json(reviews)
}

export async function POST(req: NextRequest) {
  try {
    await connectDB()
    const body = await req.json()
    const review = await Review.create({ ...body, isApproved: false })
    return NextResponse.json(review, { status: 201 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur serveur'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
