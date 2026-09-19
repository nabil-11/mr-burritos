import Link from 'next/link'
import { MapPin, Phone, Clock, ArrowRight, BadgePercent, Star } from 'lucide-react'
import BannerCarousel from '@/components/website/BannerCarousel'
import WebsiteBuilder from '@/components/website/WebsiteBuilder'
import OpenStatus from '@/components/website/OpenStatus'
import LocationMap, { DirectionButton } from '@/components/website/LocationMap'
import { getBuilderCategories } from '@/lib/builder'
import { getHomeStats, getReviewSummary } from '@/lib/stats'
import { OPENING_HOURS, PREP_MINUTES } from '@/lib/hours'
import { WEB_PROMO } from '@/lib/promo'
import { SITE } from '@/lib/site'

/**
 * Regenerate every 5 minutes. Prerendered once, this page would serve the order
 * count and the menu as they were at build time — the live numbers below would
 * be frozen and a price change in backoffice would never surface.
 */
export const revalidate = 300

const CONTACT = SITE

const DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
const SCHEMA_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '')

/** The three things that make ordering here worth it, in the order they happen. */
const HOW = [
  { n: '1', title: 'Composez', text: 'Taille, viandes, sauces' },
  { n: '2', title: `${WEB_PROMO.badge} en ligne`, text: 'Remise automatique' },
  { n: '3', title: 'Suivez en direct', text: `Prête en ~${PREP_MINUTES} min` },
]

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
    hasMenu: `${SITE_URL}/#composer`,
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

export default async function HomePage() {
  const [categories, stats, reviews] = await Promise.all([
    getBuilderCategories(),
    getHomeStats(),
    // Word of mouth is a bonus: the page renders without it.
    getReviewSummary().catch(() => ({ average: 0, count: 0, latest: [] })),
  ])

  // Collapse identical opening ranges so seven near-identical lines don't
  // become seven lines of noise.
  const hourGroups = OPENING_HOURS.reduce<{ label: string; days: string[] }[]>((acc, h, i) => {
    const label = h
      ? `${String(h.open).padStart(2, '0')}:00 – ${String(h.close % 24).padStart(2, '0')}:00`
      : 'Fermé'
    const last = acc[acc.length - 1]
    if (last && last.label === label) last.days.push(DAYS[i])
    else acc.push({ label, days: [DAYS[i]] })
    return acc
  }, [])

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(restaurantJsonLd(reviews)).replace(/</g, '\\u003c') }}
      />

      {/* ── BANNIÈRES ─────────────────────────────────────────── */}
      <section className="pt-20 px-4">
        <div className="max-w-4xl mx-auto">
          <BannerCarousel />
        </div>
      </section>

      {/* ── COMMANDER ─────────────────────────────────────────
          No slogan wall between the banner and the composer: what
          people came to do stays near the top. */}
      <section id="composer" className="pt-10 pb-16 px-4 scroll-mt-16">
        <div className="max-w-4xl mx-auto">

          <div className="mb-8">
            <div className="mb-5">
              <OpenStatus />
            </div>

            <h1 className="text-4xl sm:text-5xl font-black text-foreground leading-[1.05] tracking-tight">
              Composez votre tacos.
            </h1>

            {/* The discount is only granted to orders placed here, so it is
                worth saying before anyone starts composing. */}
            <div className="mt-5 inline-flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
              <span className="grid place-items-center w-9 h-9 rounded-xl bg-emerald-500/15 shrink-0">
                <BadgePercent size={18} className="text-emerald-600 dark:text-emerald-400" />
              </span>
              <span className="text-sm leading-tight">
                <span className="font-black text-emerald-700 dark:text-emerald-300">
                  {WEB_PROMO.badge} sur toute commande en ligne
                </span>
                <span className="block text-muted-foreground text-xs mt-0.5">
                  Remise appliquée automatiquement au panier.
                </span>
              </span>
            </div>
            <p className="text-muted-foreground mt-3 text-base max-w-lg leading-relaxed">
              Une taille, vos viandes, vos sauces. Le prix se met à jour à chaque
              étape — pas de surprise à la fin.
            </p>
            <ol className="mt-5 grid grid-cols-3 gap-2 max-w-lg">
              {HOW.map((s) => (
                <li key={s.n} className="rounded-2xl border border-border bg-card/70 px-3 py-2.5">
                  <span className="text-[10px] font-black text-[#F5A800]">{s.n}</span>
                  <p className="text-xs sm:text-sm font-black text-foreground leading-tight">{s.title}</p>
                  <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 leading-tight">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>

          {categories.length > 0 ? (
            <WebsiteBuilder categories={categories} />
          ) : (
            <div className="bg-card rounded-3xl border border-border p-10 text-center">
              <p className="text-4xl mb-3">🌮</p>
              <p className="font-bold text-foreground">Le composeur n&apos;est pas encore configuré</p>
              <p className="text-sm text-muted-foreground mt-2">
                Lancez <code className="bg-muted px-1.5 py-0.5 rounded">npm run upgrade-menu</code>.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ── LES CHIFFRES ──────────────────────────────────────
          Counted from the orders themselves, so they stay true
          without anyone maintaining them. */}
      {stats.prepared > 0 && (
        <section className="px-4 pb-16">
          <div className="max-w-4xl mx-auto rounded-3xl border border-border bg-card px-6 py-7">
            <div className="grid grid-cols-2 divide-x divide-border">
              {[
                { value: stats.clients, label: 'Clients' },
                { value: stats.prepared, label: 'Commandes' },
              ].map((s) => (
                <div key={s.label} className="text-center px-2">
                  <p className="text-foreground font-black text-3xl sm:text-4xl tabular-nums leading-none">
                    {s.value}
                  </p>
                  <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest mt-2">
                    {s.label}
                  </p>
                </div>
              ))}
            </div>
            {stats.since && (
              <p className="text-center text-muted-foreground/70 text-[11px] mt-6">
                depuis {stats.since}
              </p>
            )}
          </div>
        </section>
      )}

      {/* ── AVIS ──────────────────────────────────────────────────
          Approved reviews only, the same ones the avis page shows. */}
      {reviews.count > 0 && (
        <section className="px-4 pb-16">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-end justify-between gap-4 mb-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Avis clients</p>
                <p className="flex items-center gap-2 mt-1">
                  <span className="text-3xl font-black text-foreground tabular-nums">{reviews.average.toFixed(1)}</span>
                  <span className="flex gap-0.5" aria-label={`${reviews.average} sur 5`}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        size={16}
                        className={s <= Math.round(reviews.average) ? 'fill-[#F5A800] text-[#F5A800]' : 'text-muted-foreground/30'}
                      />
                    ))}
                  </span>
                  <span className="text-xs text-muted-foreground">{reviews.count} avis</span>
                </p>
              </div>
              <Link href="/avis" className="text-sm font-bold text-[#F5A800] hover:underline underline-offset-4 shrink-0">
                Tout lire →
              </Link>
            </div>
            {reviews.latest.length > 0 && (
              <div className="grid sm:grid-cols-3 gap-3">
                {reviews.latest.map((r, i) => (
                  <figure key={i} className="rounded-2xl border border-border bg-card p-4">
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          size={12}
                          className={s <= r.rating ? 'fill-[#F5A800] text-[#F5A800]' : 'text-muted-foreground/30'}
                        />
                      ))}
                    </div>
                    <blockquote className="text-sm text-foreground mt-2 leading-relaxed line-clamp-4">
                      « {r.comment} »
                    </blockquote>
                    <figcaption className="text-xs font-bold text-muted-foreground mt-2">{r.name}</figcaption>
                  </figure>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── INFOS PRATIQUES ───────────────────────────────────── */}
      <section id="infos" className="px-4 pb-20 scroll-mt-16">
        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-5 items-start">

          <div className="rounded-3xl overflow-hidden border border-border">
            <LocationMap lat={CONTACT.lat} lng={CONTACT.lng} popupText="Mr. Burritos — Ariana" />
          </div>

          <div className="space-y-3">
            <a
              href={`tel:${CONTACT.phone}`}
              className="flex items-center gap-4 p-4 rounded-2xl border border-border bg-card hover:border-[#F5A800]/40 transition-colors group"
            >
              <div className="w-10 h-10 rounded-full bg-[#F5A800]/12 grid place-items-center shrink-0">
                <Phone size={17} className="text-[#F5A800]" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-foreground text-sm">{CONTACT.phone}</p>
                <p className="text-muted-foreground text-xs">Appeler le restaurant</p>
              </div>
              <ArrowRight
                size={15}
                className="ml-auto text-muted-foreground/60 group-hover:text-[#F5A800] transition-colors"
              />
            </a>

            <div className="flex items-start gap-4 p-4 rounded-2xl border border-border bg-card">
              <div className="w-10 h-10 rounded-full bg-[#F5A800]/12 grid place-items-center shrink-0">
                <MapPin size={17} className="text-[#F5A800]" />
              </div>
              <div>
                <p className="font-bold text-foreground text-sm">{CONTACT.location}</p>
                <p className="text-muted-foreground text-xs">Ariana, Tunis</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-2xl border border-border bg-card">
              <div className="w-10 h-10 rounded-full bg-[#F5A800]/12 grid place-items-center shrink-0">
                <Clock size={17} className="text-[#F5A800]" />
              </div>
              <div className="min-w-0 space-y-0.5">
                {hourGroups.map((g) => (
                  <p key={g.label + g.days[0]} className="text-sm">
                    <span className="text-muted-foreground">
                      {g.days.length > 1
                        ? `${g.days[0]} – ${g.days[g.days.length - 1]}`
                        : g.days[0]}
                    </span>
                    <span className="text-foreground font-bold ml-2 tabular-nums">{g.label}</span>
                  </p>
                ))}
              </div>
            </div>

            <DirectionButton lat={CONTACT.lat} lng={CONTACT.lng} />
          </div>
        </div>
      </section>

      {/* ── LIRE ─────────────────────────────────────────────── */}
      <section className="px-4 pb-20">
        <div className="max-w-4xl mx-auto flex flex-wrap gap-3">
          <Link
            href="/blog"
            className="flex-1 min-w-40 rounded-2xl border border-border bg-card p-5 hover:border-[#F5A800]/40 transition-colors group"
          >
            <p className="text-foreground font-black text-sm">Le blog</p>
            <p className="text-muted-foreground text-xs mt-1 flex items-center gap-1.5">
              Nos actus{' '}
              <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
            </p>
          </Link>
          <Link
            href="/avis"
            className="flex-1 min-w-40 rounded-2xl border border-border bg-card p-5 hover:border-[#F5A800]/40 transition-colors group"
          >
            <p className="text-foreground font-black text-sm">Laisser un avis</p>
            <p className="text-muted-foreground text-xs mt-1 flex items-center gap-1.5">
              Dites-nous tout{' '}
              <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
            </p>
          </Link>
        </div>
      </section>
    </div>
  )
}
