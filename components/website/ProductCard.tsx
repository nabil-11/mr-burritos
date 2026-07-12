'use client'

import Image from 'next/image'
import { useState } from 'react'
import { useCart, CartSupplement } from '@/contexts/CartContext'
import { Plus, Check, Flame, Minus, Settings2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

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
  if (n.includes('box famille') || n.includes('box chilla') || n.includes('box hob') || n.includes('box')) return { emoji: '📦', gradient: 'from-purple-800 via-violet-700 to-purple-600' }
  if (n.includes('mix'))        return { emoji: '🍱', gradient: 'from-red-800 via-orange-700 to-red-600' }
  if (n.includes('soda') || n.includes('eau') || n.includes('boisson') || n.includes('canette')) return { emoji: '🥤', gradient: 'from-blue-700 via-cyan-600 to-blue-500' }
  return { emoji: '🍴', gradient: 'from-gray-800 via-gray-700 to-gray-600' }
}

export default function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart()
  const [selected, setSelected] = useState<CartSupplement[]>([])
  const [quantity, setQuantity] = useState(1)
  const [added, setAdded] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  const sauces = product.supplements?.filter((s) => (s as unknown as { type: string }).type === 'sauce') ?? []
  const extras = product.supplements?.filter((s) => (s as unknown as { type: string }).type !== 'sauce') ?? []
  const hasSupps = sauces.length > 0 || extras.length > 0

  const toggleSup = (sup: CartSupplement) =>
    setSelected((prev) =>
      prev.find((s) => s._id === sup._id) ? prev.filter((s) => s._id !== sup._id) : [...prev, sup]
    )

  const flashAdded = () => {
    setAdded(true)
    setTimeout(() => setAdded(false), 1200)
  }

  // Simple products: one-click add. Products with options: open the modal.
  const handleAddClick = () => {
    if (hasSupps) {
      setSelected([])
      setQuantity(1)
      setModalOpen(true)
      return
    }
    addItem({ productId: product._id, name: product.name, price: product.price, image: product.image, quantity: 1, selectedSupplements: [], notes: '' })
    flashAdded()
    toast.success(`${product.name.fr} ajouté au panier !`)
  }

  const handleConfirm = () => {
    for (let i = 0; i < quantity; i++) {
      addItem({ productId: product._id, name: product.name, price: product.price, image: product.image, quantity: 1, selectedSupplements: selected, notes: '' })
    }
    setModalOpen(false)
    flashAdded()
    toast.success(`${quantity}× ${product.name.fr} ajouté au panier !`)
  }

  const modalSuppTotal = selected.reduce((s, x) => s + x.price, 0)
  const modalTotal = (product.price + modalSuppTotal) * quantity
  const { emoji, gradient } = getCardStyle(product.name.fr)

  const optionChip = (sup: CartSupplement, withPrice: boolean) => {
    const active = !!selected.find((s) => s._id === sup._id)
    return (
      <button
        key={sup._id}
        type="button"
        onClick={() => toggleSup(sup)}
        className={`text-xs px-3 py-2 rounded-full border font-semibold transition-all duration-200 flex items-center gap-1.5 ${
          active
            ? 'bg-[#F5A800] border-[#F5A800] text-black shadow-md'
            : 'border-gray-200 text-gray-600 hover:border-[#F5A800]/60 hover:text-[#F5A800] hover:bg-gray-50'
        }`}
      >
        {active && <Check size={12} />}
        {sup.name.fr}
        {withPrice && sup.price > 0 && (
          <span className={`font-black ${active ? 'text-black/70' : 'text-[#F5A800]'}`}>+{sup.price} DT</span>
        )}
      </button>
    )
  }

  return (
    <>
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

          {/* ── Footer: price + add button ──────────────────────── */}
          <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-100">
            <div className="leading-none">
              <p className="font-black text-[#F5A800] text-lg">
                {product.price.toFixed(2)} DT
              </p>
              {hasSupps && (
                <p className="text-[10px] text-gray-400 mt-1">Options disponibles</p>
              )}
            </div>
            <button
              onClick={handleAddClick}
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
                  {hasSupps ? <Settings2 size={14} /> : <Plus size={14} />}
                  <span>{hasSupps ? 'Choisir' : 'Ajouter'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Customization modal (opens on "Choisir") ──────────── */}
      {hasSupps && (
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg font-black text-[#1A1A1A]">{product.name.fr}</DialogTitle>
              {product.description?.fr && (
                <DialogDescription>{product.description.fr}</DialogDescription>
              )}
            </DialogHeader>

            <div className="space-y-5 max-h-[50vh] overflow-y-auto pr-1">
              {sauces.length > 0 && (
                <div>
                  <p className="text-[11px] font-black text-gray-500 uppercase tracking-widest mb-2.5">🥫 Sauces</p>
                  <div className="flex flex-wrap gap-2">
                    {sauces.map((sup) => optionChip(sup, false))}
                  </div>
                </div>
              )}
              {extras.length > 0 && (
                <div>
                  <p className="text-[11px] font-black text-gray-500 uppercase tracking-widest mb-2.5">✨ Extras</p>
                  <div className="flex flex-wrap gap-2">
                    {extras.map((sup) => optionChip(sup, true))}
                  </div>
                </div>
              )}
            </div>

            {/* Quantity + total + confirm */}
            <div className="flex items-center justify-between border-t pt-4 gap-3">
              <div className="flex items-center gap-1 bg-gray-50 border rounded-xl p-1">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="p-2 rounded-lg hover:bg-white transition-colors"
                  aria-label="Réduire la quantité"
                >
                  <Minus size={14} />
                </button>
                <span className="w-8 text-center font-black text-[#1A1A1A]">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => q + 1)}
                  className="p-2 rounded-lg hover:bg-white transition-colors"
                  aria-label="Augmenter la quantité"
                >
                  <Plus size={14} />
                </button>
              </div>
              <button
                onClick={handleConfirm}
                className="flex-1 flex items-center justify-center gap-2 bg-[#F5A800] hover:bg-[#FF6B00] text-black font-black py-3 rounded-xl transition-all text-sm hover:scale-[1.02] active:scale-[0.98]"
              >
                <Plus size={16} />
                Ajouter — {modalTotal.toFixed(2)} DT
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
