'use client'

import { ArrowRight } from 'lucide-react'
import { useOpenState } from '@/hooks/useOpenState'

/**
 * Le bouton du hero. Ouvert : « Composer mon tacos · dès 9,35 DT ». Fermé :
 * « Préparer ma commande » — le menu reste ouvert, le panier attend
 * l'ouverture. Tant que l'heure n'est pas connue, le libellé « ouvert » : la
 * page arrive du cache et ne sait pas l'heure qu'il est.
 */
export default function HeroCta({ href, openLabel }: { href: string; openLabel: string }) {
  const state = useOpenState()
  const closed = state !== null && !state.open
  return (
    <a
      href={href}
      className="group min-h-12 inline-flex items-center justify-center gap-2 bg-[#F5A800] hover:bg-[#FF6B00] text-black font-black px-4 sm:px-6 py-3.5 rounded-2xl text-[15px] sm:text-base whitespace-nowrap shadow-lg shadow-black/30 transition-colors"
    >
      {closed ? 'Préparer ma commande' : openLabel}
      <ArrowRight size={18} className="hidden min-[400px]:block group-hover:translate-x-0.5 transition-transform" />
    </a>
  )
}
