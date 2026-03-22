import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { Post } from '@/lib/models/Post'

function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export async function GET(req: NextRequest) {
  await connectDB()
  const { searchParams } = new URL(req.url)
  const publishedOnly = searchParams.get('published') === 'true'
  const query = publishedOnly ? { isPublished: true } : {}
  const posts = await Post.find(query).sort({ publishedAt: -1, createdAt: -1 }).lean()
  return NextResponse.json(posts)
}

export async function POST(req: NextRequest) {
  try {
    await connectDB()
    const body = await req.json()
    const baseSlug = slugify(body.title?.fr || 'post')
    // Ensure slug uniqueness
    let slug = baseSlug
    let i = 1
    while (await Post.exists({ slug })) {
      slug = `${baseSlug}-${i++}`
    }
    const post = await Post.create({
      ...body,
      slug,
      publishedAt: body.isPublished ? new Date() : null,
    })
    return NextResponse.json(post, { status: 201 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur serveur'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
