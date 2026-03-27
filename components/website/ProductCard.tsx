'use client'

import Image from 'next/image'
import { useState } from 'react'
import { useCart, CartSupplement } from '@/contexts/CartContext'
import { Plus, Check, ChevronDown, Flame, Heart } from 'lucide-react'
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
  if (n.includes('soda') || n.includes('eau') || n.includes('boisson') || n.includes('canette')) return { emoji: '🥤', gradient: 'from-blue-700 via-cyan-600 to-blue-500' }
  if (n.includes('box famille') || n.includes('box chilla') || n.includes('box hob')) return { emoji: '📦', gradient: 'from-purple-800 via-violet-700 to-purple-600' }
  return { emoji: '🍴', gradient: 'from-gray-800 via-gray-700 to-gray-600' }
}

export default function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart()
  const [selected, setSelected] = useState<CartSupplement[]>([])
  const [added, setAdded] = useState(false)
  const [showSupps, setShowSupps] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

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
    <div 
      className="group bg-white rounded-2xl shadow-sm hover:shadow-2xl border border-gray-100 hover:border-[#F5A800]/40 hover:-translate-y-2 transition-all duration-300 overflow-hidden flex flex-col"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >

      {/* ── Cinematic Image Area ──────────────────────────── */}
      <div className={`relative h-56 w-full overflow-hidden bg-linear-to-br ${gradient}`}>
        {product.image ? (
          <>
            <Image
              src={product.image}
              alt={product.name.fr}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className={`object-cover transition-all duration-700 ${isHovered ? 'scale-110' : 'scale-100'}`}
            />
            {/* Cinematic gradient overlays */}
            <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent" />
            <div className="absolute inset-0 bg-linear-to-b from-transparent via-black/10 to-black/40" />
          </>
        ) : (
          <>
            <div className="absolute inset-0 bg-linear-to-br" />
            <div className="h-full w-full flex items-center justify-center">
              <span className={`text-8xl drop-shadow-2xl transition-all duration-500 ${isHovered ? 'scale-125 rotate-3' : 'scale-100'}`}>
                {emoji}
              </span>
            </div>
          </>
        )}

        {/* Top badges - floating style */}
        <div className="absolute top-3 left-3 flex flex-col gap-2">
          <span className="flex items-center gap-1 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-3 py-1.5 rounded-full border border-white/10">
            <Flame size={10} className="text-[#F5A800]" /> Populaire
          </span>
        </div>

        {/* Wishlist heart button */}
        <button className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center hover:bg-[#F5A800] hover:scale-110 transition-all group/heart">
          <Heart size={16} className="text-white group-hover/heart:text-black" />
        </button>

        {/* Price badge - cinematic bottom right */}
        <div className="absolute bottom-4 right-4">
          <span className="bg-[#F5A800] text-black text-xs font-black px-4 py-2 rounded-full shadow-xl shadow-black/30">
            {product.price.toFixed(2)} DT
          </span>
        </div>

        {/* Animated shine effect on hover */}
        <div className={`absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full transition-transform duration-1000 ${isHovered ? 'translate-x-full' : ''}`} />
      </div>

      {/* ── Refined Body ────────────────────────────────────── */}
      <div className="p-5 flex-1 flex flex-col gap-4">

        {/* Name + description */}
        <div>
          <h3 className="font-black text-[#1A1A1A] text-base leading-tight group-hover:text-[#F5A800] transition-colors">
            {product.name.fr}
          </h3>
          {product.description?.fr && (
            <p className="text-gray-400 text-xs mt-2 line-clamp-2 leading-relaxed">
              {product.description.fr}
            </p>
          )}
        </div>

        {/* Supplements — collapsible with smooth animation */}
        {hasSupps && (
          <div className="text-left">
            <button
              onClick={() => setShowSupps(!showSupps)}
              className="flex items-center gap-2 text-[11px] font-bold text-gray-400 hover:text-[#F5A800] transition-colors w-full group/btn"
            >
              <ChevronDown size={14} className={`transition-transform duration-200 ${showSupps ? 'rotate-180' : ''}`} />
              <span>Personnaliser</span>
              {selected.length > 0 && (
                <span className="ml-auto bg-[#F5A800] text-black text-[10px] font-black px-2.5 py-0.5 rounded-full">
                  {selected.length} choix
                </span>
              )}
            </button>

            {showSupps && (
              <div className="mt-3 space-y-4 border-t border-gray-100 pt-4 animate-in slide-in-from-top-2 duration-300">
                {sauces.length > 0 && (
                  <div>
                    <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest mb-2.5">
                      🥫 Sauces incluses
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {sauces.map((sup) => {
                        const active = !!selected.find((s) => s._id === sup._id)
                        return (
                          <button 
                            key={sup._id} 
                            onClick={() => toggleSup(sup)}
                            className={`text-[10px] px-3 py-1.5 rounded-full border font-semibold transition-all duration-200 ${
                              active
                                ? 'bg-[#F5A800] border-[#F5A800] text-black shadow-md scale-105'
                                : 'border-gray-200 text-gray-500 hover:border-[#F5A800]/60 hover:text-[#F5A800] hover:bg-gray-50'
                            }`}
                          >
                            {sup.name.fr}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {extras.length > 0 && (
                  <div>
                    <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest mb-2.5">
                      ✨ Extras
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {extras.map((sup) => {
                        const active = !!selected.find((s) => s._id === sup._id)
                        return (
                          <button 
                            key={sup._id} 
                            onClick={() => toggleSup(sup)}
                            className={`text-[10px] px-3 py-1.5 rounded-full border font-semibold transition-all duration-200 ${
                              active
                                ? 'bg-[#F5A800] border-[#F5A800] text-black shadow-md scale-105'
                                : 'border-gray-200 text-gray-500 hover:border-[#F5A800]/60 hover:text-[#F5A800] hover:bg-gray-50'
                            }`}
                          >
                            {sup.name.fr}
                            {sup.price > 0 && (
                              <span className={`ml-1.5 font-black ${active ? 'text-black/70' : 'text-[#F5A800]'}`}>
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

        {/* ── Footer: price + add button ──────────────────────── */}
        <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-100">
          <div className="leading-none">
            <p className="font-black text-[#F5A800] text-lg">
              {(product.price + suppTotal).toFixed(2)} DT
            </p>
            {suppTotal > 0 && (
              <p className="text-[10px] text-gray-400 mt-1">+{suppTotal.toFixed(2)} options</p>
            )}
          </div>
          <button
            onClick={handleAdd}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all duration-300 shadow-md ${
              added
                ? 'bg-green-500 text-white scale-95 shadow-green-300'
                : 'bg-[#1A1A1A] hover:bg-[#F5A800] text-white hover:text-black hover:scale-105 active:scale-95 shadow-black/10'
            }`}
          >
            {added ? (
              <>
                <Check size={14} /> 
                <span>Ajouté !</span>
              </>
            ) : (
              <>
                <Plus size={14} /> 
                <span>Ajouter</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
