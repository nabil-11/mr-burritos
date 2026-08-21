'use client'

import { toast } from 'sonner'
import { useCart } from '@/contexts/CartContext'
import ProductBuilder, { BuilderCategory, BuilderPick } from './ProductBuilder'

/** Wires the shared builder to the website's persistent cart. */
export default function WebsiteBuilder({ categories }: { categories: BuilderCategory[] }) {
  const { addItem } = useCart()

  const handleAdd = (pick: BuilderPick) => {
    for (let i = 0; i < pick.quantity; i++) {
      addItem({
        productId: pick.product._id,
        name: pick.product.name,
        price: pick.product.price,
        image: pick.product.image,
        quantity: 1,
        selectedSupplements: pick.supplements,
        notes: '',
      })
    }
    toast.success(`${pick.quantity}× ${pick.label} ajouté au panier !`)
  }

  return <ProductBuilder categories={categories} onAdd={handleAdd} />
}
