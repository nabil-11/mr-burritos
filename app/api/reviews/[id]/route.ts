import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { Review } from '@/lib/models/Review'

type Props = { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, { params }: Props) {
  const { id } = await params
  await connectDB()
  const body = await req.json()
  const review = await Review.findByIdAndUpdate(id, body, { new: true })
  if (!review) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  return NextResponse.json(review)
}

export async function DELETE(_req: NextRequest, { params }: Props) {
  const { id } = await params
  await connectDB()
  await Review.findByIdAndDelete(id)
  return NextResponse.json({ ok: true })
}
