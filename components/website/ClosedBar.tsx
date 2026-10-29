'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { Clock } from 'lucide-react'
import { useOpenState } from '@/hooks/useOpenState'
import { CLOSING_SOON_MINUTES } from '@/lib/commerce'

/**
 * Le bandeau sous l'en-tête : « Fermé pour le moment » tant que la cuisine
 * est fermée, « On ferme à 23:00 » dans la dernière demi-heure. Le menu reste
 * utilisable et le panier est gardé : on prépare sa commande, elle part à
 * l'ouverture.
 *
 * Fixé sous l'en-tête, il publie sa hauteur dans `--banner-h` : la page et la
 * rangée de catégories collante descendent d'autant, rien n'est masqué.
 * Absent du panier (qui le dit lui-même) et du suivi d'une commande.
 */
export default function ClosedBar() {
  const state = useOpenState()
  const pathname = usePathname()
  const hidden = pathname === '/cart' || pathname.startsWith('/order/')
  const closingSoon = !!state?.open && (state.minutesLeft ?? Infinity) <= CLOSING_SOON_MINUTES
  const show = !hidden && !!state && (!state.open || closingSoon)
  const ref = useRef<HTMLDivElement>(null)

  // Sa hauteur réelle — une ligne sur un ordinateur, deux sur un téléphone.
  useEffect(() => {
    const root = document.documentElement
    const el = ref.current
    if (!show || !el) {
      root.style.setProperty('--banner-h', '0px')
      return
    }
    const publish = () => root.style.setProperty('--banner-h', `${el.offsetHeight}px`)
    publish()
    const ro = new ResizeObserver(publish)
    ro.observe(el)
    return () => {
      ro.disconnect()
      root.style.setProperty('--banner-h', '0px')
    }
  }, [show])

  if (!show || !state) return null

  return (
    <div
      ref={ref}
      role="status"
      className={`fixed top-16 inset-x-0 z-40 min-h-11 py-2 flex items-center justify-center px-4 text-center text-[13px] font-bold leading-tight border-b ${
        state.open
          ? 'bg-amber-100 text-amber-950 border-amber-300 dark:bg-amber-950 dark:text-amber-100 dark:border-amber-500/30'
          : 'bg-zinc-100 text-zinc-900 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700'
      }`}
    >
      <p className="flex items-center gap-2 max-w-6xl">
        <Clock size={15} className="shrink-0" />
        {state.open ? (
          <span>On ferme à {state.at} — commandez maintenant.</span>
        ) : (
          <span>
            Fermé pour le moment — commandes en ligne dès {state.at}. Préparez votre panier, il vous attend.
          </span>
        )}
      </p>
    </div>
  )
}
