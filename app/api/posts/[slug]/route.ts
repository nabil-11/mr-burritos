import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { Post } from '@/lib/models/Post'

type Props = { params: Promise<{ slug: string }> }

export async function GET(_req: NextRequest, { params }: Props) {
  const { slug } = await params
  await connectDB()
  const post = await Post.findOne({ slug, isPublished: true }).lean()
  if (!post) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  return NextResponse.json(post)
}

export async function PUT(req: NextRequest, { params }: Props) {
  const { slug } = await params
  await connectDB()
  const body = await req.json()
  // Set publishedAt when publishing for the first time
  const existing = await Post.findOne({ slug })
  if (!existing) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  if (body.isPublished && !existing.publishedAt) {
    body.publishedAt = new Date()
  }
  const post = await Post.findOneAndUpdate({ slug }, body, { new: true })
  return NextResponse.json(post)
}

export async function DELETE(_req: NextRequest, { params }: Props) {
  const { slug } = await params
  await connectDB()
  await Post.findOneAndDelete({ slug })
  return NextResponse.json({ ok: true })
}
