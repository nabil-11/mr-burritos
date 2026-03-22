'use client'

import { useState } from 'react'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel'
import ProductCard from './ProductCard'
import { CartSupplement } from '@/contexts/CartContext'
import { ArrowRight } from 'lucide-react'
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
}

export default function FeaturedSection({
  products,
  categories,
}: {
  products: Product[]
  categories: Category[]
}) {
  const [active, setActive] = useState('all')

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

  return (
    <section className="py-14 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">

        {/* ── Section header ─────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <p className="text-[#F5A800] text-xs font-bold uppercase tracking-widest mb-1">
              Nos produits
            </p>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1A1A1A] leading-tight">
              Nos Incontournables
            </h2>
          </div>
          <Link
            href="/menu"
            className="hidden sm:inline-flex items-center gap-1.5 text-sm font-semibold text-[#1A1A1A] hover:text-[#F5A800] transition-colors"
          >
            Voir tout le menu <ArrowRight size={15} />
          </Link>
        </div>

        {/* ── Filter tabs (Rentify-style pills) ──────── */}
        <div className="flex items-center gap-2 flex-wrap mb-8">
          <button
            onClick={() => setActive('all')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
              active === 'all'
                ? 'bg-[#1A1A1A] text-white shadow-md'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            🍽️ Tous
          </button>
          {categories.map((cat) => (
            <button
              key={cat._id}
              onClick={() => setActive(cat.slug)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                active === cat.slug
                  ? 'bg-[#F5A800] text-black shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tabIcons[cat.slug] ?? '🍽️'} {cat.name.fr}
            </button>
          ))}
        </div>

        {/* ── Horizontal carousel ────────────────────── */}
        <div className="relative">
          <Carousel opts={{ align: 'start', dragFree: true }}>
            <CarouselContent className="-ml-4">
              {filtered.length === 0 ? (
                <CarouselItem className="pl-4">
                  <p className="text-gray-400 py-12">Aucun produit dans cette catégorie.</p>
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

            {/* Navigation arrows — right-aligned below header */}
            <CarouselPrevious className="left-0 top-1/2 bg-white hover:bg-[#F5A800] border-gray-200 hover:border-[#F5A800] text-[#1A1A1A] hover:text-black shadow-md transition-all" />
            <CarouselNext className="right-0 top-1/2 bg-white hover:bg-[#F5A800] border-gray-200 hover:border-[#F5A800] text-[#1A1A1A] hover:text-black shadow-md transition-all" />
          </Carousel>
        </div>

        {/* Mobile "Voir tout" link */}
        <div className="sm:hidden text-center mt-6">
          <Link
            href="/menu"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1A1A1A] hover:text-[#F5A800] transition-colors"
          >
            Voir tout le menu <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </section>
  )
}
