'use client'

import Image from 'next/image'
import { useState } from 'react'
import { useCart, CartSupplement } from '@/contexts/CartContext'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'

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

  const toggleSupplement = (sup: CartSupplement) => {
    setSelected((prev) =>
      prev.find((s) => s._id === sup._id) ? prev.filter((s) => s._id !== sup._id) : [...prev, sup]
    )
  }

  const handleAdd = () => {
    addItem({
      productId: product._id,
      name: product.name,
      price: product.price,
      image: product.image,
      quantity: 1,
      selectedSupplements: selected,
      notes: '',
    })
    setSelected([])
    toast.success(`${product.name.ar} أضيف للسلة`)
  }

  return (
    <div className="bg-white rounded-xl border shadow-sm overflow-hidden flex flex-col">
      {product.image ? (
        <div className="relative h-40 w-full bg-gray-100">
          <Image src={product.image} alt={product.name.ar} fill className="object-cover" />
        </div>
      ) : (
        <div className="h-40 w-full bg-[#1A1A1A] flex items-center justify-center">
          <span className="text-[#F5A800] text-4xl">🌯</span>
        </div>
      )}
      <div className="p-3 flex-1 flex flex-col gap-2">
        <div>
          <p className="font-bold text-sm">{product.name.ar}</p>
          <p className="text-xs text-gray-400">{product.name.fr}</p>
          {product.description?.ar && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{product.description.ar}</p>
          )}
        </div>
        {product.supplements?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {product.supplements.map((sup) => (
              <button
                key={sup._id}
                onClick={() => toggleSupplement(sup)}
                className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                  selected.find((s) => s._id === sup._id)
                    ? 'bg-[#F5A800] border-[#F5A800] text-black'
                    : 'border-gray-200 text-gray-600 hover:border-[#F5A800]'
                }`}
              >
                {sup.name.ar} {sup.price > 0 && `+${sup.price}DT`}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between mt-auto pt-2 border-t">
          <span className="font-bold text-[#F5A800]">{product.price.toFixed(2)} DT</span>
          <Button size="sm" onClick={handleAdd} className="bg-[#1A1A1A] hover:bg-[#F5A800] text-white hover:text-black">
            <Plus size={14} className="ml-1" /> إضافة
          </Button>
        </div>
      </div>
    </div>
  )
}
