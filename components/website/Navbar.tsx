'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ShoppingCart } from 'lucide-react'
import { useCart } from '@/contexts/CartContext'
import { useState } from 'react'
import CartDrawer from './CartDrawer'

export default function WebNavbar() {
  const { itemCount } = useCart()
  const [cartOpen, setCartOpen] = useState(false)

  return (
    <>
      <nav className="bg-[#1A1A1A] text-white sticky top-0 z-40 border-b border-[#F5A800]/20">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.png" alt="Mr. Burritos" width={44} height={44} className="rounded-full" onError={() => {}} />
            <span className="font-bold text-[#F5A800] text-lg">MR. BURRITOS</span>
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/" className="text-sm hover:text-[#F5A800] transition-colors">الرئيسية</Link>
            <Link href="/menu" className="text-sm hover:text-[#F5A800] transition-colors">القائمة</Link>
            <button
              onClick={() => setCartOpen(true)}
              className="relative flex items-center gap-1 bg-[#F5A800] text-black px-3 py-1.5 rounded-full text-sm font-semibold hover:bg-[#FF6B00] transition-colors"
            >
              <ShoppingCart size={16} />
              <span>السلة</span>
              {itemCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                  {itemCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </nav>
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  )
}
