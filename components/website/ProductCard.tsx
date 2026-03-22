'use client'

import Image from 'next/image'
import { useState } from 'react'
import { useCart, CartSupplement } from '@/contexts/CartContext'
import { Plus, Check, ChevronDown, Flame } from 'lucide-react'
import { toast } from 'sonner'

interface Product {
  _id: string
  name: { ar: string; fr: string }
  description: { ar: string; fr: string }
  price: number
  image: string
  supplements: CartSupplement[]
}

// Emoji & gradient based on product name
function getCardStyle(name: string): { emoji: string; gradient: string } {
  const n = name.toLowerCase()
  if (n.includes('tacos'))      return { emoji: '🌮', gradient: 'from-orange-800 via-amber-700 to-orange-600' }
  if (n.includes('burrito'))    return { emoji: '🌯', gradient: 'from-green-900 via-emerald-800 to-green-700' }
  if (n.includes('nugget'))     return { emoji: '🍗', gradient: 'from-yellow-700 via-amber-600 to-yellow-500' }
  if (n.includes('popper'))     return { emoji: '🧀', gradient: 'from-yellow-600 via-orange-500 to-amber-500' }
  if (n.includes('finger') || n.includes('chicken')) return { emoji: '🍗', gradient: 'from-amber-700 via-yellow-600 to-orange-500' }
  if (n.includes('mix') || n.includes('box'))        return { emoji: '🍱', gradient: 'from-red-800 via-orange-700 to-red-600' }
  if (n.includes('soda') || n.includes('eau') || n.includes('boisson')) return { emoji: '🥤', gradient: 'from-blue-700 via-cyan-600 to-blue-500' }
  return { emoji: '🍴', gradient: 'from-gray-800 via-gray-700 to-gray-600' }
}

export default function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart()
  const [selected, setSelected] = useState<CartSupplement[]>([])
  const [added, setAdded] = useState(false)
  const [showSupps, setShowSupps] = useState(false)

  const sauces = product.supplements?.filter((s) => (s as unknown as { type: string }).type === 'sauce') ?? []
  const extras = product.supplements?.filter((s) => (s as unknown as { type: string }).type !== 'sauce') ?? []
  const hasSupps = sauces.length > 0 || extras.length > 0

  const toggleSup = (sup: CartSupplement) =>
    setSelected((prev) =>
      prev.find((s) => s._id === sup._id) ? prev.filter((s) => s._id !== sup._id) : [...prev, sup]
    )

  const handleAdd = () => {
    addItem({ productId: product._id, name: product.name, price: product.price, image: product.image, quantity: 1, selectedSupplements: selected, notes: '' })
    setAdded(true)
    toast.success(`${product.name.fr} ajouté au panier !`)
    setTimeout(() => { setAdded(false); setSelected([]) }, 1600)
  }

  const suppTotal = selected.reduce((s, x) => s + x.price, 0)
  const { emoji, gradient } = getCardStyle(product.name.fr)

  return (
    <div className="group bg-white rounded-2xl shadow-sm hover:shadow-2xl border border-gray-100 hover:border-[#F5A800]/40 hover:-translate-y-1.5 transition-all duration-300 overflow-hidden flex flex-col">

      {/* ── Image / Placeholder ─────────────────────────── */}
      <div className={`relative h-48 w-full overflow-hidden bg-linear-to-br ${gradient}`}>
        {product.image ? (
          <Image
            src={product.image}
            alt={product.name.fr}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover group-hover:scale-110 transition-transform duration-500"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <span className="text-7xl drop-shadow-xl select-none group-hover:scale-110 transition-transform duration-300">
              {emoji}
            </span>
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-linear-to-t from-black/60 via-black/10 to-transparent" />

        {/* Popular chip */}
        <div className="absolute top-2.5 left-2.5">
          <span className="flex items-center gap-1 bg-black/50 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-1 rounded-full border border-white/10">
            <Flame size={9} className="text-[#F5A800]" /> Populaire
          </span>
        </div>

        {/* Price badge */}
        <div className="absolute bottom-2.5 right-2.5">
          <span className="bg-[#F5A800] text-black text-xs font-black px-3 py-1.5 rounded-full shadow-lg shadow-black/30">
            {product.price.toFixed(2)} DT
          </span>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────── */}
      <div className="p-4 flex-1 flex flex-col gap-3">

        {/* Name + description */}
        <div>
          <h3 className="font-black text-sm text-[#1A1A1A] leading-snug">{product.name.fr}</h3>
          {product.description?.fr && (
            <p className="text-xs text-gray-400 mt-1 line-clamp-2 leading-relaxed">{product.description.fr}</p>
          )}
        </div>

        {/* Supplements — collapsible */}
        {hasSupps && (
          <div className="text-left">
            <button
              onClick={() => setShowSupps(!showSupps)}
              className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400 hover:text-[#F5A800] transition-colors w-full group/btn"
            >
              <ChevronDown size={13} className={`transition-transform duration-200 ${showSupps ? 'rotate-180' : ''}`} />
              <span>Personnaliser</span>
              {selected.length > 0 && (
                <span className="ml-auto bg-[#F5A800] text-black text-[10px] font-black px-2 py-0.5 rounded-full">
                  {selected.length} choix
                </span>
              )}
            </button>

            {showSupps && (
              <div className="mt-2.5 space-y-3 border-t border-gray-100 pt-2.5">
                {sauces.length > 0 && (
                  <div>
                    <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest mb-2">
                      🥫 Sauces incluses
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {sauces.map((sup) => {
                        const active = !!selected.find((s) => s._id === sup._id)
                        return (
                          <button key={sup._id} onClick={() => toggleSup(sup)}
                            className={`text-[10px] px-2.5 py-1 rounded-full border font-semibold transition-all ${
                              active
                                ? 'bg-[#F5A800] border-[#F5A800] text-black shadow-sm scale-105'
                                : 'border-gray-200 text-gray-500 hover:border-[#F5A800]/60 hover:text-[#F5A800]'
                            }`}>
                            {sup.name.fr}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {extras.length > 0 && (
                  <div>
                    <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest mb-2">
                      ✨ Extras
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {extras.map((sup) => {
                        const active = !!selected.find((s) => s._id === sup._id)
                        return (
                          <button key={sup._id} onClick={() => toggleSup(sup)}
                            className={`text-[10px] px-2.5 py-1 rounded-full border font-semibold transition-all ${
                              active
                                ? 'bg-[#F5A800] border-[#F5A800] text-black shadow-sm scale-105'
                                : 'border-gray-200 text-gray-500 hover:border-[#F5A800]/60 hover:text-[#F5A800]'
                            }`}>
                            {sup.name.fr}
                            {sup.price > 0 && (
                              <span className={`ml-1 font-black ${active ? 'text-black/70' : 'text-[#F5A800]'}`}>
                                +{sup.price} DT
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Footer: price + add button ─────────────────── */}
        <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-100">
          <div className="leading-none">
            <p className="font-black text-[#F5A800] text-base">
              {(product.price + suppTotal).toFixed(2)} DT
            </p>
            {suppTotal > 0 && (
              <p className="text-[9px] text-gray-400 mt-0.5">+{suppTotal.toFixed(2)} options</p>
            )}
          </div>
          <button
            onClick={handleAdd}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all shadow-sm ${
              added
                ? 'bg-green-500 text-white scale-95 shadow-green-200'
                : 'bg-[#1A1A1A] hover:bg-[#F5A800] text-white hover:text-black hover:scale-105 active:scale-95 shadow-black/10'
            }`}
          >
            {added ? <><Check size={13} /> Ajouté !</> : <><Plus size={13} /> Ajouter</>}
          </button>
        </div>
      </div>
    </div>
  )
}
