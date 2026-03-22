'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ShoppingCart, Menu, X } from 'lucide-react'
import { useCart } from '@/contexts/CartContext'
import { useState, useEffect } from 'react'
import CartDrawer from './CartDrawer'

const navLinks = [
  { href: '/', label: 'Accueil' },
  { href: '/menu', label: 'Menu' },
  { href: '/menu?category=tacos', label: 'Tacos' },
  { href: '/menu?category=burritos', label: 'Burritos' },
  { href: '/menu?category=snacks', label: 'Snacks' },
  { href: '/blog', label: 'Blog' },
  { href: '/avis', label: '⭐ Avis' },
  { href: '/menu?category=boxes', label: '📦 Boxes' },
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
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-[#1A1A1A] shadow-xl shadow-black/40' : 'bg-[#1A1A1A]/90 backdrop-blur-md border-b border-white/5'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-17.5">

            {/* Logo */}
            <Link href="/" className="flex items-center gap-2.5 group shrink-0">
              <div className="relative w-10 h-10 rounded-full overflow-hidden ring-2 ring-[#F5A800] group-hover:ring-[#FF6B00] transition-all">
                <Image src="/logo.jpg" alt="Mr. Burritos" fill sizes="40px" className="object-cover" />
              </div>
              <div className="hidden sm:block">
                <p className="text-[#F5A800] font-black text-base leading-none tracking-widest">MR. BURRITOS</p>
                <p className="text-white/40 text-[9px] tracking-widest uppercase mt-0.5">Crunch Makes Everything Better</p>
              </div>
            </Link>

            {/* Desktop nav */}
            <div className="hidden lg:flex items-center gap-0.5">
              {navLinks.map(({ href, label }) => (
                <Link key={href} href={href}
                  className="text-white/75 hover:text-[#F5A800] px-3.5 py-1.5 text-sm font-medium rounded-lg hover:bg-white/5 transition-colors">
                  {label}
                </Link>
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button onClick={() => setCartOpen(true)}
                className="relative flex items-center gap-2 bg-[#F5A800] hover:bg-[#FF6B00] text-black font-bold px-3.5 py-2 rounded-full text-sm transition-all hover:scale-105 active:scale-95">
                <ShoppingCart size={15} />
                <span className="hidden sm:inline">Panier</span>
                {itemCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white text-[10px] w-4.5 h-4.5 min-w-4.5 min-h-4.5 rounded-full flex items-center justify-center font-black shadow">
                    {itemCount}
                  </span>
                )}
              </button>
              <button className="lg:hidden text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
                onClick={() => setMenuOpen(!menuOpen)}>
                {menuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="lg:hidden bg-[#1A1A1A] border-t border-white/10 px-4 pt-1 pb-4">
            {navLinks.map(({ href, label }) => (
              <Link key={href} href={href} onClick={() => setMenuOpen(false)}
                className="flex items-center text-white/80 hover:text-[#F5A800] py-3 text-sm font-medium border-b border-white/5 last:border-0 transition-colors">
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
