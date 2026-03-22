import { connectDB } from '@/lib/mongodb'
import { Category } from '@/lib/models/Category'
import { Product } from '@/lib/models/Product'
import ProductCard from '@/components/website/ProductCard'
import Link from 'next/link'

type PageProps = { searchParams: Promise<{ category?: string }> }

async function getData(categoryId?: string) {
  await connectDB()
  const categories = await Category.find({ isActive: true }).sort({ order: 1 }).lean()
  const query: Record<string, unknown> = { isAvailable: true, isActive: true }
  if (categoryId) query.category = categoryId
  const products = await Product.find(query).populate('supplements').lean()
  return { categories, products }
}

export default async function MenuPage({ searchParams }: PageProps) {
  const { category } = await searchParams
  const { categories, products } = await getData(category)

  return (
    <div dir="rtl" className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-black text-center mb-8">
        <span className="text-[#F5A800]">القائمة</span>
      </h1>

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap justify-center mb-8">
        <Link
          href="/menu"
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${!category ? 'bg-[#F5A800] text-black' : 'bg-gray-100 hover:bg-[#F5A800] hover:text-black'}`}
        >
          الكل
        </Link>
        {(categories as Record<string, unknown>[]).map((cat) => (
          <Link
            key={String(cat._id)}
            href={`/menu?category=${cat._id}`}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${category === String(cat._id) ? 'bg-[#F5A800] text-black' : 'bg-gray-100 hover:bg-[#F5A800] hover:text-black'}`}
          >
            {(cat.name as { ar: string; fr: string }).ar}
          </Link>
        ))}
      </div>

      {products.length === 0 ? (
        <p className="text-center text-muted-foreground py-20">لا توجد منتجات</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {(products as Record<string, unknown>[]).map((p) => (
            <ProductCard key={String(p._id)} product={JSON.parse(JSON.stringify(p))} />
          ))}
        </div>
      )}
    </div>
  )
}
