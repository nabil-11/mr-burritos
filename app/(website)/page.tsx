import Link from 'next/link'
import { connectDB } from '@/lib/mongodb'
import { Category } from '@/lib/models/Category'
import { Product } from '@/lib/models/Product'
import ProductCard from '@/components/website/ProductCard'

async function getData() {
  await connectDB()
  const categories = await Category.find({ isActive: true }).sort({ order: 1 }).lean()
  const featured = await Product.find({ isAvailable: true, isActive: true })
    .populate('supplements')
    .limit(8)
    .lean()
  return { categories, featured }
}

export default async function HomePage() {
  const { categories, featured } = await getData()

  return (
    <div dir="rtl">
      {/* Hero */}
      <section className="bg-[#1A1A1A] text-white min-h-[60vh] flex flex-col items-center justify-center text-center px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#F5A800]/10 to-transparent" />
        <div className="relative z-10">
          <h1 className="text-5xl font-black text-[#F5A800] mb-2 tracking-tight">MR. BURRITOS</h1>
          <p className="text-xl text-white/80 mb-1">تاكوس · بوريتوس · سناكس</p>
          <p className="text-sm text-white/50 mb-8">CRUNCH MAKES EVERYTHING BETTER</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link
              href="/menu"
              className="bg-[#F5A800] text-black font-bold px-6 py-3 rounded-full hover:bg-[#FF6B00] transition-colors text-sm"
            >
              اطلب الآن
            </Link>
            <Link
              href="/menu"
              className="border border-[#F5A800] text-[#F5A800] font-bold px-6 py-3 rounded-full hover:bg-[#F5A800] hover:text-black transition-colors text-sm"
            >
              القائمة الكاملة
            </Link>
          </div>
        </div>
      </section>

      {/* Categories */}
      {categories.length > 0 && (
        <section className="py-10 px-4 max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold mb-6 text-center">تصفح الفئات</h2>
          <div className="flex gap-3 flex-wrap justify-center">
            {categories.map((cat: Record<string, unknown>) => (
              <Link
                key={String(cat._id)}
                href={`/menu?category=${cat._id}`}
                className="px-5 py-2 rounded-full bg-[#1A1A1A] text-white hover:bg-[#F5A800] hover:text-black transition-colors font-medium text-sm"
              >
                {(cat.name as { ar: string; fr: string }).ar}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Featured */}
      <section className="py-10 px-4 max-w-6xl mx-auto">
        <h2 className="text-2xl font-bold mb-6 text-center">أبرز المنتجات</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {(featured as Record<string, unknown>[]).map((p) => (
            <ProductCard key={String(p._id)} product={JSON.parse(JSON.stringify(p))} />
          ))}
        </div>
        <div className="text-center mt-8">
          <Link href="/menu" className="bg-[#F5A800] text-black font-bold px-8 py-3 rounded-full hover:bg-[#FF6B00] transition-colors">
            عرض الكل
          </Link>
        </div>
      </section>
    </div>
  )
}
