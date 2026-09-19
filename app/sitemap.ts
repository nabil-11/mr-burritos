import type { MetadataRoute } from 'next'
import { connectDB } from '@/lib/mongodb'
import { Post } from '@/lib/models/Post'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '')

/** Rebuilt hourly, so a new blog post is announced to search engines the same day. */
export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/avis`, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${SITE_URL}/blog`, changeFrequency: 'weekly', priority: 0.5 },
  ]
  try {
    await connectDB()
    const posts = (await Post.find({ isPublished: true }).select('slug updatedAt').lean()) as {
      slug?: string
      updatedAt?: Date
    }[]
    for (const p of posts) {
      if (!p.slug) continue
      pages.push({
        url: `${SITE_URL}/blog/${encodeURIComponent(p.slug)}`,
        lastModified: p.updatedAt,
        changeFrequency: 'monthly',
        priority: 0.4,
      })
    }
  } catch {
    // The database being away must not take the sitemap down with it.
  }
  return pages
}
