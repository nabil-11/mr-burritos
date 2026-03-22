import { connectDB } from '@/lib/mongodb'
import { Category, Product } from '@/lib/models/index'
import ProductCard from '@/components/website/ProductCard'
import mongoose from 'mongoose'
import Link from 'next/link'

type PageProps = { searchParams: Promise<{ category?: string }> }

const categoryIcons: Record<string, string> = {
  tacos: '🌮', burritos: '🌯', snacks: '🍟', boissons: '🥤', boxes: '📦',
}

async function getData(category?: string) {
  await connectDB()
  const categories = await Category.find({ isActive: true }).sort({ order: 1 }).lean()
  const query: Record<string, unknown> = { isAvailable: true, isActive: true }
  if (category) {
    if (mongoose.isValidObjectId(category)) {
      query.category = category
    } else {
      // resolve slug → ObjectId
      const cat = await Category.findOne({ slug: category, isActive: true }).lean()
      if (cat) query.category = (cat as Record<string, unknown>)._id
    }
  }
  const products = await Product.find(query).populate('supplements').lean()
  return { categories, products }
}

export default async function MenuPage({ searchParams }: PageProps) {
  const { category } = await searchParams
  const { categories, products } = await getData(category)

  // match by slug OR objectId
  const activeCat = (categories as Record<string, unknown>[]).find(
    (c) => String(c.slug) === category || String(c._id) === category
  )
  const activeLabel = activeCat ? (activeCat.name as { fr: string }).fr : 'Tous nos plats'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page header */}
      <div className="bg-[#1A1A1A] pt-24 pb-12 px-4 text-center">
        <p className="text-[#F5A800] font-bold text-xs uppercase tracking-widest mb-2">Mr. Burritos</p>
        <h1 className="text-4xl md:text-5xl font-black text-white">Notre Menu</h1>
        <p className="text-white/50 mt-2">Crunch Makes Everything Better</p>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-10">
        {/* Category pills */}
        <div className="flex gap-2 flex-wrap justify-center mb-10">
          <Link href="/menu"
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all ${!category ? 'bg-[#F5A800] text-black shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:border-[#F5A800] hover:text-[#F5A800]'}`}>
            🍽️ Tout voir
          </Link>
          {(categories as Record<string, unknown>[]).map((cat) => {
            const name = cat.name as { fr: string }
            const slug = String(cat.slug ?? '')
            const active = category === slug || category === String(cat._id)
            return (
              <Link key={String(cat._id)} href={`/menu?category=${slug}`}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all ${active ? 'bg-[#F5A800] text-black shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:border-[#F5A800] hover:text-[#F5A800]'}`}>
                {categoryIcons[slug] ?? '🍽️'} {name.fr}
              </Link>
            )
          })}
        </div>

        {/* Section title */}
        <div className="mb-6">
          <h2 className="text-2xl font-black text-[#1A1A1A]">{activeLabel}
            <span className="text-muted-foreground font-normal text-base ml-2">({products.length} plats)</span>
          </h2>
        </div>

        {/* Products grid */}
        {products.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-4xl mb-3">😕</p>
            <p className="font-medium">Aucun produit dans cette catégorie</p>
            <Link href="/menu" className="text-[#F5A800] underline mt-2 inline-block">Voir tout le menu</Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {(products as Record<string, unknown>[]).map((p) => (
              <ProductCard key={String(p._id)} product={JSON.parse(JSON.stringify(p))} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
