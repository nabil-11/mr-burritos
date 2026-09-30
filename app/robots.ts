import type { MetadataRoute } from 'next'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '')

/**
 * The public site is for search engines; the back office, the kiosk, the API,
 * the basket and private order links are not.
 */
const PRIVATE = [
  '/api/',
  '/cart',
  '/order/',
  '/login',
  '/commander',
  '/dashboard',
  '/orders',
  '/products',
  '/categories',
  '/supplements',
  '/configuration',
  '/delivery-companies',
  '/posts',
  '/recettes',
  '/reports',
  '/reservations',
  '/reviews',
  '/users',
  '/downloads/',
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: PRIVATE },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
