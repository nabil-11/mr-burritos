'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ShoppingBag, ChevronRight } from 'lucide-react'
import { useCart } from '@/contexts/CartContext'
import { useOpenState } from '@/hooks/useOpenState'
import { applyWebDiscounts } from '@/lib/promo'
import { formatDT } from '@/lib/format'

/**
 * On a phone the navbar's cart button sits at the top while the thumb is at
 * the bottom, and a composed tacos lands in a cart nobody sees. Once something
 * is in the basket, this bar keeps it in reach — count, promo total, one tap
 * to the checkout itself (the drawer would only be one more step). Hidden
 * where it would repeat the page itself (the checkout, an order being
 * tracked) and from `sm` up, where the navbar is close enough.
 *
 * Restaurant fermé : la barre le dit (« Ouvre à 11:00 ») — le panier reste,
 * il partira à l'ouverture.
 */
export default function CartBar() {
  const { itemCount, total, hydrated, drawerOpen, promo } = useCart()
  const open = useOpenState()
  const pathname = usePathname()
  const hidden = !hydrated || itemCount === 0 || pathname === '/cart' || pathname.startsWith('/order/')
  if (hidden) return null
  const { total: payable } = applyWebDiscounts(total, promo?.terms)
  const closed = open !== null && !open.open

  return (
    <>
      {/* Keeps the footer's last line clear of the bar. */}
      <div className="h-20 sm:hidden" aria-hidden />
      <div
        className={`sm:hidden fixed inset-x-0 bottom-0 z-40 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-linear-to-t from-background via-background/95 to-transparent transition-opacity ${
          drawerOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
      >
        <Link
          href="/cart"
          className={`w-full flex items-center gap-3 rounded-2xl pl-3 pr-4 py-3 shadow-xl shadow-black/25 ${
            closed ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'bg-[#F5A800] active:bg-[#FF6B00] text-black'
          }`}
        >
          <span className="relative grid place-items-center w-9 h-9 rounded-xl bg-black/15">
            <ShoppingBag size={17} />
            <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-[#1A1A1A] text-white text-[10px] font-black grid place-items-center tabular-nums">
              {itemCount}
            </span>
          </span>
          <span className="font-black text-sm">{closed ? `Ouvre à ${open?.at} · voir mon panier` : 'Voir le panier'}</span>
          <span className="ml-auto font-black tabular-nums whitespace-nowrap">{formatDT(payable)}</span>
          <ChevronRight size={18} className="-mr-1" />
        </Link>
      </div>
    </>
  )
}
