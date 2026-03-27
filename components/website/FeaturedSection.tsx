'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel'
import ProductCard from './ProductCard'
import { CartSupplement } from '@/contexts/CartContext'
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'

interface CategoryRef {
  _id: string
  name: { fr: string }
  slug: string
}

interface Product {
  _id: string
  name: { ar: string; fr: string }
  description: { ar: string; fr: string }
  price: number
  image: string
  supplements: CartSupplement[]
  category?: CategoryRef | string
}

interface Category {
  _id: string
  name: { fr: string }
  slug: string
}

const tabIcons: Record<string, string> = {
  tacos: '🌮',
  burritos: '🌯',
  snacks: '🍟',
  boissons: '🥤',
  boxes: '📦',
}

export default function FeaturedSection({
  products,
  categories,
}: {
  products: Product[]
  categories: Category[]
}) {
  const [active, setActive] = useState('all')
  const tabsRef = useRef<HTMLDivElement>(null)
  const [showLeftArrow, setShowLeftArrow] = useState(false)
  const [showRightArrow, setShowRightArrow] = useState(true)

  const filtered =
    active === 'all'
      ? products
      : products.filter((p) => {
          const cat = p.category
          if (!cat) return false
          if (typeof cat === 'object') return cat.slug === active
          // fallback: match by _id string
          return categories.find((c) => c._id === String(cat))?.slug === active
        })

  // Handle horizontal scroll arrows for tabs
  useEffect(() => {
    const handleTabsScroll = () => {
      if (!tabsRef.current) return
      const { scrollLeft, scrollWidth, clientWidth } = tabsRef.current
      setShowLeftArrow(scrollLeft > 0)
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10)
    }

    const tabs = tabsRef.current
    if (tabs) {
      handleTabsScroll()
      tabs.addEventListener('scroll', handleTabsScroll)
      return () => tabs.removeEventListener('scroll', handleTabsScroll)
    }
  }, [categories])

  const scrollTabs = (direction: 'left' | 'right') => {
    if (!tabsRef.current) return
    const scrollAmount = 200
    tabsRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    })
  }

  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">

        {/* ── Section header ─────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
          <div>
            <p className="text-[#F5A800] text-xs font-black uppercase tracking-widest mb-2">
              Notre carte
            </p>
            <h2 className="text-3xl sm:text-4xl font-black text-[#1A1A1A] leading-tight">
              Nos Incontournables
            </h2>
          </div>
          <Link
            href="/menu"
            className="hidden sm:inline-flex items-center gap-2 text-sm font-bold text-[#1A1A1A] hover:text-[#F5A800] transition-colors"
          >
            Voir tout le menu <ArrowRight size={16} />
          </Link>
        </div>

        {/* ── Enhanced filter tabs with scroll ──────── */}
        <div className="relative mb-10">
          {/* Left scroll arrow */}
          {showLeftArrow && (
            <button
              onClick={() => scrollTabs('left')}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white shadow-lg border border-gray-200 flex items-center justify-center hover:bg-[#F5A800] hover:border-[#F5A800] transition-all"
            >
              <ChevronLeft size={18} className="text-[#1A1A1A]" />
            </button>
          )}

          {/* Tabs container with horizontal scroll */}
          <div
            ref={tabsRef}
            className="flex items-center gap-2 overflow-x-auto scrollbar-hide px-10 py-2 -mx-4"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            <button
              onClick={() => setActive('all')}
              className={`flex-shrink-0 px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-200 ${
                active === 'all'
                  ? 'bg-[#1A1A1A] text-white shadow-lg shadow-black/20 scale-105'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
              }`}
            >
              <span className="flex items-center gap-2">
                🍽️ <span>Tout</span>
              </span>
            </button>
            {categories.map((cat) => (
              <button
                key={cat._id}
                onClick={() => setActive(cat.slug)}
                className={`flex-shrink-0 px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-200 ${
                  active === cat.slug
                    ? 'bg-[#F5A800] text-black shadow-lg shadow-[#F5A800]/30 scale-105'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span>{tabIcons[cat.slug] ?? '🍽️'}</span>
                  <span>{cat.name.fr}</span>
                </span>
              </button>
            ))}
          </div>

          {/* Right scroll arrow */}
          {showRightArrow && (
            <button
              onClick={() => scrollTabs('right')}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white shadow-lg border border-gray-200 flex items-center justify-center hover:bg-[#F5A800] hover:border-[#F5A800] transition-all"
            >
              <ChevronRight size={18} className="text-[#1A1A1A]" />
            </button>
          )}
        </div>

        {/* ── Horizontal carousel ────────────────────── */}
        <div className="relative">
          <Carousel opts={{ align: 'start', loop: true }}>
            <CarouselContent className="-ml-4">
              {filtered.length === 0 ? (
                <CarouselItem className="pl-4">
                  <div className="text-center py-16">
                    <p className="text-gray-400 text-lg">Aucun produit dans cette catégorie.</p>
                  </div>
                </CarouselItem>
              ) : (
                filtered.map((p) => (
                  <CarouselItem
                    key={p._id}
                    className="pl-4 basis-4/5 sm:basis-1/2 md:basis-1/3 lg:basis-1/4"
                  >
                    <ProductCard product={p} />
                  </CarouselItem>
                ))
              )}
            </CarouselContent>

            {/* Navigation arrows — positioned at edges */}
            <CarouselPrevious className="left-0 top-1/2 -translate-y-1/2 bg-white hover:bg-[#F5A800] border-2 border-gray-100 hover:border-[#F5A800] text-[#1A1A1A] hover:text-black shadow-xl transition-all z-10 w-12 h-12" />
            <CarouselNext className="right-0 top-1/2 -translate-y-1/2 bg-white hover:bg-[#F5A800] border-2 border-gray-100 hover:border-[#F5A800] text-[#1A1A1A] hover:text-black shadow-xl transition-all z-10 w-12 h-12" />
          </Carousel>
        </div>

        {/* Mobile "Voir tout" link */}
        <div className="sm:hidden text-center mt-8">
          <Link
            href="/menu"
            className="inline-flex items-center gap-2 text-sm font-bold text-[#1A1A1A] hover:text-[#F5A800] transition-colors"
          >
            Voir tout le menu <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  )
}
