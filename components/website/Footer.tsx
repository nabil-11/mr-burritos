import Link from 'next/link'
import Image from 'next/image'
import { MapPin, Phone, Mail, Clock } from 'lucide-react'
import { SITE, WHATSAPP_NUMBER } from '@/lib/site'
import { hourGroups } from '@/lib/hours'

/**
 * Everything a customer looks for at the bottom of a restaurant site: how to
 * reach us, when we're open, where to go next. The staff installers used to
 * live here too; they moved to /login, where the people who need them sign in.
 */
export default function Footer() {
  const hours = hourGroups()

  return (
    <footer className="bg-background border-t border-border text-foreground">
      <div className="max-w-6xl mx-auto px-4 py-12">

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-10">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="relative w-10 h-10 rounded-full overflow-hidden ring-2 ring-[#F5A800]/70">
                <Image src="/logo.jpg" alt="Mr. Burritos" fill sizes="40px" className="object-cover" />
              </div>
              <div>
                <p className="text-[#F5A800] font-black text-sm tracking-widest leading-none">
                  MR. BURRITOS
                </p>
                <p className="text-muted-foreground text-[10px] tracking-widest uppercase mt-1">
                  {SITE.tagline}
                </p>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <a
                href={`tel:${SITE.phone.replace(/\s/g, '')}`}
                className="flex items-center gap-2.5 text-muted-foreground hover:text-[#F5A800] transition-colors"
              >
                <Phone size={13} className="text-[#F5A800] shrink-0" />
                {SITE.phone}
              </a>
              {WHATSAPP_NUMBER && (
                <a
                  href={`https://wa.me/${WHATSAPP_NUMBER}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 text-muted-foreground hover:text-[#25D366] transition-colors"
                >
                  <span className="w-[13px] grid place-items-center shrink-0">
                    <span className="w-2 h-2 rounded-full bg-[#25D366]" />
                  </span>
                  WhatsApp
                </a>
              )}
              <a
                href={`mailto:${SITE.email}`}
                className="flex items-center gap-2.5 text-muted-foreground hover:text-[#F5A800] transition-colors break-all"
              >
                <Mail size={13} className="text-[#F5A800] shrink-0" />
                {SITE.email}
              </a>
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${SITE.lat},${SITE.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 text-muted-foreground hover:text-[#F5A800] transition-colors"
              >
                <MapPin size={13} className="text-[#F5A800] shrink-0" />
                {SITE.location}, {SITE.region}
              </a>
            </div>
          </div>

          <div>
            <p className="flex items-center gap-2 text-muted-foreground text-[10px] font-black uppercase tracking-widest mb-3">
              <Clock size={12} className="text-[#F5A800]" /> Horaires
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
            <ul className="space-y-1.5 text-sm">
              <li>
                <Link href="/#menu" className="text-muted-foreground hover:text-[#F5A800] transition-colors">
                  Commander en ligne
                </Link>
              </li>
              <li>
                <Link href="/avis" className="text-muted-foreground hover:text-[#F5A800] transition-colors">
                  Avis clients
                </Link>
              </li>
              <li>
                <Link href="/blog" className="text-muted-foreground hover:text-[#F5A800] transition-colors">
                  Blog
                </Link>
              </li>
              <li>
                <Link href="/#infos" className="text-muted-foreground hover:text-[#F5A800] transition-colors">
                  Nous trouver
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-border flex flex-wrap items-center justify-between gap-3 text-[11px] text-muted-foreground/60">
          <p>© {new Date().getFullYear()} Mr. Burritos — {SITE.city}, {SITE.region}</p>
          <Link href="/login" className="hover:text-muted-foreground transition-colors">
            Espace équipe
          </Link>
        </div>
      </div>
    </footer>
  )
}
