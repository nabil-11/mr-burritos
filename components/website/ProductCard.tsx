'use client'

import Image from 'next/image'
import { useState } from 'react'
import { useCart, CartSupplement } from '@/contexts/CartContext'
import { ShoppingCart, Plus, Check } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'

interface Product {
  _id: string
  name: { ar: string; fr: string }
  description: { ar: string; fr: string }
  price: number
  image: string
  supplements: CartSupplement[]
}

export default function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart()
  const [selected, setSelected] = useState<CartSupplement[]>([])
  const [added, setAdded] = useState(false)

  const sauces = product.supplements?.filter((s) => (s as unknown as { type: string }).type === 'sauce') ?? []
  const extras = product.supplements?.filter((s) => (s as unknown as { type: string }).type !== 'sauce') ?? []

  const toggleSup = (sup: CartSupplement) => {
    setSelected((prev) =>
      prev.find((s) => s._id === sup._id) ? prev.filter((s) => s._id !== sup._id) : [...prev, sup]
    )
  }

  const handleAdd = () => {
    addItem({ productId: product._id, name: product.name, price: product.price, image: product.image, quantity: 1, selectedSupplements: selected, notes: '' })
    setAdded(true)
    toast.success(`${product.name.fr} ajouté au panier !`)
    setTimeout(() => { setAdded(false); setSelected([]) }, 1500)
  }

  const suppTotal = selected.reduce((s, x) => s + x.price, 0)

  return (
    <div className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col">
      {/* Image */}
      <div className="relative h-44 w-full overflow-hidden bg-[#1A1A1A]">
        {product.image ? (
          <Image src={product.image} alt={product.name.fr} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <span className="text-5xl">🌯</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        <div className="absolute bottom-2 right-2">
          <span className="bg-[#F5A800] text-black text-xs font-black px-2.5 py-1 rounded-full shadow">
            {product.price.toFixed(2)} DT
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-3 flex-1 flex flex-col gap-2">
        <div>
          <h3 className="font-bold text-sm text-[#1A1A1A]">{product.name.fr}</h3>
          {product.description?.fr && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">{product.description.fr}</p>
          )}
        </div>

        {/* Sauces */}
        {sauces.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Sauces</p>
            <div className="flex flex-wrap gap-1">
              {sauces.map((sup) => (
                <button key={sup._id} onClick={() => toggleSup(sup)}
                  className={`text-[10px] px-2 py-0.5 rounded-full border font-medium transition-all ${selected.find((s) => s._id === sup._id) ? 'bg-[#F5A800] border-[#F5A800] text-black' : 'border-gray-200 text-gray-500 hover:border-[#F5A800]'}`}>
                  {sup.name.fr}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Extras */}
        {extras.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Extras</p>
            <div className="flex flex-wrap gap-1">
              {extras.map((sup) => (
                <button key={sup._id} onClick={() => toggleSup(sup)}
                  className={`text-[10px] px-2 py-0.5 rounded-full border font-medium transition-all ${selected.find((s) => s._id === sup._id) ? 'bg-[#F5A800] border-[#F5A800] text-black' : 'border-gray-200 text-gray-500 hover:border-[#F5A800]'}`}>
                  {sup.name.fr} {sup.price > 0 && `+${sup.price}DT`}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-50">
          <div>
            <span className="font-black text-[#F5A800] text-base">{(product.price + suppTotal).toFixed(2)} DT</span>
            {suppTotal > 0 && <span className="text-[10px] text-muted-foreground ml-1">+{suppTotal.toFixed(2)} supp.</span>}
          </div>
          <button onClick={handleAdd}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${added ? 'bg-green-500 text-white' : 'bg-[#1A1A1A] hover:bg-[#F5A800] text-white hover:text-black'}`}>
            {added ? <><Check size={13} /> Ajouté</> : <><Plus size={13} /> Ajouter</>}
          </button>
        </div>
      </div>
    </div>
  )
}
