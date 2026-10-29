import Link from 'next/link'
import Image from 'next/image'
import { MapPin, Phone, Mail, Clock, Instagram, Facebook } from 'lucide-react'
import ThemeToggle from '@/components/ThemeToggle'
import { SITE, SITE_ADDRESS_LINE, WHATSAPP_NUMBER } from '@/lib/site'
import { hourGroups } from '@/lib/hours'
import TrackOrderLink from './TrackOrderLink'

/** Le logo TikTok, absent de lucide. */
function TikTokIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6 0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64 0 3.33 2.76 5.7 5.69 5.7 3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3s-1.88.09-3.24-1.48Z" />
    </svg>
  )
}

/**
 * Everything a customer looks for at the bottom of a restaurant site: how to
 * reach us, when we're open, where to go next. Les horaires ne sont écrits
 * qu'ici ; le thème clair / sombre se change ici aussi, l'en-tête restant aux
 * trois choses qui font commander. Le lien équipe a disparu : le personnel va
 * directement sur /login.
 */
export default function Footer() {
  const hours = hourGroups()
  const social = [
    { href: SITE.social.instagram, label: 'Instagram', icon: <Instagram size={16} /> },
    { href: SITE.social.facebook, label: 'Facebook', icon: <Facebook size={16} /> },
    { href: SITE.social.tiktok, label: 'TikTok', icon: <TikTokIcon /> },
  ].filter((s) => s.href)

  return (
    <footer className="bg-background border-t border-border text-foreground">
      <div className="max-w-6xl mx-auto px-4 py-12">

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-10">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="relative w-10 h-10 rounded-full overflow-hidden ring-2 ring-[#F5A800]/70">
                <Image src="/logo.jpg" alt="" fill sizes="40px" className="object-cover" />
              </div>
              <div>
                <p className="text-brand font-black text-sm tracking-widest leading-none">
                  MR. BURRITOS
                </p>
                <p className="text-muted-foreground text-[10px] tracking-widest uppercase mt-1">
                  {SITE.tagline}
                </p>
              </div>
            </div>

            <div className="space-y-1 text-sm">
              <a
                href={`tel:${SITE.phone.replace(/\s/g, '')}`}
                className="flex items-center gap-2.5 min-h-11 text-muted-foreground hover:text-brand transition-colors"
              >
                <Phone size={13} className="text-brand shrink-0" />
                {SITE.phone}
              </a>
              {WHATSAPP_NUMBER && (
                <a
                  href={`https://wa.me/${WHATSAPP_NUMBER}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 min-h-11 text-muted-foreground hover:text-[#25D366] transition-colors"
                >
                  <span className="w-[13px] grid place-items-center shrink-0">
                    <span className="w-2 h-2 rounded-full bg-[#25D366]" />
                  </span>
                  WhatsApp
                </a>
              )}
              <a
                href={`mailto:${SITE.email}`}
                className="flex items-center gap-2.5 min-h-11 text-muted-foreground hover:text-brand transition-colors break-all"
              >
                <Mail size={13} className="text-brand shrink-0" />
                {SITE.email}
              </a>
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${SITE.lat},${SITE.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 min-h-11 text-muted-foreground hover:text-brand transition-colors"
              >
                <MapPin size={13} className="text-brand shrink-0" />
                {SITE_ADDRESS_LINE}
              </a>
            </div>

            {social.length > 0 && (
              <div className="mt-3 flex gap-2">
                {social.map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${SITE.name} sur ${s.label}`}
                    className="w-11 h-11 grid place-items-center rounded-full border border-border text-muted-foreground hover:text-brand hover:border-[#F5A800]/50 transition-colors"
                  >
                    {s.icon}
                  </a>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="flex items-center gap-2 text-muted-foreground text-[10px] font-black uppercase tracking-widest mb-3">
              <Clock size={12} className="text-brand" /> Horaires
            </p>
            <ul className="space-y-1.5 text-sm">
              {hours.map((g) => (
                <li key={g.days} className="flex justify-between gap-4 max-w-xs">
                  <span className="text-muted-foreground">{g.days}</span>
                  <span className="font-bold tabular-nums">{g.label}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-muted-foreground text-[10px] font-black uppercase tracking-widest mb-3">
              Mr. Burritos
            </p>
            <ul className="text-sm">
              <li>
                <Link href="/#menu" className="inline-flex items-center min-h-11 text-muted-foreground hover:text-brand transition-colors">
                  Commander en ligne
                </Link>
              </li>
              <li>
                <TrackOrderLink className="inline-flex items-center min-h-11 text-muted-foreground hover:text-brand transition-colors" />
              </li>
              <li>
                <Link href="/avis" className="inline-flex items-center min-h-11 text-muted-foreground hover:text-brand transition-colors">
                  Avis clients
                </Link>
              </li>
              <li>
                <Link href="/blog" className="inline-flex items-center min-h-11 text-muted-foreground hover:text-brand transition-colors">
                  Blog
                </Link>
              </li>
              <li>
                <Link href="/#infos" className="inline-flex items-center min-h-11 text-muted-foreground hover:text-brand transition-colors">
                  Nous trouver
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-border flex flex-wrap items-center justify-between gap-3 text-[11px] text-muted-foreground">
          <p>© {new Date().getFullYear()} Mr. Burritos — {SITE.neighbourhood}, {SITE.city}</p>
          <span className="inline-flex items-center gap-2">
            Thème <ThemeToggle className="w-11 h-11" />
          </span>
        </div>
      </div>
    </footer>
  )
}
