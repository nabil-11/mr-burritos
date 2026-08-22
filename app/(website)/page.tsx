import Link from 'next/link'
import { MapPin, Phone, Clock, ArrowRight } from 'lucide-react'
import BannerCarousel from '@/components/website/BannerCarousel'
import WebsiteBuilder from '@/components/website/WebsiteBuilder'
import OpenStatus from '@/components/website/OpenStatus'
import LocationMap, { DirectionButton } from '@/components/website/LocationMap'
import { getBuilderCategories } from '@/lib/builder'
import { getHomeStats } from '@/lib/stats'
import { OPENING_HOURS } from '@/lib/hours'

/**
 * Regenerate every 5 minutes. Prerendered once, this page would serve the order
 * count and the menu as they were at build time — the live numbers below would
 * be frozen and a price change in backoffice would never surface.
 */
export const revalidate = 300

const CONTACT = {
  phone: '+216 93822570',
  location: 'V557+F6R, Ariana',
  lat: 36.8588769779779,
  lng: 10.16311086959374,
}

const DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']

export default async function HomePage() {
  const [categories, stats] = await Promise.all([getBuilderCategories(), getHomeStats()])

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
            <p className="text-muted-foreground mt-3 text-base max-w-lg leading-relaxed">
              Une taille, vos viandes, vos sauces. Le prix se met à jour à chaque
              étape — pas de surprise à la fin.
            </p>
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
