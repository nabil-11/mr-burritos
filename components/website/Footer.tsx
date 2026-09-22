import Link from 'next/link'
import Image from 'next/image'
import { MapPin, Phone, Mail, Download, Store, Bike, Monitor } from 'lucide-react'
import { SITE } from '@/lib/site'
import { staffApps } from '@/lib/downloads'

const CONTACT = { ...SITE, location: `${SITE.location}, ${SITE.region}` }

/** Internal staff builds — not customer-facing apps. */
const ICONS = { store: Store, bike: Bike, monitor: Monitor }

export default function Footer() {
  // Lu à la construction du site : une application dont le fichier n'est pas
  // là n'est pas proposée. Voir lib/downloads.
  const apps = staffApps()

  return (
    <footer className="bg-background border-t border-border text-foreground">
      <div className="max-w-6xl mx-auto px-4 py-12">

        <div className="grid sm:grid-cols-2 gap-10">
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
                  Crunch makes everything better
                </p>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <a
                href={`tel:${CONTACT.phone}`}
                className="flex items-center gap-2.5 text-muted-foreground hover:text-[#F5A800] transition-colors"
              >
                <Phone size={13} className="text-[#F5A800] shrink-0" />
                {CONTACT.phone}
              </a>
              <a
                href={`mailto:${CONTACT.email}`}
                className="flex items-center gap-2.5 text-muted-foreground hover:text-[#F5A800] transition-colors break-all"
              >
                <Mail size={13} className="text-[#F5A800] shrink-0" />
                {CONTACT.email}
              </a>
              <p className="flex items-center gap-2.5 text-muted-foreground">
                <MapPin size={13} className="text-[#F5A800] shrink-0" />
                {CONTACT.location}
              </p>
            </div>

            <div className="flex gap-4 mt-5 text-sm">
              <Link href="/#menu" className="text-muted-foreground hover:text-[#F5A800] transition-colors">
                Commander
              </Link>
              <Link href="/blog" className="text-muted-foreground hover:text-[#F5A800] transition-colors">
                Blog
              </Link>
              <Link href="/avis" className="text-muted-foreground hover:text-[#F5A800] transition-colors">
                Avis
              </Link>
            </div>
          </div>

          {apps.length > 0 && (
            <div>
              <p className="text-muted-foreground text-[10px] font-black uppercase tracking-widest mb-3">
                Applications équipe
              </p>
              <div className="space-y-2">
                {apps.map((a) => {
                  const Icon = ICONS[a.icon]
                  return (
                    <a
                      key={a.href}
                      href={a.href}
                      download
                      className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:border-[#F5A800]/40 transition-colors group"
                    >
                      <div className="w-9 h-9 rounded-lg bg-[#F5A800]/12 grid place-items-center shrink-0">
                        <Icon size={16} className="text-[#F5A800]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-foreground font-bold text-xs">{a.label}</p>
                        <p className="text-muted-foreground text-[10px]">{a.note}</p>
                      </div>
                      <Download
                        size={14}
                        className="ml-auto text-muted-foreground/60 group-hover:text-[#F5A800] transition-colors shrink-0"
                      />
                    </a>
                  )
                })}
              </div>
              <p className="text-muted-foreground/60 text-[10px] mt-3 leading-snug">
                Réservées à l&apos;équipe : chacune demande un compte pour s&apos;ouvrir.
              </p>
            </div>
          )}
        </div>

        <p className="text-muted-foreground/60 text-[11px] mt-10 pt-6 border-t border-border">
          © {new Date().getFullYear()} Mr. Burritos — Ariana, Tunis
        </p>
      </div>
    </footer>
  )
}
