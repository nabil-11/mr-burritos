'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { ShoppingCart, PackageSearch } from 'lucide-react'
import { useCart } from '@/contexts/CartContext'
import CartDrawer from './CartDrawer'
import TrackOrderDrawer from './TrackOrderDrawer'
import OpenStatus from './OpenStatus'
import { isFinal, type TrackedOrder } from '@/lib/orderProgress'
import { loadOrders } from '@/lib/webMemory'

/** Ouvre le tiroir « Suivre ma commande » depuis n'importe où (le pied de page, par exemple). */
export const TRACK_EVENT = 'mb:track-order'

/**
 * Une commande de cet appareil est-elle encore en route ? Le bouton « Suivre »
 * n'a de sens que dans ce cas ; sinon il prend une place précieuse sur un
 * téléphone. Relu à chaque page et au retour sur l'onglet.
 */
function useOrderInProgress(): boolean {
  const pathname = usePathname()
  const [moving, setMoving] = useState(false)

  useEffect(() => {
    let alive = true
    const check = async () => {
      const ids = loadOrders().map((o) => o.id)
      if (!ids.length) return alive && setMoving(false)
      try {
        const res = await fetch(`/api/orders/track?ids=${ids.join(',')}`, { cache: 'no-store' })
        const list = res.ok ? ((await res.json()) as TrackedOrder[]) : []
        if (alive) setMoving(list.some((o) => !isFinal(o.status)))
      } catch {
        // hors ligne : on garde ce qu'on savait
      }
    }
    const first = setTimeout(check, 0)
    const onVisible = () => document.visibilityState === 'visible' && check()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive = false
      clearTimeout(first)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [pathname])

  return moving
}

/**
 * L'en-tête : le logo, l'état du restaurant (ouvert jusqu'à… / fermé, ouvre
 * à…), le panier — et « Suivre ma commande » seulement quand une commande est
 * en cours. Le thème se change dans le pied de page.
 */
export default function WebNavbar() {
  // `hydrated` is the cart's own flag for "localStorage has been read", which
  // is exactly the guard the badge needs — no second mounted state required.
  const { itemCount, hydrated, setDrawerOpen } = useCart()
  const [trackOpen, setTrackOpen] = useState(false)
  const inProgress = useOrderInProgress()
  const count = hydrated ? itemCount : 0

  useEffect(() => {
    const open = () => setTrackOpen(true)
    window.addEventListener(TRACK_EVENT, open)
    return () => window.removeEventListener(TRACK_EVENT, open)
  }, [])

  return (
    <>
      <nav className="fixed top-0 inset-x-0 z-50 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 h-16 flex items-center gap-2 sm:gap-3">
          <Link href="/" className="flex items-center gap-2 shrink-0 group min-h-11" aria-label="Mr. Burritos — accueil">
            <span className="relative w-9 h-9 rounded-full overflow-hidden ring-2 ring-[#F5A800]/70 group-hover:ring-[#F5A800] transition-all">
              <Image src="/logo.jpg" alt="" fill sizes="36px" className="object-cover" />
            </span>
            <span
              className={`text-brand font-black text-[11px] sm:text-sm tracking-wider sm:tracking-widest leading-none whitespace-nowrap ${
                inProgress ? 'hidden sm:block' : 'block'
              }`}
            >
              MR. BURRITOS
            </span>
          </Link>

          <OpenStatus compact />

          <div className="hidden md:flex items-center gap-1 ml-2 text-sm font-bold">
            <Link href="/#menu" className="px-3 min-h-11 inline-flex items-center rounded-full text-muted-foreground hover:text-foreground transition-colors">
              Menu
            </Link>
            <Link href="/avis" className="px-3 min-h-11 inline-flex items-center rounded-full text-muted-foreground hover:text-foreground transition-colors">
              Avis
            </Link>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {inProgress && (
              <button
                onClick={() => setTrackOpen(true)}
                aria-label="Suivre ma commande"
                className="min-w-11 min-h-11 flex items-center justify-center gap-2 text-foreground border border-border hover:border-[#F5A800]/60 font-bold px-3 rounded-full text-xs transition-colors"
              >
                <PackageSearch size={16} className="text-brand" />
                <span className="hidden sm:inline">Suivre ma commande</span>
              </button>
            )}

            <button
              onClick={() => setDrawerOpen(true)}
              aria-label={count > 0 ? `Panier, ${count} article${count > 1 ? 's' : ''}` : 'Panier'}
              className="relative min-w-11 min-h-11 flex items-center justify-center gap-2 bg-[#F5A800] hover:bg-[#FF6B00] text-black font-black px-3 sm:px-4 rounded-full text-sm transition-colors"
            >
              <ShoppingCart size={16} />
              <span className="hidden sm:inline">Panier</span>
              {count > 0 && (
                <span className="min-w-5 h-5 px-1 rounded-full bg-[#1A1A1A] text-white text-[11px] grid place-items-center font-black tabular-nums">
                  {count}
                </span>
              )}
            </button>
          </div>
        </div>
      </nav>

      <CartDrawer />
      <TrackOrderDrawer open={trackOpen} onClose={() => setTrackOpen(false)} />
    </>
  )
}
