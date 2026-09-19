'use client'

import { toast } from 'sonner'
import { useCart } from '@/contexts/CartContext'
import ProductBuilder, { BuilderCategory, BuilderPick } from './ProductBuilder'

/** Wires the shared builder to the website's persistent cart. */
export default function WebsiteBuilder({ categories }: { categories: BuilderCategory[] }) {
  const { addItem, setDrawerOpen } = useCart()

  const handleAdd = (pick: BuilderPick) => {
    // One line carrying the quantity; the cart merges it with an identical
    // dish already in the basket.
    addItem({
      productId: pick.product._id,
      name: pick.product.name,
      price: pick.product.price,
      image: pick.product.image,
      quantity: pick.quantity,
      selectedSupplements: pick.supplements,
      notes: '',
    })
    toast.success(`${pick.quantity}× ${pick.label} ajouté au panier`, {
      action: { label: 'Voir le panier', onClick: () => setDrawerOpen(true) },
    })
  }

  return <ProductBuilder categories={categories} onAdd={handleAdd} />
}
