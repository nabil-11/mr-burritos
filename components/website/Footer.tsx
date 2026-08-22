import Link from 'next/link'
import Image from 'next/image'
import { MapPin, Phone, Mail, Download, Store, Bike } from 'lucide-react'

const CONTACT = {
  phone: '+216 93822570',
  email: 'mr.burritos.nasr@gmail.com',
  location: 'V557+F6R, Ariana, Tunis',
}

/** Internal Android builds for staff — not customer-facing apps. */
const STAFF_APPS = [
  { href: '/downloads/mr-burritos-manager.apk', icon: Store, label: 'App Manager', note: 'Android · équipe' },
  { href: '/downloads/mr-burritos-livreur.apk', icon: Bike, label: 'App Livreur', note: 'Android · livraison' },
]

export default function Footer() {
  return (
    <footer className="bg-[#0A0A0A] border-t border-white/8 text-white">
      <div className="max-w-4xl mx-auto px-4 py-12">

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
                <p className="text-white/30 text-[10px] tracking-widest uppercase mt-1">
                  Crunch makes everything better
                </p>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <a
                href={`tel:${CONTACT.phone}`}
                className="flex items-center gap-2.5 text-white/50 hover:text-[#F5A800] transition-colors"
              >
                <Phone size={13} className="text-[#F5A800] shrink-0" />
                {CONTACT.phone}
              </a>
              <a
                href={`mailto:${CONTACT.email}`}
                className="flex items-center gap-2.5 text-white/50 hover:text-[#F5A800] transition-colors break-all"
              >
                <Mail size={13} className="text-[#F5A800] shrink-0" />
                {CONTACT.email}
              </a>
              <p className="flex items-center gap-2.5 text-white/50">
                <MapPin size={13} className="text-[#F5A800] shrink-0" />
                {CONTACT.location}
              </p>
            </div>

            <div className="flex gap-4 mt-5 text-sm">
              <Link href="/#composer" className="text-white/50 hover:text-[#F5A800] transition-colors">
                Commander
              </Link>
              <Link href="/blog" className="text-white/50 hover:text-[#F5A800] transition-colors">
                Blog
              </Link>
              <Link href="/avis" className="text-white/50 hover:text-[#F5A800] transition-colors">
                Avis
              </Link>
            </div>
          </div>

          <div>
            <p className="text-white/30 text-[10px] font-black uppercase tracking-widest mb-3">
              Applications équipe
            </p>
            <div className="space-y-2">
              {STAFF_APPS.map((a) => (
                <a
                  key={a.href}
                  href={a.href}
                  download
                  className="flex items-center gap-3 p-3 rounded-xl border border-white/8 bg-white/[0.03] hover:border-[#F5A800]/40 transition-colors group"
                >
                  <div className="w-9 h-9 rounded-lg bg-[#F5A800]/12 grid place-items-center shrink-0">
                    <a.icon size={16} className="text-[#F5A800]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-white font-bold text-xs">{a.label}</p>
                    <p className="text-white/30 text-[10px]">{a.note}</p>
                  </div>
                  <Download
                    size={14}
                    className="ml-auto text-white/20 group-hover:text-[#F5A800] transition-colors shrink-0"
                  />
                </a>
              ))}
            </div>
          </div>
        </div>

        <p className="text-white/20 text-[11px] mt-10 pt-6 border-t border-white/8">
          © {new Date().getFullYear()} Mr. Burritos — Ariana, Tunis
        </p>
      </div>
    </footer>
  )
}
