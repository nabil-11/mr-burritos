import Link from 'next/link'
import Image from 'next/image'
import { MapPin, Phone, Mail, Clock } from 'lucide-react'

const contactInfo = {
  phone: '+216 93822570',
  email: 'mr.burritos.nasr@gmail.com',
  location: 'V557+F6R, Ariana, Tunis',
}

export default function Footer() {
  return (
    <footer className="bg-[#1A1A1A] text-white">
      <div className="max-w-7xl mx-auto px-6 py-14 grid grid-cols-1 md:grid-cols-3 gap-10">
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="relative w-12 h-12 rounded-full overflow-hidden ring-2 ring-[#F5A800]">
              <Image src="/logo.jpg" alt="Mr. Burritos" fill className="object-cover" />
            </div>
            <div>
              <p className="text-[#F5A800] font-black text-lg leading-none">MR. BURRITOS</p>
              <p className="text-white/40 text-xs tracking-widest uppercase">Crunch Makes Everything Better</p>
            </div>
          </div>
          <p className="text-white/50 text-sm leading-relaxed">
            Le meilleur restaurant de Tacos, Burritos et Snacks. Une explosion de saveurs à chaque bouchée.
          </p>
        </div>

        <div>
          <p className="text-[#F5A800] font-bold mb-4 text-sm uppercase tracking-wider">Menu</p>
          <div className="space-y-2">
            {[['Tacos', '/menu?category=tacos'], ['Burritos', '/menu?category=burritos'], ['Snacks', '/menu?category=snacks'], ['Boissons', '/menu?category=boissons']].map(([label, href]) => (
              <Link key={href} href={href} className="block text-white/50 hover:text-[#F5A800] text-sm transition-colors">{label}</Link>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[#F5A800] font-bold mb-4 text-sm uppercase tracking-wider">Contact</p>
          <div className="space-y-3 text-sm text-white/50">
            <a href={`tel:${contactInfo.phone}`} className="flex items-center gap-2 hover:text-[#F5A800] transition-colors">
              <Phone size={14} className="text-[#F5A800] shrink-0" />
              <span>{contactInfo.phone}</span>
            </a>
            <a href={`mailto:${contactInfo.email}`} className="flex items-center gap-2 hover:text-[#F5A800] transition-colors">
              <Mail size={14} className="text-[#F5A800] shrink-0" />
              <span>{contactInfo.email}</span>
            </a>
            <div className="flex items-start gap-2">
              <MapPin size={14} className="text-[#F5A800] mt-0.5 shrink-0" />
              <span>{contactInfo.location}</span>
            </div>
            <div className="flex items-start gap-2">
              <Clock size={14} className="text-[#F5A800] mt-0.5 shrink-0" />
              <span>Tous les jours : 12h00 – 02h00</span>
            </div>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-white/30 text-xs">
        © {new Date().getFullYear()} Mr. Burritos — Tous droits réservés
      </div>
    </footer>
  )
}
