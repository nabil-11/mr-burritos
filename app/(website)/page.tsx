import Link from 'next/link'
import Image from 'next/image'
import { connectDB } from '@/lib/mongodb'
import { Category, Product } from '@/lib/models/index'
import ProductCard from '@/components/website/ProductCard'
import HeroCarousel from '@/components/website/HeroCarousel'
import { Flame, Clock, Star, Truck } from 'lucide-react'

async function getData() {
  await connectDB()
  const categories = await Category.find({ isActive: true }).sort({ order: 1 }).lean()
  const featured = await Product.find({ isAvailable: true, isActive: true })
    .populate('supplements')
    .limit(8)
    .lean()
  return { categories, featured }
}

const badges = [
  { icon: Flame, label: 'Fait Maison', sub: 'Chaque jour' },
  { icon: Clock, label: 'Livraison Rapide', sub: '30 min' },
  { icon: Star, label: 'Noté 5 ★', sub: 'Par nos clients' },
  { icon: Truck, label: 'Livraison & Emporter', sub: 'Au choix' },
]

const categoryIcons: Record<string, string> = {
  tacos: '🌮',
  burritos: '🌯',
  snacks: '🍟',
  boissons: '🥤',
}

export default async function HomePage() {
  const { categories, featured } = await getData()

  return (
    <div className="bg-white">

      {/* ── HERO CAROUSEL ───────────────────────────────── */}
      <HeroCarousel />

      {/* ── BADGES / USP ────────────────────────────────── */}
      <section className="bg-[#F5A800]">
        <div className="max-w-6xl mx-auto px-4 py-5 grid grid-cols-2 md:grid-cols-4 gap-3">
          {badges.map(({ icon: Icon, label, sub }) => (
            <div key={label} className="flex items-center gap-3">
              <div className="bg-black/10 rounded-full p-2.5"><Icon size={18} className="text-black" /></div>
              <div>
                <p className="font-black text-black text-sm leading-none">{label}</p>
                <p className="text-black/60 text-xs">{sub}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CATEGORIES ──────────────────────────────────── */}
      {categories.length > 0 && (
        <section className="py-16 px-4 max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-[#F5A800] font-bold text-sm uppercase tracking-widest mb-2">Explorez</p>
            <h2 className="text-3xl md:text-4xl font-black text-[#1A1A1A]">Nos Catégories</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {(categories as Record<string, unknown>[]).map((cat) => {
              const name = cat.name as { ar: string; fr: string }
              const slug = String(cat.slug)
              return (
                <Link key={String(cat._id)} href={`/menu?category=${cat._id}`}
                  className="group relative overflow-hidden rounded-2xl bg-[#1A1A1A] aspect-square flex flex-col items-center justify-center gap-2 hover:bg-[#F5A800] transition-all duration-300 hover:scale-105 shadow-md hover:shadow-xl">
                  <span className="text-5xl group-hover:scale-110 transition-transform duration-300">
                    {categoryIcons[slug] ?? '🍽️'}
                  </span>
                  <p className="text-white group-hover:text-black font-black text-lg tracking-wide transition-colors">
                    {name.fr}
                  </p>
                  <div className="absolute inset-0 ring-2 ring-transparent group-hover:ring-[#1A1A1A] rounded-2xl transition-all" />
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* ── FEATURED PRODUCTS ───────────────────────────── */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-[#F5A800] font-bold text-sm uppercase tracking-widest mb-2">Populaires</p>
            <h2 className="text-3xl md:text-4xl font-black text-[#1A1A1A]">Nos Incontournables</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {(featured as Record<string, unknown>[]).map((p) => (
              <ProductCard key={String(p._id)} product={JSON.parse(JSON.stringify(p))} />
            ))}
          </div>
          <div className="text-center mt-10">
            <Link href="/menu"
              className="inline-flex items-center gap-2 bg-[#1A1A1A] hover:bg-[#F5A800] text-white hover:text-black font-black px-8 py-4 rounded-full transition-all hover:scale-105 shadow-lg">
              Voir tout le menu →
            </Link>
          </div>
        </div>
      </section>

      {/* ── PROMO BANNER ─────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#1A1A1A] py-16 px-4">
        <div className="absolute inset-0 opacity-20">
          <Image src="/banner.png" alt="" fill className="object-cover" />
        </div>
        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <p className="text-[#F5A800] font-bold text-sm uppercase tracking-widest mb-3">Offre Spéciale</p>
          <h2 className="text-4xl md:text-5xl font-black text-white mb-4 leading-tight">
            Upgrade XL<br /><span className="text-[#F5A800]">+4.5 DT seulement</span>
          </h2>
          <p className="text-white/60 mb-8 text-lg">
            Rendez votre Tacos encore plus grand. Parce que plus c&apos;est gros, mieux c&apos;est !
          </p>
          <Link href="/menu?category=tacos"
            className="inline-flex items-center gap-2 bg-[#F5A800] hover:bg-[#FF6B00] text-black font-black px-8 py-4 rounded-full transition-all hover:scale-105 shadow-lg">
            Commander un Tacos →
          </Link>
        </div>
      </section>

    </div>
  )
}
