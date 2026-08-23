'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'
import { ShoppingCart, PackageSearch } from 'lucide-react'
import { useCart } from '@/contexts/CartContext'
import CartDrawer from './CartDrawer'
import TrackOrderDrawer from './TrackOrderDrawer'
import OpenStatus from './OpenStatus'
import ThemeToggle from '@/components/ThemeToggle'

/**
 * Three jobs, nothing else: say whether we're open, let you find an order in
 * progress, and get you to the cart. The old nav listed five marketing links
 * that all led to the same menu page — none of them are a reason to be here.
 */
export default function WebNavbar() {
  // `hydrated` is the cart's own flag for "localStorage has been read", which
  // is exactly the guard the badge needs — no second mounted state required.
  const { itemCount, total, hydrated } = useCart()
  const [cartOpen, setCartOpen] = useState(false)
  const [trackOpen, setTrackOpen] = useState(false)

  return (
    <>
      <nav className="fixed top-0 inset-x-0 z-50 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-3">

          <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
            <div className="relative w-9 h-9 rounded-full overflow-hidden ring-2 ring-[#F5A800]/70 group-hover:ring-[#F5A800] transition-all">
              <Image src="/logo.jpg" alt="Mr. Burritos" fill sizes="36px" className="object-cover" />
            </div>
            <span className="hidden sm:block text-[#F5A800] font-black text-sm tracking-widest leading-none">
              MR. BURRITOS
            </span>
          </Link>

          <div className="hidden xs:block sm:block">
            <OpenStatus compact />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />

            <button
              onClick={() => setTrackOpen(true)}
              className="flex items-center gap-2 text-muted-foreground hover:text-[#F5A800] border border-border hover:border-[#F5A800]/40 font-semibold px-3 py-2 rounded-full text-xs transition-colors"
            >
              <PackageSearch size={14} />
              <span className="hidden sm:inline">Suivre</span>
            </button>

            <button
              onClick={() => setCartOpen(true)}
              className="relative flex items-center gap-2 bg-[#F5A800] hover:bg-[#FF6B00] text-black font-black px-4 py-2 rounded-full text-xs transition-colors"
            >
              <ShoppingCart size={14} />
              {hydrated && itemCount > 0 ? (
                <span className="tabular-nums">{total.toFixed(2)} DT</span>
              ) : (
                <span className="hidden sm:inline">Panier</span>
              )}
              {hydrated && itemCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-[#1A1A1A] text-foreground text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-black ring-2 ring-background">
                  {itemCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </nav>

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
      <TrackOrderDrawer open={trackOpen} onClose={() => setTrackOpen(false)} />
    </>
  )
}
