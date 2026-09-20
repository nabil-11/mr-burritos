import Link from 'next/link'
import { MapPin, Phone, Clock, Star, Bike, Store, ChefHat, ListChecks, ArrowRight, BadgePercent } from 'lucide-react'
import Image from 'next/image'
import HeroMedia from '@/components/website/HeroMedia'
import WebsiteBuilder from '@/components/website/WebsiteBuilder'
import OpenStatus from '@/components/website/OpenStatus'
import LocationMap, { DirectionButton } from '@/components/website/LocationMap'
import { DoodleArrow, DoodleHeart, DoodleSparkle, DoodleSquiggle, DoodleStar } from '@/components/website/Doodles'
import { getBuilderCategories } from '@/lib/builder'
import { getHomeStats, getReviewSummary } from '@/lib/stats'
import { OPENING_HOURS, PREP_MINUTES, TIMEZONE } from '@/lib/hours'
import { WEB_PROMO } from '@/lib/promo'
import { SITE, WHATSAPP_NUMBER } from '@/lib/site'

/**
 * Regenerate every 5 minutes. Prerendered once, this page would serve the order
 * count and the menu as they were at build time — the live numbers below would
 * be frozen and a price change in backoffice would never surface.
 */
export const revalidate = 300

const DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
const SCHEMA_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '')

const fmtCount = (n: number) => n.toLocaleString('fr-FR')

/**
 * What Google shows beside the name in a local search: hours, phone, address,
 * the kind of food. Built from the same constants the page displays, so the
 * search card cannot drift from the site.
 */
function restaurantJsonLd(rating: { average: number; count: number }) {
  const hhmm = (h: number) => (h >= 24 ? '23:59' : `${String(h).padStart(2, '0')}:00`)
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
      streetAddress: SITE.location,
      addressLocality: SITE.city,
      addressRegion: SITE.region,
      addressCountry: SITE.country,
    },
    geo: { '@type': 'GeoCoordinates', latitude: SITE.lat, longitude: SITE.lng },
    openingHoursSpecification: OPENING_HOURS.flatMap((h, i) =>
      h ? [{ '@type': 'OpeningHoursSpecification', dayOfWeek: SCHEMA_DAYS[i], opens: hhmm(h.open), closes: hhmm(h.close) }] : []
    ),
    ...(rating.count > 0
      ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: rating.average, reviewCount: rating.count, bestRating: 5 } }
      : {}),
  }
}

/** Today in Tunis, 0 = Sunday — the hours card highlights it. */
function todayInTunis(): number {
  const wd = new Intl.DateTimeFormat('en-GB', { timeZone: TIMEZONE, weekday: 'short' }).format(new Date())
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(wd)
}

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${value} sur 5`}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={size}
          className={s <= Math.round(value) ? 'fill-[#F5A800] text-[#F5A800]' : 'text-muted-foreground/30'}
        />
      ))}
    </span>
  )
}

/** The shop's own artwork, at its natural size so nothing is cropped. */
const POSTERS = [
  {
    src: '/hero-banner.jpg',
    w: 1600,
    h: 843,
    alt: 'Mr. Burritos — burritos, tacos, burgers, nachos, bowls et frites',
  },
  {
    src: '/hero-banner-2.png',
    w: 1536,
    h: 1024,
    alt: 'Mr. Burritos — Good Food, Good Vibes : burritos et bowls aux ingrédients frais',
  },
]

const STEPS = [
  {
    icon: ListChecks,
    title: 'Composez',
    text: 'Taille, viandes, sauces, extras : votre tacos se remplit sous vos yeux, prix compris.',
  },
  {
    icon: BadgePercent,
    title: `Commandez ${WEB_PROMO.badge}`,
    text: 'Livraison dans l’Ariana ou à emporter. La remise en ligne est automatique, vous payez à la réception.',
  },
  {
    icon: ChefHat,
    title: 'Suivez en direct',
    text: 'Envoyée, confirmée, en cuisine, prête : votre commande avance en temps réel sur votre téléphone.',
  },
]

export default async function HomePage() {
  const [categories, stats, reviews] = await Promise.all([
    getBuilderCategories(),
    getHomeStats(),
    // Word of mouth is a bonus: the page renders without it.
    getReviewSummary().catch(() => ({ average: 0, count: 0, latest: [] })),
  ])

  // Collapse identical opening ranges so seven near-identical lines don't
  // become seven lines of noise.
  const today = todayInTunis()
  const hourGroups = OPENING_HOURS.reduce<{ label: string; days: number[] }[]>((acc, h, i) => {
    const label = h
      ? `${String(h.open).padStart(2, '0')}:00 – ${String(h.close % 24).padStart(2, '0')}:00`
      : 'Fermé'
    const last = acc[acc.length - 1]
    if (last && last.label === label) last.days.push(i)
    else acc.push({ label, days: [i] })
    return acc
  }, [])

  const hasTacos = categories.some((c) => c.slug === 'tacos')

  return (
    <div className="overflow-x-clip">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(restaurantJsonLd(reviews)).replace(/</g, '\\u003c') }}
      />

      {/* ── HERO ─────────────────────────────────────────────────────────
          One picture, one promise, one button. The food fills the frame and
          the words sit on its shadowed side, so they read in either theme.
          On a phone the photo is on top and the text on the dark bottom. */}
      <section className="px-3 sm:px-4 pt-[4.75rem] sm:pt-20 pb-12">
        <div className="relative max-w-6xl mx-auto overflow-hidden rounded-[1.75rem] sm:rounded-[2.25rem] bg-[#141414] min-h-[38rem] sm:min-h-[34rem] lg:min-h-[37rem] flex shadow-2xl shadow-black/20">
          <div className="absolute inset-0 lg:left-[38%]">
            <HeroMedia />
          </div>
          {/* Shadow on the text side: the bottom on a phone, the left on a desktop. */}
          <div className="absolute inset-0 bg-linear-to-t from-[#141414] via-[#141414]/75 to-[#141414]/5 lg:hidden" />
          <div className="absolute inset-0 hidden lg:block bg-linear-to-r from-[#141414] from-38% via-[#141414]/60 via-52% to-transparent to-75%" />

          <div className="relative z-10 mt-auto lg:my-auto w-full px-6 pb-7 pt-40 sm:px-10 sm:pb-10 lg:p-14 lg:max-w-[40rem] text-white">
            <div className="flex flex-wrap items-center gap-2">
              <span className="sm:hidden">
                <OpenStatus onDark />
              </span>
              <span className="brush-tag brush-tag-yellow text-[10px] sm:text-[11px]">Tacos · Burritos · Burgers</span>
            </div>

            {/* Each line held whole: the marker face is wide, and "Composez-" /
                "le." split at the hyphen on a phone. */}
            <h1 className="font-display text-[2.35rem] leading-[1.02] sm:text-6xl lg:text-[4.25rem] mt-4">
              <span className="block whitespace-nowrap">Composez-le.</span>
              <span className="block whitespace-nowrap text-[#F5A800]">On le charge.</span>
            </h1>

            <p className="mt-4 text-white/80 text-base sm:text-lg max-w-md leading-relaxed">
              Taille M, XL ou XXL, jusqu&apos;à trois viandes, vos sauces. Livré dans l&apos;Ariana ou prêt en ~
              {PREP_MINUTES} min.
            </p>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <a
                href={hasTacos ? '#menu-tacos' : '#menu'}
                className="group inline-flex items-center justify-center gap-2 bg-[#F5A800] hover:bg-[#FF6B00] text-black font-black px-7 py-4 rounded-2xl text-base shadow-lg shadow-black/30 transition-colors"
              >
                Composer mon tacos
                <ArrowRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
              </a>
              <a
                href="#menu"
                className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 border border-white/25 backdrop-blur-md text-white font-black px-7 py-4 rounded-2xl text-base transition-colors"
              >
                Voir le menu
              </a>
            </div>

            {/* The offer, then proof counted from real orders and approved reviews — nothing shown empty. */}
            <ul className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-bold text-white/85">
              <li className="inline-flex items-center gap-1.5 rounded-full bg-red-600 text-white px-3 py-1.5 font-black shadow-lg shadow-red-900/30">
                <BadgePercent size={15} /> {WEB_PROMO.badge} en ligne
              </li>
              {reviews.count > 0 && (
                <li className="inline-flex items-center gap-1.5">
                  <Star size={15} className="fill-[#F5A800] text-[#F5A800]" /> {reviews.average.toFixed(1)}
                  <span className="font-medium text-white/60">({reviews.count} avis)</span>
                </li>
              )}
              {stats.prepared > 0 && (
                <li>
                  {fmtCount(stats.prepared)} <span className="font-medium text-white/60">commandes servies</span>
                </li>
              )}
              <li className="inline-flex items-center gap-1.5">
                <Clock size={15} className="text-[#F5A800]" /> ~{PREP_MINUTES} min
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* ── LE MENU ──────────────────────────────────────────────────────
          The chips stay under the navbar while the menu scrolls, and any of
          them opens its category directly. */}
      <section id="menu" className="px-4 pb-20 scroll-mt-16">
        <div className="max-w-6xl mx-auto">
          <div className="mb-5">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#F5A800]">Le menu</p>
            <h2 className="font-display text-4xl sm:text-5xl text-foreground mt-1 leading-tight">
              Composez, choisissez, savourez.
            </h2>
            <DoodleSquiggle className="w-40 h-3 text-[#FF6B00] mt-1" />
            <p className="text-muted-foreground mt-3 max-w-xl">
              Les tacos et les burritos se composent étape par étape ; le reste se choisit en un geste.
            </p>
          </div>

          {categories.length > 0 ? (
            <WebsiteBuilder categories={categories} />
          ) : (
            <div className="bg-card rounded-3xl border border-border p-10 text-center">
              <p className="text-4xl mb-3">🌮</p>
              <p className="font-bold text-foreground">Le menu n&apos;est pas encore configuré</p>
              <p className="text-sm text-muted-foreground mt-2">
                Lancez <code className="bg-muted px-1.5 py-0.5 rounded">npm run upgrade-menu</code>.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ── COMMENT ÇA MARCHE ─────────────────────────────────────────── */}
      <section className="px-4 pb-20">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-display text-3xl sm:text-4xl text-foreground text-center">Comment ça marche</h2>
          <ol className="mt-8 grid md:grid-cols-3 gap-4 relative">
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative rounded-3xl border border-border bg-card p-6">
                <span className="font-display text-5xl text-[#F5A800]/90 leading-none">{i + 1}</span>
                <s.icon size={26} className="absolute top-6 right-6 text-muted-foreground/60" />
                <h3 className="font-black text-lg text-foreground mt-3">{s.title}</h3>
                <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{s.text}</p>
                {i < STEPS.length - 1 && (
                  <DoodleArrow className="hidden md:block absolute -right-7 top-1/2 -translate-y-1/2 w-10 h-7 text-[#FF6B00] z-10" />
                )}
              </li>
            ))}
          </ol>
          <div className="mt-5 flex flex-wrap justify-center gap-2 text-xs font-bold text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5">
              <Bike size={14} className="text-[#F5A800]" /> Livraison 2 à 7 DT selon la distance
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5">
              <Store size={14} className="text-[#F5A800]" /> À emporter, prête en ~{PREP_MINUTES} min
            </span>
          </div>
        </div>
      </section>

      {/* ── L'UNIVERS ─────────────────────────────────────────────────────
          The shop's posters, whole: their lettering runs to the edges, so
          they are shown at their own shape, side by side, never cropped. */}
      <section className="pb-20">
        <div className="max-w-6xl mx-auto px-4 flex items-end justify-between gap-4 mb-5">
          <div>
            <p className="brush-tag text-[10px] sm:text-[11px]">Fresh · Loaded · Irresistible</p>
            <h2 className="font-display text-3xl sm:text-4xl text-foreground mt-3">L&apos;univers Mr. Burritos</h2>
          </div>
          <DoodleHeart className="doodle w-8 h-8 text-[#FF6B00] shrink-0 mb-1" />
        </div>
        <div className="max-w-6xl mx-auto px-4 flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide">
          {POSTERS.map((p) => (
            <div key={p.src} className="snap-start shrink-0 overflow-hidden rounded-3xl border border-border shadow-lg shadow-black/10">
              <Image
                src={p.src}
                alt={p.alt}
                width={p.w}
                height={p.h}
                sizes="(max-width: 640px) 85vw, 560px"
                className="h-52 sm:h-80 w-auto max-w-none"
              />
            </div>
          ))}
        </div>
      </section>

      {/* ── ILS EN PARLENT ────────────────────────────────────────────────
          Approved reviews and real order counts only — nothing decorative. */}
      {(reviews.count > 0 || stats.prepared > 0) && (
        <section className="px-4 pb-20">
          <div className="max-w-6xl mx-auto rounded-[2rem] border border-border bg-card p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#F5A800]">Ils en parlent</p>
                {reviews.count > 0 ? (
                  <p className="flex items-center gap-3 mt-2">
                    <span className="font-display text-5xl text-foreground leading-none">{reviews.average.toFixed(1)}</span>
                    <span>
                      <Stars value={reviews.average} size={18} />
                      <span className="block text-xs text-muted-foreground mt-1">{reviews.count} avis vérifiés</span>
                    </span>
                  </p>
                ) : (
                  <p className="font-display text-3xl text-foreground mt-2">Merci pour votre confiance</p>
                )}
              </div>
              {stats.prepared > 0 && (
                <dl className="flex gap-8">
                  <div>
                    <dd className="font-black text-3xl text-foreground tabular-nums leading-none">{fmtCount(stats.prepared)}</dd>
                    <dt className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-2">Commandes</dt>
                  </div>
                  {stats.clients > 0 && (
                    <div>
                      <dd className="font-black text-3xl text-foreground tabular-nums leading-none">{fmtCount(stats.clients)}</dd>
                      <dt className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-2">Clients</dt>
                    </div>
                  )}
                </dl>
              )}
            </div>

            {reviews.latest.length > 0 && (
              <div className="grid sm:grid-cols-3 gap-3 mt-6">
                {reviews.latest.map((r, i) => (
                  <figure key={i} className="rounded-2xl bg-background/60 border border-border p-4">
                    <Stars value={r.rating} size={12} />
                    <blockquote className="text-sm text-foreground mt-2 leading-relaxed line-clamp-4">« {r.comment} »</blockquote>
                    <figcaption className="text-xs font-bold text-muted-foreground mt-2">— {r.name}</figcaption>
                  </figure>
                ))}
              </div>
            )}

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              {stats.since ? (
                <p className="text-[11px] text-muted-foreground">Comptés depuis {stats.since}, à partir des vraies commandes.</p>
              ) : (
                <span />
              )}
              <Link href="/avis" className="text-sm font-black text-[#F5A800] hover:underline underline-offset-4">
                Lire les avis & laisser le vôtre →
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── NOUS TROUVER ──────────────────────────────────────────────── */}
      <section id="infos" className="px-4 pb-20 scroll-mt-16">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-display text-3xl sm:text-4xl text-foreground mb-6">Nous trouver</h2>
          <div className="grid md:grid-cols-2 gap-5 items-start">
            <div className="rounded-3xl overflow-hidden border border-border">
              <LocationMap lat={SITE.lat} lng={SITE.lng} popupText="Mr. Burritos — Ariana" />
            </div>

            <div className="rounded-3xl border border-border bg-card p-5 space-y-4">
              <div className="flex items-start gap-3">
                <span className="w-10 h-10 rounded-full bg-[#F5A800]/12 grid place-items-center shrink-0">
                  <MapPin size={17} className="text-[#F5A800]" />
                </span>
                <div>
                  <p className="font-black text-foreground text-sm">{SITE.location}</p>
                  <p className="text-muted-foreground text-xs">{SITE.city}, {SITE.region}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="w-10 h-10 rounded-full bg-[#F5A800]/12 grid place-items-center shrink-0">
                  <Clock size={17} className="text-[#F5A800]" />
                </span>
                <ul className="flex-1 space-y-1">
                  {hourGroups.map((g) => {
                    const isToday = g.days.includes(today)
                    return (
                      <li
                        key={g.label + g.days[0]}
                        className={`flex justify-between gap-3 text-sm rounded-lg px-2 py-1 -mx-2 ${
                          isToday ? 'bg-[#F5A800]/12 font-bold text-foreground' : 'text-muted-foreground'
                        }`}
                      >
                        <span>
                          {g.days.length > 1 ? `${DAYS[g.days[0]]} – ${DAYS[g.days[g.days.length - 1]]}` : DAYS[g.days[0]]}
                          {isToday && <span className="ml-1.5 text-[10px] font-black uppercase text-[#F5A800]">aujourd&apos;hui</span>}
                        </span>
                        <span className="tabular-nums text-foreground font-bold">{g.label}</span>
                      </li>
                    )
                  })}
                </ul>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <a
                  href={`tel:${SITE.phone.replace(/\s/g, '')}`}
                  className="flex items-center justify-center gap-2 rounded-xl border border-border py-3 text-sm font-black text-foreground hover:border-[#F5A800] transition-colors"
                >
                  <Phone size={15} className="text-[#F5A800]" /> Appeler
                </a>
                {WHATSAPP_NUMBER ? (
                  <a
                    href={`https://wa.me/${WHATSAPP_NUMBER}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 rounded-xl border border-border py-3 text-sm font-black text-foreground hover:border-[#25D366] transition-colors"
                  >
                    <span className="w-2 h-2 rounded-full bg-[#25D366]" /> WhatsApp
                  </a>
                ) : (
                  <span />
                )}
              </div>
              <DirectionButton lat={SITE.lat} lng={SITE.lng} />
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
          <DoodleStar className="doodle absolute top-5 right-8 w-9 h-9 text-black/25" />
          <DoodleHeart className="doodle absolute bottom-6 right-24 w-7 h-7 text-black/20 [animation-delay:1.5s]" />
          <DoodleSparkle className="absolute -bottom-3 left-1/2 w-16 h-16 text-white/25" />
          <p className="font-display text-4xl sm:text-5xl leading-tight">Une petite faim ?</p>
          <p className="mt-2 text-base sm:text-lg font-bold text-black/75 max-w-lg">
            Votre commande en deux minutes, {WEB_PROMO.badge} en ligne, et vous suivez sa préparation en direct.
          </p>
          <a
            href="#menu"
            className="mt-6 inline-flex items-center gap-2 bg-black text-white hover:bg-[#1A1A1A] font-black px-7 py-4 rounded-2xl transition-colors"
          >
            Commander maintenant <ArrowRight size={18} />
          </a>
        </div>
      </section>
    </div>
  )
}
