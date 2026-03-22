import Link from 'next/link'
import Image from 'next/image'
import { connectDB } from '@/lib/mongodb'
import { Category, Product } from '@/lib/models/index'
import HeroCarousel from '@/components/website/HeroCarousel'
import FeaturedSection from '@/components/website/FeaturedSection'
import { Flame, Clock, Star, Truck } from 'lucide-react'

async function getData() {
  await connectDB()
  const categories = await Category.find({ isActive: true }).sort({ order: 1 }).lean()
  const featured = await Product.find({ isAvailable: true, isActive: true })
    .populate('supplements')
    .populate('category')
    .sort({ createdAt: -1 })
    .limit(12)
    .lean()
  return { categories, featured }
}

const badges = [
  { icon: Flame, label: 'Fait Maison', sub: 'Chaque jour' },
  { icon: Clock, label: 'Livraison Rapide', sub: '30 min' },
  { icon: Star, label: 'Noté 5 ★', sub: 'Par nos clients' },
  { icon: Truck, label: 'Livraison & Emporter', sub: 'Au choix' },
]

const categoryStyles: Record<string, { emoji: string; gradient: string; text: string; border: string }> = {
  tacos:    { emoji: '🌮', gradient: 'from-orange-500 to-amber-600',  text: 'text-white', border: 'border-orange-400/30' },
  burritos: { emoji: '🌯', gradient: 'from-emerald-600 to-green-700', text: 'text-white', border: 'border-emerald-400/30' },
  snacks:   { emoji: '🍟', gradient: 'from-yellow-400 to-orange-500', text: 'text-black', border: 'border-yellow-300/40' },
  boissons: { emoji: '🥤', gradient: 'from-blue-500 to-cyan-600',     text: 'text-white', border: 'border-blue-400/30' },
  boxes:    { emoji: '📦', gradient: 'from-purple-600 to-violet-700', text: 'text-white', border: 'border-purple-400/30' },
}

export default async function HomePage() {
  const { categories, featured } = await getData()
  const serialized = JSON.parse(JSON.stringify(featured))
  const serializedCats = JSON.parse(JSON.stringify(categories))

  return (
    <div className="bg-white">

      {/* ── HERO CAROUSEL ───────────────────────────────────── */}
      <HeroCarousel />

      {/* ── USP BADGES ──────────────────────────────────────── */}
      <section className="bg-[#F5A800] border-b border-black/5">
        <div className="max-w-6xl mx-auto px-4 py-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          {badges.map(({ icon: Icon, label, sub }) => (
            <div key={label} className="flex items-center gap-3">
              <div className="bg-black/10 rounded-full p-2.5 shrink-0">
                <Icon size={16} className="text-black" />
              </div>
              <div>
                <p className="font-extrabold text-black text-sm leading-none">{label}</p>
                <p className="text-black/60 text-xs mt-0.5">{sub}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CATEGORIES ──────────────────────────────────────── */}
      {categories.length > 0 && (
        <section className="py-14 px-4 bg-gray-50/60">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-end justify-between mb-8">
              <div>
                <p className="text-[#F5A800] text-xs font-bold uppercase tracking-widest mb-1">Explorez</p>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1A1A1A]">Nos Catégories</h2>
              </div>
              <Link href="/menu" className="hidden sm:inline text-sm font-semibold text-gray-500 hover:text-[#F5A800] transition-colors">
                Tout voir →
              </Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {(serializedCats as Record<string, unknown>[]).map((cat) => {
                const name = cat.name as { fr: string }
                const slug = String(cat.slug)
                const style = categoryStyles[slug] ?? { emoji: '🍽️', gradient: 'from-gray-700 to-gray-800', text: 'text-white', border: 'border-white/20' }
                return (
                  <Link
                    key={String(cat._id)}
                    href={`/menu?category=${slug}`}
                    className={`group relative overflow-hidden rounded-2xl bg-linear-to-br ${style.gradient} aspect-square flex flex-col items-center justify-center gap-3 hover:scale-[1.03] active:scale-95 transition-all duration-300 shadow-md hover:shadow-xl border ${style.border}`}
                  >
                    <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors rounded-2xl" />
                    <span className="relative text-6xl drop-shadow-lg group-hover:scale-110 transition-transform duration-300 select-none">
                      {style.emoji}
                    </span>
                    <div className="relative text-center">
                      <p className={`${style.text} font-extrabold text-base tracking-wide leading-none`}>{name.fr}</p>
                      <p className={`${style.text} opacity-60 text-xs mt-1 font-medium`}>Explorer →</p>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── FEATURED — Rentify-style horizontal carousel ────── */}
      <FeaturedSection products={serialized} categories={serializedCats} />

      {/* ── PROMO BANNER ────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#1A1A1A] py-16 px-4">
        <div className="absolute inset-0 opacity-20">
          <Image src="/banner.png" alt="" fill className="object-cover" sizes="100vw" />
        </div>
        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <p className="text-[#F5A800] font-bold text-xs uppercase tracking-widest mb-3">Offre Spéciale</p>
          <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-4 leading-tight">
            Upgrade XL<br />
            <span className="text-[#F5A800]">+4.5 DT seulement</span>
          </h2>
          <p className="text-white/60 mb-8 text-base">
            Rendez votre Tacos encore plus grand. Parce que plus c&apos;est gros, mieux c&apos;est !
          </p>
          <Link
            href="/menu?category=tacos"
            className="inline-flex items-center gap-2 bg-[#F5A800] hover:bg-[#FF6B00] text-black font-extrabold px-8 py-4 rounded-full transition-all hover:scale-105 shadow-lg text-sm"
          >
            Commander un Tacos →
          </Link>
        </div>
      </section>

    </div>
  )
}
