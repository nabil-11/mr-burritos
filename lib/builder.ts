import { connectDB } from './mongodb'
import { Category, Product } from './models/index'
import type { BuilderCategory, BuilderProduct } from '@/components/website/ProductBuilder'

export const CATEGORY_EMOJI: Record<string, string> = {
  tacos: '🌮', burritos: '🌯', burgers: '🍔', bowls: '🥣', healthy: '🥑',
  snacks: '🍟', boxes: '📦', boissons: '🥤',
}

type Doc = Record<string, unknown>

const toProduct = (d: Doc): BuilderProduct => ({
  _id: String(d._id),
  name: d.name as { ar: string; fr: string },
  description: (d.description ?? { fr: '' }) as { fr: string },
  price: d.price as number,
  image: String(d.image ?? ''),
  supplements: (d.supplements ?? []) as BuilderProduct['supplements'],
})

/**
 * The single source of truth for the step-by-step ordering flow, shared by the
 * website, the kiosk and the backoffice so all three price and configure an
 * item identically.
 *
 * A category with a base product is *composable* — ordered by size and viandes,
 * and its named dishes are deliberately withheld from the client: they exist
 * only as the picture reel. Every other category is ordered by picking one of
 * its dishes.
 */
export async function getBuilderCategories(): Promise<BuilderCategory[]> {
  await connectDB()

  const [categories, bases, dishes] = await Promise.all([
    Category.find({ isActive: true }).sort({ order: 1 }).lean(),
    Product.find({ isBase: true, isActive: true }).populate('supplements').lean(),
    Product.find({ isBase: { $ne: true }, isActive: true, isAvailable: true })
      .populate('supplements')
      .lean(),
  ])

  const raw = JSON.parse(JSON.stringify({ categories, bases, dishes })) as {
    categories: Doc[]
    bases: Doc[]
    dishes: Doc[]
  }

  return raw.categories
    .map((cat) => {
      const id = String(cat._id)
      const slug = String(cat.slug)
      const baseDoc = raw.bases.find((b) => String(b.category) === id)
      const catDishes = raw.dishes.filter((d) => String(d.category) === id)
      const gallery = catDishes.map((d) => String(d.image ?? '')).filter(Boolean)

      // A composable category has nothing to offer without its base product,
      // and a plain one has nothing to offer without dishes.
      if (!baseDoc && catDishes.length === 0) return null

      return {
        _id: id,
        slug,
        name: cat.name as { fr: string },
        emoji: CATEGORY_EMOJI[slug] ?? '🍽️',
        gallery: gallery.length > 0 ? gallery : [String(baseDoc?.image ?? '')].filter(Boolean),
        base: baseDoc ? toProduct(baseDoc) : null,
        // Composable categories never expose their dish names.
        products: baseDoc ? [] : catDishes.map(toProduct),
      } satisfies BuilderCategory
    })
    .filter((c): c is BuilderCategory => c !== null)
}
