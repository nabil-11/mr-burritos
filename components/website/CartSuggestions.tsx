'use client'

import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useCart, type CartItem } from '@/contexts/CartContext'
import { useMenuExtras } from '@/hooks/useMenuExtras'
import { formatDT } from '@/lib/format'
import type { ResolvedSuggestion } from '@/lib/menuExtras'

type AddItem = (item: Omit<CartItem, 'id'>) => void

/** Une suggestion entre au panier comme ses produits : un de chaque, à leur prix de la carte. */
export function addSuggestion(addItem: AddItem, s: ResolvedSuggestion, quantity = 1) {
  for (const p of s.products) {
    addItem({
      productId: p._id,
      name: { fr: p.name.fr, ar: p.name.ar ?? '' },
      price: p.price,
      image: p.image,
      quantity,
      selectedSupplements: [],
      notes: '',
    })
  }
}

/**
 * « Une boisson avec ça ? » — sous le panier, quelques ajouts d'un geste. Ne
 * propose jamais ce que le panier contient déjà ; le titre change dès qu'il y
 * a une boisson. Rien ne s'affiche tant que la carte n'a pas répondu.
 */
export default function CartSuggestions({ active = true }: { active?: boolean }) {
  const extras = useMenuExtras(active)
  const { items, addItem } = useCart()
  if (!extras || items.length === 0) return null

  const inCart = new Set(items.map((i) => i.productId))
  const hasDrink = items.some((i) => extras.drinkIds.includes(i.productId))
  const offers = extras.cart.filter((s) => !s.products.some((p) => inCart.has(p._id)))
  if (offers.length === 0) return null

  return (
    <section aria-label="Suggestions" className="rounded-2xl border border-dashed border-border p-3">
      <p className="text-sm font-black text-foreground">{hasDrink ? 'Il manque quelque chose ?' : 'Une boisson avec ça ?'}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {offers.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => {
              addSuggestion(addItem, s)
              toast.success(`${s.label} ajouté ✓`)
            }}
            className="min-h-11 inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3.5 text-sm font-bold text-foreground hover:border-[#F5A800] transition-colors"
          >
            <Plus size={14} className="text-brand" strokeWidth={3} />
            {s.label}
            <span className="text-xs font-black text-brand tabular-nums">{formatDT(s.price, { sign: true })}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
