import Link from 'next/link'
import Image from 'next/image'
import { connectDB } from '@/lib/mongodb'
import { Category, Product } from '@/lib/models/index'
import HeroCarousel from '@/components/website/HeroCarousel'
import FeaturedSection from '@/components/website/FeaturedSection'
import { Flame, Clock, Star, Truck, Utensils, Shield, Heart, MapPin, Phone, Mail } from 'lucide-react'
import LocationMap, { DirectionButton } from '@/components/website/LocationMap'

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

const stats = [
  { value: '10K+', label: 'Clients heureux', icon: Heart },
  { value: '30min', label: 'Livraison', icon: Clock },
  { value: '5★', label: 'Note moyenne', icon: Star },
  { value: '100%', label: 'Fait maison', icon: Utensils },
]

const uspItems = [
  { icon: Flame, title: 'Fait Maison', desc: 'Préparé chaque jour avec amour', color: 'text-orange-500' },
  { icon: Clock, title: 'Rapide', desc: 'Livré en 30 minutes chrono', color: 'text-blue-500' },
  { icon: Shield, title: 'Frais', desc: 'Ingrédients sélectionnés avec soin', color: 'text-green-500' },
  { icon: Truck, title: 'Livraison', desc: 'Partout à Tunis et banlieue', color: 'text-purple-500' },
]

const contactInfo = {
  phone: '+216 93822570',
  email: 'mr.burritos.nasr@gmail.com',
  location: 'V557+F6R, Ariana',
  lat: 36.8588769779779,
  lng: 10.16311086959374,
}

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
      <section className="relative overflow-hidden bg-[#1A1A1A] py-20 px-4">
        <div className="absolute inset-0 opacity-30">
          <Image src="/banner.png" alt="" fill className="object-cover" sizes="100vw" />
        </div>
        
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-32 h-32 bg-[#F5A800] rounded-full blur-[100px] opacity-30" />
        <div className="absolute bottom-0 right-0 w-40 h-40 bg-[#F5A800] rounded-full blur-[120px] opacity-20" />
        
        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <div className="inline-block bg-[#F5A800] text-black text-xs font-black px-4 py-1.5 rounded-full uppercase tracking-widest mb-4">
            Offre Spéciale
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-black text-white mb-6 leading-tight">
            Upgrade XL<br />
            <span className="text-[#F5A800]">+4.5 DT seulement</span>
          </h2>
          <p className="text-white/60 mb-10 text-lg max-w-md mx-auto">
            Rendez votre Tacos encore plus grand. Parce que plus c'est gros, mieux c'est !
          </p>
          <Link
            href="/menu?category=tacos"
            className="inline-flex items-center gap-2 bg-[#F5A800] hover:bg-[#FF6B00] text-black font-black px-8 py-4 rounded-full transition-all hover:scale-105 shadow-xl text-sm"
          >
            Commander un Tacos →
          </Link>
        </div>
      </section>

      {/* ── CONTACT CTA WITH MAP ───────────────────────────────── */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-[#F5A800] text-xs font-bold uppercase tracking-widest mb-2">Nous trouver</p>
            <h2 className="text-3xl font-black text-[#1A1A1A]">Venez nous rendre visite</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-start">
            {/* Map */}
            <div className="order-2 md:order-1">
              <LocationMap 
                lat={contactInfo.lat} 
                lng={contactInfo.lng} 
                popupText="Mr. Burritos - Ariana"
              />
            </div>

            {/* Contact Info */}
            <div className="order-1 md:order-2 space-y-6">
              {/* Phone */}
              <a 
                href={`tel:${contactInfo.phone}`}
                className="flex items-center gap-4 p-4 rounded-xl bg-white hover:bg-[#F5A800]/10 transition-all shadow-sm"
              >
                <div className="w-12 h-12 rounded-full bg-[#F5A800]/20 flex items-center justify-center shrink-0">
                  <Phone size={22} className="text-[#F5A800]" />
                </div>
                <div>
                  <p className="font-bold text-[#1A1A1A]">{contactInfo.phone}</p>
                  <p className="text-gray-400 text-sm">Appelez-nous</p>
                </div>
              </a>

              {/* Email */}
              <a 
                href={`mailto:${contactInfo.email}`}
                className="flex items-center gap-4 p-4 rounded-xl bg-white hover:bg-[#F5A800]/10 transition-all shadow-sm"
              >
                <div className="w-12 h-12 rounded-full bg-[#F5A800]/20 flex items-center justify-center shrink-0">
                  <Mail size={22} className="text-[#F5A800]" />
                </div>
                <div>
                  <p className="font-bold text-[#1A1A1A]">{contactInfo.email}</p>
                  <p className="text-gray-400 text-sm">Envoyez un email</p>
                </div>
              </a>

              {/* Location */}
              <div className="flex items-center gap-4 p-4 rounded-xl bg-white shadow-sm">
                <div className="w-12 h-12 rounded-full bg-[#F5A800]/20 flex items-center justify-center shrink-0">
                  <MapPin size={22} className="text-[#F5A800]" />
                </div>
                <div>
                  <p className="font-bold text-[#1A1A1A]">{contactInfo.location}</p>
                  <p className="text-gray-400 text-sm">Ariana, Tunis</p>
                </div>
              </div>

              {/* Direction Button */}
              <div className="pt-4">
                <DirectionButton 
                  lat={contactInfo.lat} 
                  lng={contactInfo.lng} 
                  address={contactInfo.location}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

    </div>
  )
}
