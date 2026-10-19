import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Download, Monitor, Store, Bike } from 'lucide-react'
import { staffApps } from '@/lib/downloads'
import LoginForm from './LoginForm'

export const metadata: Metadata = {
  title: 'Espace équipe — Mr. Burritos',
  robots: { index: false, follow: false },
}

const ICONS = { store: Store, bike: Bike, monitor: Monitor }

/**
 * The staff's way in: sign in to the back office, or fetch the till. The
 * installers sit here rather than in the public footer — customers have no use
 * for a 100 MB Windows setup, and the team comes here anyway.
 */
export default function LoginPage() {
  // Read at build time: an app whose file is missing is not offered.
  const apps = staffApps()

  return (
    <div className="min-h-screen bg-[#141414] text-white flex flex-col items-center justify-center gap-6 p-4">
      <div className="w-full max-w-sm rounded-[1.75rem] bg-card text-card-foreground p-6 sm:p-7 shadow-2xl shadow-black/40">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="relative w-14 h-14 rounded-full overflow-hidden ring-2 ring-[#F5A800]">
            <Image src="/logo.jpg" alt="Mr. Burritos" fill sizes="56px" className="object-cover" priority />
          </div>
          <h1 className="font-display text-3xl mt-3">Espace équipe</h1>
          <p className="text-sm text-muted-foreground mt-1">Connectez-vous pour continuer</p>
        </div>
        <LoginForm />
      </div>

      {apps.length > 0 && (
        <div className="w-full max-w-sm space-y-2">
          {apps.map((a) => {
            const Icon = ICONS[a.icon]
            return (
              <a
                key={a.href}
                href={a.href}
                download
                className="flex items-center gap-3 p-3 rounded-2xl border border-white/10 bg-white/5 hover:border-[#F5A800]/50 transition-colors group"
              >
                <span className="w-9 h-9 rounded-xl bg-[#F5A800]/15 grid place-items-center shrink-0">
                  <Icon size={16} className="text-[#F5A800]" />
                </span>
                <span className="min-w-0">
                  <span className="block font-bold text-xs">{a.label}</span>
                  <span className="block text-white/50 text-[10px]">{a.note}</span>
                </span>
                <Download size={14} className="ml-auto text-white/40 group-hover:text-[#F5A800] transition-colors shrink-0" />
              </a>
            )
          })}
        </div>
      )}

      <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-bold text-white/50 hover:text-white transition-colors">
        <ArrowLeft size={13} /> Retour au site
      </Link>
    </div>
  )
}
