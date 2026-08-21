import Link from 'next/link'
import { connectDB } from '@/lib/mongodb'
import { Category, Product } from '@/lib/models/index'
import { Flame, Clock, Shield, Truck, ChevronDown, MapPin, Phone, Mail, ArrowRight } from 'lucide-react'
import Diaporama from '@/components/website/Diaporama'
import ProductBuilder, { BuilderCategory } from '@/components/website/ProductBuilder'
import LocationMap, { DirectionButton } from '@/components/website/LocationMap'

const CATEGORY_EMOJI: Record<string, string> = {
  tacos: '🌮', burritos: '🌯', snacks: '🍟', boissons: '🥤', boxes: '📦',
}

const SIDE_STYLES: Record<string, string> = {
  snacks: 'from-yellow-400 to-orange-500',
  boissons: 'from-blue-500 to-cyan-600',
  boxes: 'from-purple-600 to-violet-700',
}

const USP = [
  { icon: Flame, title: 'Fait maison', desc: 'Préparé chaque jour' },
  { icon: Clock, title: '30 minutes', desc: 'Livré chrono en main' },
  { icon: Shield, title: 'Frais', desc: 'Ingrédients sélectionnés' },
  { icon: Truck, title: 'Livraison', desc: 'Tunis et banlieue' },
]

const CONTACT = {
  phone: '+216 93822570',
  email: 'mr.burritos.nasr@gmail.com',
  location: 'V557+F6R, Ariana',
  lat: 36.8588769779779,
  lng: 10.16311086959374,
}

type Doc = Record<string, unknown>

async function getData() {
  await connectDB()
  const [categories, bases, dishes] = await Promise.all([
    Category.find({ isActive: true }).sort({ order: 1 }).lean(),
    Product.find({ isBase: true, isActive: true }).populate('supplements').lean(),
    // Named dishes are never shown by name here — they are the picture reel.
    Product.find({ isBase: { $ne: true }, isActive: true, isAvailable: true })
      .select('image category')
      .lean(),
  ])
  return JSON.parse(JSON.stringify({ categories, bases, dishes })) as {
    categories: Doc[]
    bases: Doc[]
    dishes: Doc[]
  }
}

export default async function HomePage() {
  const { categories, bases, dishes } = await getData()

  const galleryFor = (categoryId: string) =>
    dishes
      .filter((d) => String(d.category) === categoryId && d.image)
      .map((d) => String(d.image))

  // A category is composable when it has a base product behind it.
  const composable: BuilderCategory[] = categories
    .map((cat) => {
      const base = bases.find((b) => String(b.category) === String(cat._id))
      if (!base) return null
      const slug = String(cat.slug)
      return {
        _id: String(cat._id),
        slug,
        name: cat.name as { fr: string },
        emoji: CATEGORY_EMOJI[slug] ?? '🍽️',
        gallery: galleryFor(String(cat._id)),
        base: {
          _id: String(base._id),
          name: base.name as { ar: string; fr: string },
          description: base.description as { fr: string },
          price: base.price as number,
          image: String(base.image ?? ''),
          supplements: base.supplements as BuilderCategory['base']['supplements'],
        },
      } satisfies BuilderCategory
    })
    .filter((c): c is BuilderCategory => c !== null)

  const sides = categories.filter(
    (cat) => !bases.some((b) => String(b.category) === String(cat._id))
  )

  const heroShots = composable.flatMap((c) => c.gallery).slice(0, 8)

  return (
    <div className="bg-white">

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="relative h-[85vh] min-h-125 flex items-center justify-center overflow-hidden">
        <Diaporama
          images={heroShots}
          alt="Mr. Burritos"
          interval={4500}
          sizes="100vw"
          className="absolute inset-0"
          preload
        />
        <div className="absolute inset-0 bg-linear-to-b from-black/80 via-black/60 to-black/90" />

        <div className="relative z-10 text-center px-4 max-w-3xl">
          <p className="text-[#F5A800] text-xs font-black uppercase tracking-[0.3em] mb-5">
            Crunch makes everything better
          </p>
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-black text-white leading-[0.95]">
            Composez
            <br />
            <span className="text-[#F5A800]">votre tacos.</span>
          </h1>
          <p className="text-white/60 mt-6 text-base sm:text-lg max-w-md mx-auto leading-relaxed">
            Choisissez la taille, vos viandes, vos sauces. M, XL double viande ou
            XXL triple viande — c&apos;est vous qui décidez.
          </p>
          <a
            href="#composer"
            className="inline-flex items-center gap-2 bg-[#F5A800] hover:bg-[#FF6B00] text-black font-black px-9 py-4 rounded-full transition-all hover:scale-105 shadow-2xl text-sm mt-9"
          >
            Commencer <ArrowRight size={16} />
          </a>
        </div>

        <a
          href="#composer"
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 text-white/40 hover:text-[#F5A800] transition-colors animate-bounce"
          aria-label="Aller au composeur"
        >
          <ChevronDown size={28} />
        </a>
      </section>

      {/* ── LE COMPOSEUR ─────────────────────────────────────── */}
      <section id="composer" className="py-16 sm:py-24 px-4 bg-gray-50 scroll-mt-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-[#F5A800] text-xs font-black uppercase tracking-widest mb-2">
              Étape par étape
            </p>
            <h2 className="text-3xl sm:text-4xl font-black text-[#1A1A1A]">
              Votre commande, à votre façon
            </h2>
            <p className="text-gray-400 mt-3 text-sm max-w-md mx-auto">
              Une catégorie, une taille, vos viandes — le prix se met à jour à
              chaque étape.
            </p>
          </div>

          {composable.length > 0 ? (
            <ProductBuilder categories={composable} />
          ) : (
            <div className="bg-white rounded-3xl border p-10 text-center">
              <p className="text-4xl mb-3">🌮</p>
              <p className="font-bold text-[#1A1A1A]">Le composeur n&apos;est pas encore configuré</p>
              <p className="text-sm text-gray-400 mt-2">
                Lancez <code className="bg-gray-100 px-1.5 py-0.5 rounded">npm run setup-builder</code> pour
                créer les produits de base.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ── À CÔTÉ ───────────────────────────────────────────── */}
      {sides.length > 0 && (
        <section className="py-16 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-end justify-between mb-8">
              <div>
                <p className="text-[#F5A800] text-xs font-black uppercase tracking-widest mb-1">
                  Pour compléter
                </p>
                <h2 className="text-2xl sm:text-3xl font-black text-[#1A1A1A]">À côté</h2>
              </div>
              <Link
                href="/menu"
                className="text-sm font-bold text-gray-400 hover:text-[#F5A800] transition-colors"
              >
                Tout le menu →
              </Link>
            </div>

            <div className="grid grid-cols-3 gap-3 sm:gap-5">
              {sides.map((cat) => {
                const slug = String(cat.slug)
                const name = cat.name as { fr: string }
                const shots = galleryFor(String(cat._id))
                return (
                  <Link
                    key={String(cat._id)}
                    href={`/menu?category=${slug}`}
                    className="group relative aspect-4/5 sm:aspect-square rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
                  >
                    {shots.length > 0 ? (
                      <Diaporama
                        images={shots}
                        alt={name.fr}
                        interval={5000}
                        sizes="(max-width: 640px) 33vw, 300px"
                        className="absolute inset-0"
                      />
                    ) : (
                      <div
                        className={`absolute inset-0 bg-linear-to-br ${SIDE_STYLES[slug] ?? 'from-gray-700 to-gray-900'}`}
                      />
                    )}
                    <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/25 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4 text-center">
                      <span className="block text-3xl sm:text-4xl mb-1 group-hover:scale-110 transition-transform duration-300">
                        {CATEGORY_EMOJI[slug] ?? '🍽️'}
                      </span>
                      <p className="text-white font-black text-sm sm:text-base leading-none">
                        {name.fr}
                      </p>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── USP ──────────────────────────────────────────────── */}
      <section className="bg-[#1A1A1A] py-14 px-4">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {USP.map((u) => (
            <div key={u.title} className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#F5A800]/15 grid place-items-center mx-auto mb-3">
                <u.icon size={20} className="text-[#F5A800]" />
              </div>
              <p className="text-white font-black text-sm">{u.title}</p>
              <p className="text-white/40 text-xs mt-1">{u.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── NOUS TROUVER ─────────────────────────────────────── */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-[#F5A800] text-xs font-black uppercase tracking-widest mb-2">
              Nous trouver
            </p>
            <h2 className="text-3xl font-black text-[#1A1A1A]">Venez nous rendre visite</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-start">
            <div className="order-2 md:order-1">
              <LocationMap lat={CONTACT.lat} lng={CONTACT.lng} popupText="Mr. Burritos - Ariana" />
            </div>

            <div className="order-1 md:order-2 space-y-4">
              <a
                href={`tel:${CONTACT.phone}`}
                className="flex items-center gap-4 p-4 rounded-xl bg-white hover:bg-[#F5A800]/10 transition-all shadow-sm"
              >
                <div className="w-12 h-12 rounded-full bg-[#F5A800]/20 grid place-items-center shrink-0">
                  <Phone size={22} className="text-[#F5A800]" />
                </div>
                <div>
                  <p className="font-bold text-[#1A1A1A]">{CONTACT.phone}</p>
                  <p className="text-gray-400 text-sm">Appelez-nous</p>
                </div>
              </a>

              <a
                href={`mailto:${CONTACT.email}`}
                className="flex items-center gap-4 p-4 rounded-xl bg-white hover:bg-[#F5A800]/10 transition-all shadow-sm"
              >
                <div className="w-12 h-12 rounded-full bg-[#F5A800]/20 grid place-items-center shrink-0">
                  <Mail size={22} className="text-[#F5A800]" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-[#1A1A1A] truncate">{CONTACT.email}</p>
                  <p className="text-gray-400 text-sm">Envoyez un email</p>
                </div>
              </a>

              <div className="flex items-center gap-4 p-4 rounded-xl bg-white shadow-sm">
                <div className="w-12 h-12 rounded-full bg-[#F5A800]/20 grid place-items-center shrink-0">
                  <MapPin size={22} className="text-[#F5A800]" />
                </div>
                <div>
                  <p className="font-bold text-[#1A1A1A]">{CONTACT.location}</p>
                  <p className="text-gray-400 text-sm">Ariana, Tunis</p>
                </div>
              </div>

              <div className="pt-2">
                <DirectionButton lat={CONTACT.lat} lng={CONTACT.lng} />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
