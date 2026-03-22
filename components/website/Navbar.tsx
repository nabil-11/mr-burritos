'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ShoppingCart, Menu, X } from 'lucide-react'
import { useCart } from '@/contexts/CartContext'
import { useState, useEffect } from 'react'
import CartDrawer from './CartDrawer'

const navLinks = [
  { href: '/', label: 'Accueil' },
  { href: '/menu', label: 'Notre Menu' },
  { href: '/menu?category=tacos', label: 'Tacos' },
  { href: '/menu?category=burritos', label: 'Burritos' },
  { href: '/menu?category=snacks', label: 'Snacks' },
]

export default function WebNavbar() {
  const { itemCount } = useCart()
  const [cartOpen, setCartOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <>
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-[#1A1A1A]/95 backdrop-blur-md shadow-lg shadow-black/30' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-20">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="relative w-12 h-12 rounded-full overflow-hidden ring-2 ring-[#F5A800] ring-offset-2 ring-offset-transparent group-hover:ring-[#FF6B00] transition-all">
                <Image src="/logo.jpg" alt="Mr. Burritos" fill sizes="48px" className="object-cover" />
              </div>
              <div className="hidden sm:block">
                <p className="text-[#F5A800] font-black text-lg leading-none tracking-wide">MR. BURRITOS</p>
                <p className="text-white/50 text-[10px] tracking-widest uppercase">Crunch Makes Everything Better</p>
              </div>
            </Link>

            <div className="hidden lg:flex items-center gap-1">
              {navLinks.map(({ href, label }) => (
                <Link key={href} href={href}
                  className="text-white/80 hover:text-[#F5A800] px-4 py-2 text-sm font-medium rounded-lg hover:bg-white/5 transition-colors">
                  {label}
                </Link>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <button onClick={() => setCartOpen(true)}
                className="relative flex items-center gap-2 bg-[#F5A800] hover:bg-[#FF6B00] text-black font-bold px-4 py-2 rounded-full text-sm transition-all hover:scale-105 active:scale-95">
                <ShoppingCart size={16} />
                <span className="hidden sm:inline">Panier</span>
                {itemCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold shadow">
                    {itemCount}
                  </span>
                )}
              </button>
              <button className="lg:hidden text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
                onClick={() => setMenuOpen(!menuOpen)}>
                {menuOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </div>
        </div>

        {menuOpen && (
          <div className="lg:hidden bg-[#1A1A1A]/98 backdrop-blur-md border-t border-white/10 px-4 pb-4">
            {navLinks.map(({ href, label }) => (
              <Link key={href} href={href} onClick={() => setMenuOpen(false)}
                className="block text-white/80 hover:text-[#F5A800] py-3 text-sm font-medium border-b border-white/5 last:border-0 transition-colors">
                {label}
              </Link>
            ))}
          </div>
        )}
      </nav>
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  )
}
