'use client'

import { usePathname } from 'next/navigation'
import { ShoppingBag, ChevronRight } from 'lucide-react'
import { useCart } from '@/contexts/CartContext'
import { applyWebPromo } from '@/lib/promo'

/**
 * On a phone the navbar's cart button sits at the top while the thumb is at
 * the bottom, and a composed tacos lands in a cart nobody sees. Once something
 * is in the basket, this bar keeps it in reach — count, promo total, one tap
 * to open. Hidden where it would repeat the page itself (the checkout, an
 * order being tracked) and from `sm` up, where the navbar is close enough.
 */
export default function CartBar() {
  const { itemCount, total, hydrated, drawerOpen, setDrawerOpen } = useCart()
  const pathname = usePathname()
  const hidden = !hydrated || itemCount === 0 || pathname === '/cart' || pathname.startsWith('/order/')
  if (hidden) return null
  const { total: payable } = applyWebPromo(total)

  return (
    <>
      {/* Keeps the footer's last line clear of the bar. */}
      <div className="h-20 sm:hidden" aria-hidden />
      <div
        className={`sm:hidden fixed inset-x-0 bottom-0 z-40 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-linear-to-t from-background via-background/95 to-transparent transition-opacity ${
          drawerOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
      >
        <button
          onClick={() => setDrawerOpen(true)}
          className="w-full flex items-center gap-3 bg-[#F5A800] active:bg-[#FF6B00] text-black rounded-2xl pl-3 pr-4 py-3 shadow-xl shadow-black/25"
        >
          <span className="relative grid place-items-center w-9 h-9 rounded-xl bg-black/15">
            <ShoppingBag size={17} />
            <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-[#1A1A1A] text-white text-[10px] font-black grid place-items-center tabular-nums">
              {itemCount}
            </span>
          </span>
          <span className="font-black text-sm">Voir le panier</span>
          <span className="ml-auto font-black tabular-nums">{payable.toFixed(2)} DT</span>
          <ChevronRight size={18} className="-mr-1" />
        </button>
      </div>
    </>
  )
}
