'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useCart } from '@/contexts/CartContext'
import ProductBuilder, { BuilderCategory, BuilderPick, categoryFrom } from './ProductBuilder'

/** 11 → "11", 6.5 → "6.5": a chip has no room for trailing zeros. */
const shortPrice = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))

/** "#menu-tacos" → "tacos". */
const slugFromHash = (hash: string) => /^#menu-([\w-]+)$/.exec(hash)?.[1] ?? null

/**
 * The menu on the home page: a row of category chips that stays under the
 * navbar while the customer scrolls the menu, and the shared builder below it.
 *
 * A chip, a hero button or a shared link ("/#menu-burritos") opens a category
 * directly — the builder is remounted on it rather than driven step by step.
 * Wires the builder to the website's persistent cart.
 */
export default function WebsiteBuilder({ categories }: { categories: BuilderCategory[] }) {
  const { addItem, setDrawerOpen } = useCart()
  // `nonce` forces a fresh builder even when the same chip is tapped twice.
  const [target, setTarget] = useState<{ slug: string | null; nonce: number }>({ slug: null, nonce: 0 })
  const [active, setActive] = useState<string | null>(null)
  const sectionRef = useRef<HTMLDivElement>(null)
  const chipsRef = useRef<HTMLDivElement>(null)

  const open = useCallback(
    (slug: string | null) => {
      if (slug && !categories.some((c) => c.slug === slug)) return
      setTarget((t) => ({ slug, nonce: t.nonce + 1 }))
      setActive(slug)
      const el = sectionRef.current
      if (el) window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - 76), behavior: 'smooth' })
    },
    [categories]
  )

  // Deep links: on arrival and whenever a "#menu-…" link is followed. The hash
  // is cleared once read, so the same link works a second time.
  useEffect(() => {
    const read = () => {
      const slug = slugFromHash(window.location.hash)
      if (!slug) return
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
      open(slug)
    }
    const first = setTimeout(read, 0)
    window.addEventListener('hashchange', read)
    return () => {
      clearTimeout(first)
      window.removeEventListener('hashchange', read)
    }
  }, [open])

  // Keep the active chip in view in the scrolling row.
  useEffect(() => {
    if (!active) return
    chipsRef.current
      ?.querySelector<HTMLElement>(`[data-slug="${active}"]`)
      ?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
  }, [active])

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

  return (
    <div ref={sectionRef}>
      <div className="sticky top-16 z-30 -mx-4 px-4 py-2.5 mb-4 bg-background/85 backdrop-blur-md border-b border-border/60">
        <div ref={chipsRef} className="flex gap-2 overflow-x-auto scrollbar-hide" role="tablist" aria-label="Catégories du menu">
          <button
            role="tab"
            aria-selected={active === null}
            onClick={() => open(null)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-black transition-colors ${
              active === null ? 'bg-foreground text-background' : 'bg-card border border-border text-foreground hover:border-[#F5A800]'
            }`}
          >
            Tout le menu
          </button>
          {categories.map((c) => {
            const on = active === c.slug
            return (
              <button
                key={c._id}
                role="tab"
                data-slug={c.slug}
                aria-selected={on}
                onClick={() => open(c.slug)}
                className={`shrink-0 flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-bold transition-colors ${
                  on ? 'bg-[#F5A800] text-black' : 'bg-card border border-border text-foreground hover:border-[#F5A800]'
                }`}
              >
                <span aria-hidden>{c.emoji}</span>
                {c.name.fr}
                <span className={`text-[11px] font-black tabular-nums ${on ? 'text-black/60' : 'text-muted-foreground'}`}>
                  {shortPrice(categoryFrom(c))} DT
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <ProductBuilder
        key={target.nonce}
        categories={categories}
        onAdd={handleAdd}
        initialSlug={target.slug ?? undefined}
        onCategoryChange={setActive}
      />
    </div>
  )
}
