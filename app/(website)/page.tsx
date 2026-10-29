import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { MapPin, Phone, Star, BadgePercent, ListChecks, Radio, Navigation } from 'lucide-react'
import HeroMedia from '@/components/website/HeroMedia'
import HeroCta from '@/components/website/HeroCta'
import WebsiteMenu from '@/components/website/WebsiteMenu'
import { DoodleHeart } from '@/components/website/Doodles'
import { getBuilderCategories } from '@/lib/builder'
import { getHomeStats, getReviewSummary, getTopSellers } from '@/lib/stats'
import { OPENING_HOURS, PREP_MINUTES } from '@/lib/hours'
import { WEB_PROMO } from '@/lib/promo'
import { SITE, SITE_ADDRESS_LINE, SITE_URL, WHATSAPP_NUMBER } from '@/lib/site'
import {
  FREE_DELIVERY_FROM,
  REVIEWS_BLOCK_MIN,
  REVIEWS_MIN_DISPLAY,
  TOP_SELLERS,
  roundedOrders,
} from '@/lib/commerce'
import { formatDT } from '@/lib/format'
import { groupSupplements } from '@/lib/supplements'

/**
 * Regenerate every 5 minutes. Prerendered once, this page would serve the order
 * count and the menu as they were at build time — the live numbers below would
 * be frozen and a price change in backoffice would never surface.
 */
export const revalidate = 300

/** L'adresse canonique de l'accueil : un seul exemplaire pour Google, quelle que soit l'URL d'arrivée. */
export const metadata: Metadata = {
  alternates: { canonical: '/' },
}

const SCHEMA_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** « −15 % », espace insécable comprise — la typographie française du site. */
const PROMO = `−${Math.round(WEB_PROMO.rate * 100)} %`

/** « 1 000 » avec une espace insécable ordinaire : l'espace fine de fr-FR disparaît dans certaines polices. */
const fmtCount = (n: number) => n.toLocaleString('fr-FR').replace(/\u202f/g, '\u00a0')
const fmtRating = (n: number) => n.toFixed(1).replace('.', ',')

/**
 * What Google shows beside the name in a local search: hours, phone, address,
 * the kind of food. Built from the same constants the page displays, so the
 * search card cannot drift from the site. La note n'y figure qu'à partir de
 * REVIEWS_MIN_DISPLAY avis.
 */
function restaurantJsonLd(rating: { average: number; count: number }) {
  const hhmm = (h: number) => (h >= 24 ? '23:59' : `${String(h).padStart(2, '0')}:00`)
  const sameAs = Object.values(SITE.social).filter(Boolean)
  return {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: SITE.name,
    url: SITE_URL,
    image: [`${SITE_URL}/hero-banner.jpg`],
    logo: `${SITE_URL}/logo.jpg`,
    telephone: SITE.phone.replace(/\s/g, ''),
    email: SITE.email,
    servesCuisine: ['Tacos', 'Burritos', 'Burgers', 'Fast-food'],
    priceRange: '$',
    currenciesAccepted: 'TND',
    hasMenu: `${SITE_URL}/#menu`,
    address: {
      '@type': 'PostalAddress',
      streetAddress: SITE.address || SITE.location,
      addressLocality: `${SITE.neighbourhood}, ${SITE.city}`,
      addressRegion: SITE.region,
      ...(SITE.postalCode ? { postalCode: SITE.postalCode } : {}),
      addressCountry: SITE.country,
    },
    geo: { '@type': 'GeoCoordinates', latitude: SITE.lat, longitude: SITE.lng },
    openingHoursSpecification: OPENING_HOURS.flatMap((h, i) =>
      h ? [{ '@type': 'OpeningHoursSpecification', dayOfWeek: SCHEMA_DAYS[i], opens: hhmm(h.open), closes: hhmm(h.close) }] : []
    ),
    ...(sameAs.length ? { sameAs } : {}),
    ...(rating.count >= REVIEWS_MIN_DISPLAY
      ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: rating.average, reviewCount: rating.count, bestRating: 5 } }
      : {}),
  }
}

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex gap-0.5" role="img" aria-label={`${fmtRating(value)} sur 5`}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={size}
          aria-hidden
          className={s <= Math.round(value) ? 'fill-[#F5A800] text-[#F5A800]' : 'text-muted-foreground/30'}
        />
      ))}
    </span>
  )
}

/** Les trois promesses sous le hero — ce qui distingue la commande en ligne. */
const PROMISES = [
  { icon: ListChecks, text: 'Composez en 1 minute' },
  { icon: BadgePercent, text: `${PROMO}, payez à la réception` },
  { icon: Radio, text: 'Suivi en direct' },
]

export default async function HomePage() {
  const [categories, stats, reviews, topIds] = await Promise.all([
    getBuilderCategories(),
    // La preuve sociale est un bonus : la page s'affiche sans elle.
    getHomeStats().catch(() => ({ prepared: 0, clients: 0, since: null })),
    getReviewSummary().catch(() => ({ average: 0, count: 0, latest: [] })),
    getTopSellers().catch(() => [] as string[]),
  ])

  const tacos = categories.find((c) => c.slug === 'tacos')
  // « Tacos dès 9,35 DT en ligne » : la plus petite taille, remise en ligne déduite.
  const tacosFrom = tacos?.base
    ? Math.round(
        (tacos.base.price + (groupSupplements(tacos.base.supplements).sizes[0]?.price ?? 0)) * (1 - WEB_PROMO.rate) * 100
      ) / 100
    : null

  // Les plus vendus qui sont encore à la carte, dans l'ordre des ventes.
  const onMenu = new Set(categories.flatMap((c) => [...(c.base ? [c.base._id] : []), ...c.products.map((p) => p._id)]))
  const topSellers = topIds.filter((id) => onMenu.has(id)).slice(0, TOP_SELLERS.count)

  const showRating = reviews.count >= REVIEWS_MIN_DISPLAY
  const commented = reviews.latest.filter((r) => r.comment.trim())
  const showReviews = commented.length >= REVIEWS_BLOCK_MIN
  const orders = roundedOrders(stats.prepared)

  const subtitle = [
    tacosFrom !== null ? `Tacos dès ${formatDT(tacosFrom)} en ligne` : null,
    FREE_DELIVERY_FROM ? `Livraison offerte dès ${formatDT(FREE_DELIVERY_FROM).replace(',00', '')}` : null,
    'Paiement à la livraison',
  ].filter(Boolean)

  const proof = [
    `${PROMO} en ligne`,
    orders ? `+${fmtCount(orders)} commandes servies` : null,
    `Prêt en ~${PREP_MINUTES} min`,
  ].filter(Boolean) as string[]

  return (
    <div className="overflow-x-clip">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(restaurantJsonLd(reviews)).replace(/</g, '\\u003c') }}
      />

      {/* ── HERO ─────────────────────────────────────────────────────────
          One picture, one promise, one button. The food fills the frame and
          the words sit on its shadowed side, so they read in either theme.
          Sur un téléphone, il reste compact (~440 px) : les catégories du
          menu sont visibles dès le premier écran. */}
      <section className="px-3 sm:px-4 pt-[4.5rem] sm:pt-20 pb-6 sm:pb-8">
        <div className="relative max-w-6xl mx-auto overflow-hidden rounded-[1.75rem] sm:rounded-[2.25rem] bg-[#141414] min-h-[27.5rem] sm:min-h-[32rem] lg:min-h-[35rem] flex shadow-2xl shadow-black/20">
          <div className="absolute inset-0 lg:left-[38%]">
            <HeroMedia />
          </div>
          {/* Shadow on the text side: the bottom on a phone, the left on a desktop. */}
          <div className="absolute inset-0 bg-linear-to-t from-[#141414] via-[#141414]/85 via-55% to-[#141414]/10 lg:hidden" />
          <div className="absolute inset-0 hidden lg:block bg-linear-to-r from-[#141414] from-38% via-[#141414]/60 via-52% to-transparent to-75%" />

          <div className="relative z-10 mt-auto lg:my-auto w-full px-5 pb-5 pt-20 sm:px-10 sm:pb-10 lg:p-14 lg:max-w-[40rem] text-white">
            <p className="brush-tag brush-tag-yellow text-[10px] sm:text-[11px]">
              Tacos · Burritos · Burgers — {SITE.neighbourhood}, {SITE.city}
            </p>

            {/* Each line held whole: the marker face is wide, and "Composez-" /
                "le." split at the hyphen on a phone. */}
            <h1 className="font-display text-[2.2rem] leading-[1.02] sm:text-6xl lg:text-[4.25rem] mt-3 sm:mt-4">
              <span className="block whitespace-nowrap">Composez-le.</span>
              <span className="block whitespace-nowrap text-[#F5A800]">On le charge.</span>
            </h1>

            <p className="mt-3 sm:mt-4 text-white/85 text-sm sm:text-lg max-w-md leading-snug sm:leading-relaxed">
              {subtitle.join(' · ')}
            </p>

            <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-5">
              <HeroCta
                href={tacos ? '#menu-tacos' : '#menu'}
                openLabel={tacosFrom !== null ? `Composer mon tacos · dès ${formatDT(tacosFrom)}` : 'Composer mon tacos'}
              />
              <a
                href="#menu"
                className="min-h-11 inline-flex items-center justify-center text-sm font-bold text-white/85 hover:text-white underline-offset-4 hover:underline"
              >
                ou voir tout le menu ↓
              </a>
            </div>

            {/* La preuve, sur une seule ligne et d'un seul style. */}
            <p className="mt-3 sm:mt-5 text-xs sm:text-sm font-semibold text-white/75">
              {proof.join(' · ')}
              {showRating && (
                <>
                  {' · '}
                  <Star size={13} className="inline -mt-0.5 fill-[#F5A800] text-[#F5A800]" aria-hidden /> {fmtRating(reviews.average)} (
                  {reviews.count} avis)
                </>
              )}
            </p>
          </div>
        </div>

        {/* Ce que la commande en ligne apporte, en trois mots. */}
        <ul className="max-w-6xl mx-auto mt-3 grid grid-cols-3 gap-2 text-center">
          {PROMISES.map((p) => (
            <li
              key={p.text}
              className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 rounded-2xl border border-border bg-card px-2 py-2.5 text-[11px] sm:text-sm font-bold text-foreground leading-tight"
            >
              <p.icon size={18} className="text-brand shrink-0" aria-hidden />
              {p.text}
            </li>
          ))}
        </ul>
      </section>

      {/* ── LE MENU ──────────────────────────────────────────────────────
          Every dish on one scroll; the chips stay under the navbar, follow
          the section being read and jump to any other. */}
      <section id="menu" className="px-4 pb-20 scroll-mt-16">
        <div className="max-w-6xl mx-auto">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
            <h2 className="font-display text-4xl sm:text-5xl text-foreground leading-tight">Le menu</h2>
            <p className="inline-flex items-center gap-1.5 rounded-full bg-red-600 text-white px-3 py-1.5 text-xs font-black">
              <BadgePercent size={14} aria-hidden /> {PROMO} sur toute commande en ligne, déduit au panier.
            </p>
          </div>

          {categories.length > 0 ? (
            <WebsiteMenu categories={categories} topSellers={topSellers} />
          ) : (
            <div className="bg-card rounded-3xl border border-border p-10 text-center">
              <p className="text-4xl mb-3">🌮</p>
              <p className="font-bold text-foreground">Le menu est momentanément indisponible</p>
              <p className="text-sm text-muted-foreground mt-2">
                Appelez-nous au{' '}
                <a href={`tel:${SITE.phone.replace(/\s/g, '')}`} className="font-bold text-brand underline underline-offset-4">
                  {SITE.phone}
                </a>{' '}
                pour commander.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ── L'UNIVERS ─────────────────────────────────────────────────────
          L'affiche de la boutique, entière : son lettrage court jusqu'aux
          bords, elle est donc montrée à sa forme, jamais recadrée. */}
      <section className="pb-20">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-end justify-between gap-4 mb-5">
            <h2 className="font-display text-3xl sm:text-4xl text-foreground">L&apos;univers Mr. Burritos</h2>
            <DoodleHeart className="doodle w-8 h-8 text-[#FF6B00] shrink-0 mb-1" />
          </div>
          <div className="overflow-hidden rounded-3xl border border-border shadow-lg shadow-black/10">
            <Image
              src="/hero-banner.jpg"
              alt="Mr. Burritos — burritos, tacos, burgers, nachos, bowls et frites"
              width={1600}
              height={843}
              sizes="(max-width: 1152px) 100vw, 1152px"
              className="w-full h-auto"
            />
          </div>
        </div>
      </section>

      {/* ── ILS EN PARLENT ────────────────────────────────────────────────
          Seulement avec assez d'avis commentés pour que ce soit parlant ;
          sinon une ligne, qui invite le premier client à écrire le sien. */}
      <section className="px-4 pb-20">
        <div className="max-w-6xl mx-auto">
          {showReviews ? (
            <div className="rounded-[2rem] border border-border bg-card p-6 sm:p-8">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-brand">Ils en parlent</p>
              {showRating && (
                <p className="flex items-center gap-3 mt-2">
                  <span className="font-display text-5xl text-foreground leading-none">{fmtRating(reviews.average)}</span>
                  <span>
                    <Stars value={reviews.average} size={18} />
                    <span className="block text-xs text-muted-foreground mt-1">
                      {reviews.count} {reviews.count > 1 ? 'avis vérifiés' : 'avis vérifié'}
                    </span>
                  </span>
                </p>
              )}
              <div className="grid sm:grid-cols-3 gap-3 mt-6">
                {commented.slice(0, 3).map((r, i) => (
                  <figure key={i} className="rounded-2xl bg-background/60 border border-border p-4">
                    <Stars value={r.rating} size={12} />
                    <blockquote className="text-sm text-foreground mt-2 leading-relaxed line-clamp-4">« {r.comment} »</blockquote>
                    <figcaption className="text-xs font-bold text-muted-foreground mt-2">— {r.name}</figcaption>
                  </figure>
                ))}
              </div>
              <div className="mt-5 text-right">
                <Link href="/avis" className="inline-flex min-h-11 items-center text-sm font-black text-brand hover:underline underline-offset-4">
                  Lire les avis &amp; laisser le vôtre →
                </Link>
              </div>
            </div>
          ) : (
            <Link
              href="/avis"
              className="flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-dashed border-border px-4 py-3 text-sm font-bold text-foreground hover:border-[#F5A800] transition-colors"
            >
              <Star size={15} className="text-brand" aria-hidden /> Déjà goûté ? Laissez le premier avis →
            </Link>
          )}
        </div>
      </section>

      {/* ── NOUS TROUVER ──────────────────────────────────────────────────
          Une carte statique plutôt qu'une carte interactive : pas de
          bibliothèque ni de tuiles à charger, et les trois gestes qui
          comptent — y aller, appeler, écrire. Les horaires sont dans le pied
          de page. */}
      <section id="infos" className="px-4 pb-20 scroll-mt-16">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-display text-3xl sm:text-4xl text-foreground mb-6">Nous trouver</h2>
          <div className="isolate grid md:grid-cols-[1.2fr_1fr] rounded-3xl overflow-hidden border border-border bg-card">
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${SITE.lat},${SITE.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Voir ${SITE.name} sur Google Maps`}
              className="relative block min-h-48 md:min-h-64 bg-[#ece6da] dark:bg-[#23211d] overflow-hidden"
            >
              {/* Un plan dessiné : des rues, un parc, l'épingle. Aucun chargement. */}
              <svg aria-hidden viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 w-full h-full">
                <rect x="250" y="20" width="110" height="70" rx="10" className="fill-[#cfe3c4] dark:fill-[#2c3a28]" />
                <g className="stroke-white dark:stroke-[#3a3832]" strokeLinecap="round" fill="none">
                  <path d="M-10 150 L410 120" strokeWidth="16" />
                  <path d="M120 -10 L160 250" strokeWidth="12" />
                  <path d="M-10 60 L240 80" strokeWidth="8" />
                  <path d="M280 250 L330 100 L410 90" strokeWidth="8" />
                  <path d="M40 250 L70 160" strokeWidth="6" />
                </g>
              </svg>
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full flex flex-col items-center">
                <span className="rounded-full bg-[#141414] text-white text-xs font-black px-3 py-1.5 shadow-lg whitespace-nowrap">
                  🌮 {SITE.name}
                </span>
                <MapPin size={34} className="-mt-1 text-[#FF6B00] fill-[#FF6B00]/25 drop-shadow" aria-hidden />
              </span>
            </a>

            <div className="p-5 sm:p-6 flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <span className="w-10 h-10 rounded-full bg-[#F5A800]/12 grid place-items-center shrink-0">
                  <MapPin size={17} className="text-brand" aria-hidden />
                </span>
                <div>
                  <p className="font-black text-foreground">{SITE_ADDRESS_LINE}</p>
                  {SITE.landmark && SITE.landmark !== SITE_ADDRESS_LINE && (
                    <p className="text-muted-foreground text-sm">{SITE.landmark}</p>
                  )}
                  <p className="text-muted-foreground text-xs mt-0.5">Plus code {SITE.location}</p>
                </div>
              </div>

              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${SITE.lat},${SITE.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-12 inline-flex items-center justify-center gap-2 bg-[#F5A800] hover:bg-[#FF6B00] text-black font-black px-6 rounded-2xl transition-colors text-sm"
              >
                <Navigation size={17} aria-hidden /> Itinéraire sur Google Maps
              </a>
              <div className={`grid gap-2 ${WHATSAPP_NUMBER ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <a
                  href={`tel:${SITE.phone.replace(/\s/g, '')}`}
                  className="min-h-11 flex items-center justify-center gap-2 rounded-xl border border-border text-sm font-black text-foreground hover:border-[#F5A800] transition-colors"
                >
                  <Phone size={15} className="text-brand" aria-hidden /> Appeler
                </a>
                {WHATSAPP_NUMBER && (
                  <a
                    href={`https://wa.me/${WHATSAPP_NUMBER}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-11 flex items-center justify-center gap-2 rounded-xl border border-border text-sm font-black text-foreground hover:border-[#25D366] transition-colors"
                  >
                    <span className="w-2 h-2 rounded-full bg-[#25D366]" aria-hidden /> WhatsApp
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── DERNIER APPEL ─────────────────────────────────────────────── */}
      <section className="px-4 pb-24">
        <div className="relative max-w-6xl mx-auto overflow-hidden rounded-[2rem] bg-linear-to-br from-[#FF6B00] via-[#F58A00] to-[#F5A800] px-6 py-10 sm:px-12 sm:py-12 text-black">
          {/* The tacos again, tilted like a polaroid — the band's reason to be clicked. */}
          <div className="hidden md:block absolute right-10 top-1/2 -translate-y-1/2 rotate-6 w-72 lg:w-80 aspect-4/3 rounded-3xl overflow-hidden border-[6px] border-white shadow-2xl shadow-black/30">
            <Image src="/hero-tacos.jpg" alt="" fill sizes="320px" className="object-cover object-[58%_center]" />
          </div>
          <p className="font-display text-4xl sm:text-5xl leading-tight">Une petite faim ?</p>
          <p className="mt-2 text-base sm:text-lg font-bold text-black/80 max-w-lg">
            Votre commande en deux minutes, {PROMO} en ligne, et vous suivez sa préparation en direct.
          </p>
          <a
            href="#menu"
            className="mt-6 min-h-12 inline-flex items-center gap-2 bg-black text-white hover:bg-[#1A1A1A] font-black px-7 rounded-2xl transition-colors"
          >
            Commander maintenant
          </a>
        </div>
      </section>
    </div>
  )
}
