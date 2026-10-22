'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ArrowRight, Plus, Sparkles } from 'lucide-react'
import { useCart } from '@/contexts/CartContext'
import { configuredPrice, groupSupplements } from '@/lib/supplements'
import ProductBuilder, { BuilderCategory, BuilderPick, BuilderProduct, categoryFrom, shortSize } from './ProductBuilder'
import Diaporama from './Diaporama'
import DishSheet, { dishName, hasChoices } from './DishSheet'
import MenuSheet from './MenuSheet'
import Photo from './Photo'
import ShareButton from './ShareButton'

/** Navbar (64px) plus the sticky chip row: where a section's top comes to rest. */
const STICKY_OFFSET = 128

/** "#menu-tacos" → "tacos". */
const slugFromHash = (hash: string) => /^#menu-([\w-]+)$/.exec(hash)?.[1] ?? null

type Sheet =
  | { kind: 'composer'; category: BuilderCategory; nonce: number }
  | { kind: 'dish'; category: BuilderCategory; product: BuilderProduct; nonce: number }

/**
 * The whole menu on one scroll, the way a delivery app shows it: every dish
 * with its photo and price is on the page, and the chip row under the navbar
 * follows the section being read and jumps to any other.
 *
 * Tacos and burritos lead, as the cards that open the composer; everything
 * else is a dish card. Either opens in a sheet over the menu, so closing it
 * leaves the customer where they were. A dish with nothing to choose goes
 * straight to the basket from its "+".
 *
 * Shared links keep working: "/#menu-tacos" opens the composer, "/#menu-burgers"
 * scrolls to the burgers.
 */
export default function WebsiteMenu({ categories }: { categories: BuilderCategory[] }) {
  const { items, addItem, setDrawerOpen } = useCart()
  const [sheet, setSheet] = useState<Sheet | null>(null)
  // Kept apart from `sheet` so the content stays drawn while the sheet slides out.
  const [sheetOpen, setSheetOpen] = useState(false)
  const [active, setActive] = useState<string | null>(categories[0]?.slug ?? null)
  const chipsRef = useRef<HTMLElement>(null)
  const nonce = useRef(0)

  const featured = categories.filter((c) => c.base)
  const others = categories.filter((c) => !c.base)

  /** How many of each product are already in the basket, for the card badges. */
  const inCart = useMemo(() => {
    const m = new Map<string, number>()
    for (const i of items) m.set(i.productId, (m.get(i.productId) ?? 0) + i.quantity)
    return m
  }, [items])

  const add = useCallback(
    (pick: BuilderPick) => {
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
    },
    [addItem, setDrawerOpen]
  )

  const openComposer = useCallback((category: BuilderCategory) => {
    setSheet({ kind: 'composer', category, nonce: ++nonce.current })
    setSheetOpen(true)
  }, [])

  const openDish = (category: BuilderCategory, product: BuilderProduct) => {
    setSheet({ kind: 'dish', category, product, nonce: ++nonce.current })
    setSheetOpen(true)
  }

  const quickAdd = (category: BuilderCategory, product: BuilderProduct) => {
    if (hasChoices(product)) openDish(category, product)
    else add({ product, supplements: [], quantity: 1, label: dishName(product) })
  }

  const scrollToSection = useCallback((slug: string) => {
    const el = document.getElementById(`menu-${slug}`)
    if (!el) return
    setActive(slug)
    window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - STICKY_OFFSET), behavior: 'smooth' })
  }, [])

  // Deep links: on arrival and whenever a "#menu-…" link is followed. The hash
  // is cleared once read, so the same link works a second time.
  useEffect(() => {
    const read = () => {
      const slug = slugFromHash(window.location.hash)
      const category = slug ? categories.find((c) => c.slug === slug) : undefined
      if (!category) return
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
      scrollToSection(category.slug)
      if (category.base) openComposer(category)
    }
    const first = setTimeout(read, 0)
    window.addEventListener('hashchange', read)
    return () => {
      clearTimeout(first)
      window.removeEventListener('hashchange', read)
    }
  }, [categories, openComposer, scrollToSection])

  // Scroll-spy: the active chip is the last section whose top has passed under
  // the chip row. Side-by-side cards share a top; the first of them wins.
  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      let best: string | null = null
      let bestTop = -Infinity
      for (const el of document.querySelectorAll<HTMLElement>('[data-menu-section]')) {
        const top = el.getBoundingClientRect().top
        if (top <= STICKY_OFFSET + 48 && top > bestTop + 1) {
          best = el.dataset.menuSection ?? null
          bestTop = top
        }
      }
      if (best) setActive(best)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  // Keep the active chip in view. The row is scrolled directly: scrollIntoView
  // would fight the page's own smooth scroll in Chrome.
  useEffect(() => {
    const row = chipsRef.current
    const chip = row?.querySelector<HTMLElement>(`[data-slug="${active}"]`)
    if (!row || !chip) return
    row.scrollTo({ left: chip.offsetLeft - (row.clientWidth - chip.offsetWidth) / 2, behavior: 'smooth' })
  }, [active])

  const closeSheet = () => setSheetOpen(false)

  return (
    <div>
      <div className="sticky top-16 z-30 -mx-4 px-4 py-2.5 mb-6 bg-background/90 backdrop-blur-md border-b border-border/60">
        <nav ref={chipsRef} aria-label="Catégories du menu" className="relative flex gap-2 overflow-x-auto scrollbar-hide">
          {categories.map((c) => {
            const on = active === c.slug
            return (
              <a
                key={c._id}
                href={`#menu-${c.slug}`}
                data-slug={c.slug}
                aria-current={on ? 'true' : undefined}
                onClick={(e) => {
                  e.preventDefault()
                  scrollToSection(c.slug)
                }}
                className={`shrink-0 flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                  on ? 'bg-foreground text-background' : 'bg-card border border-border text-foreground hover:border-[#F5A800]'
                }`}
              >
                <span aria-hidden>{c.emoji}</span>
                {c.name.fr}
              </a>
            )
          })}
        </nav>
      </div>

      {featured.length > 0 && (
        <div className="grid gap-4 sm:gap-5 sm:grid-cols-2">
          {featured.map((cat) => (
            <ComposerCard key={cat._id} category={cat} count={inCart.get(cat.base!._id) ?? 0} onOpen={() => openComposer(cat)} />
          ))}
        </div>
      )}

      {others.map((cat) => (
        <section
          key={cat._id}
          id={`menu-${cat.slug}`}
          data-menu-section={cat.slug}
          className="scroll-mt-32 pt-12 first:pt-0"
          aria-labelledby={`menu-title-${cat.slug}`}
        >
          <header className="flex items-end justify-between gap-3 mb-4">
            <div>
              <h3 id={`menu-title-${cat.slug}`} className="font-display text-3xl sm:text-4xl text-foreground leading-none">
                <span aria-hidden className="mr-2">{cat.emoji}</span>
                {cat.name.fr}
              </h3>
              <p className="text-sm text-muted-foreground font-semibold mt-2">
                {cat.products.length} choix · dès <span className="text-foreground">{categoryFrom(cat).toFixed(2)} DT</span>
              </p>
            </div>
          </header>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {cat.products.map((p) => (
              <DishCard
                key={p._id}
                product={p}
                emoji={cat.emoji}
                count={inCart.get(p._id) ?? 0}
                onOpen={() => openDish(cat, p)}
                onQuickAdd={() => quickAdd(cat, p)}
              />
            ))}
          </div>
        </section>
      ))}

      <MenuSheet
        open={sheetOpen}
        onClose={closeSheet}
        size={sheet?.kind === 'dish' ? 'photo' : 'tall'}
        title={sheet ? (sheet.kind === 'dish' ? dishName(sheet.product) : `Composer — ${sheet.category.name.fr}`) : 'Menu'}
      >
        {sheet?.kind === 'composer' && (
          <ProductBuilder
            key={sheet.nonce}
            categories={[sheet.category]}
            initialSlug={sheet.category.slug}
            onAdd={add}
            onExit={closeSheet}
            fill
          />
        )}
        {sheet?.kind === 'dish' && (
          <DishSheet key={sheet.nonce} product={sheet.product} category={sheet.category} onAdd={add} onClose={closeSheet} />
        )}
      </MenuSheet>
    </div>
  )
}

const meatWord = (n: number) => (n === 1 ? '1 viande' : `${n} viandes`)

/**
 * A wrap you build: its photos above, untouched by any shadow, and below them
 * what each size costs and holds — the whole choice readable before a tap.
 */
function ComposerCard({ category, count, onOpen }: { category: BuilderCategory; count: number; onOpen: () => void }) {
  const base = category.base!
  const sizes = groupSupplements(base.supplements).sizes
  return (
    <article
      id={`menu-${category.slug}`}
      data-menu-section={category.slug}
      className="scroll-mt-32 group relative flex flex-col rounded-[2rem] overflow-hidden bg-card border border-border shadow-xl shadow-black/10 hover:shadow-2xl transition-shadow duration-300"
    >
      <button type="button" onClick={onOpen} className="flex flex-col flex-1 text-left" aria-label={`Composer ${category.name.fr}`}>
        <div className="relative aspect-[16/10] sm:aspect-[4/3] overflow-hidden bg-muted">
          <Diaporama
            images={category.gallery}
            alt={category.name.fr}
            sizes="(max-width: 640px) 100vw, 560px"
            className="absolute inset-0"
            imageClassName="object-cover group-hover:scale-[1.03] transition-transform duration-700"
            preload
          />
          <span className="absolute top-4 left-4 inline-flex items-center gap-1.5 bg-[#F5A800] text-black text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest shadow-md">
            <Sparkles size={11} /> À composer
          </span>
          {count > 0 && (
            <span className="absolute bottom-4 left-4 rounded-full bg-black/70 backdrop-blur-md text-white text-xs font-black px-3 py-1.5">
              {count} dans le panier
            </span>
          )}
        </div>

        <div className="flex flex-col flex-1 p-5 sm:p-6">
          <h3 className="font-display text-4xl sm:text-5xl text-foreground leading-none flex items-center gap-2">
            {category.name.fr} <span className="text-3xl">{category.emoji}</span>
          </h3>
          {base.description.fr && (
            <p className="text-muted-foreground text-sm mt-2.5 line-clamp-2">{base.description.fr}</p>
          )}

          {sizes.length > 0 && (
            <ul className="mt-4 grid grid-cols-3 gap-2" aria-label="Tailles et prix">
              {sizes.map((s) => (
                <li key={s._id} className="rounded-2xl border border-border bg-background/60 px-2 py-2.5 text-center">
                  <span className="block font-black text-lg text-foreground leading-none">{shortSize(s.name.fr)}</span>
                  <span className="block text-[10px] font-bold uppercase tracking-wide text-muted-foreground mt-1">
                    {meatWord(s.meatCount ?? 1)}
                  </span>
                  <span className="block text-sm font-black text-[#F5A800] tabular-nums mt-1">
                    {configuredPrice(base.price, [s]).toFixed(2).replace(/\.00$/, '')} DT
                  </span>
                </li>
              ))}
            </ul>
          )}

          <span className="mt-5 sm:mt-auto sm:pt-5 inline-flex items-center justify-center gap-2 bg-[#F5A800] group-hover:bg-[#FF6B00] text-black font-black px-6 py-3.5 rounded-2xl transition-colors">
            Composer mon {base.name.fr.toLowerCase()}
            <ArrowRight size={17} className="group-hover:translate-x-0.5 transition-transform" />
          </span>
        </div>
      </button>

      <ShareButton
        title={`${category.emoji} ${category.name.fr} — Mr. Burritos`}
        description={base.description.fr}
        image={category.gallery[0]}
        url={`/#menu-${category.slug}`}
        className="absolute top-3.5 right-3.5 z-10 w-9 h-9 rounded-full grid place-items-center bg-black/45 backdrop-blur-md text-white/85 hover:text-[#F5A800] hover:bg-black/65 border border-white/15"
      />
    </article>
  )
}

/**
 * A dish: the photo square as it was shot, so nothing is cropped or darkened,
 * then name, what is in it and the price. The card opens the dish; the "+"
 * puts it straight in the basket when there is nothing to choose.
 */
function DishCard({
  product,
  emoji,
  count,
  onOpen,
  onQuickAdd,
}: {
  product: BuilderProduct
  emoji: string
  count: number
  onOpen: () => void
  onQuickAdd: () => void
}) {
  const name = dishName(product)
  return (
    <div className="group relative flex flex-col rounded-3xl bg-card border border-border overflow-hidden hover:border-[#F5A800]/50 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
      <button type="button" onClick={onOpen} className="flex flex-col flex-1 text-left">
        <div className="relative aspect-square bg-muted overflow-hidden">
          {product.image ? (
            <Photo
              src={product.image}
              alt={name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 280px"
              className="object-cover group-hover:scale-[1.04] transition-transform duration-500"
            />
          ) : (
            <span className="absolute inset-0 grid place-items-center text-5xl">{emoji}</span>
          )}
          {count > 0 && (
            <span className="absolute top-2.5 left-2.5 min-w-7 h-7 px-2 rounded-full bg-[#F5A800] text-black text-xs font-black grid place-items-center shadow-md tabular-nums">
              {count}
            </span>
          )}
        </div>
        <div className="flex flex-col flex-1 p-3 sm:p-4 pb-3.5">
          <h4 className="font-black text-sm sm:text-base text-foreground leading-tight line-clamp-2">{name}</h4>
          {product.description.fr && (
            <p className="text-xs text-muted-foreground mt-1 leading-snug line-clamp-2">{product.description.fr}</p>
          )}
          <p className="mt-auto pt-2 min-h-12 flex items-center pr-11 font-black text-[#F5A800] tabular-nums">{product.price.toFixed(2)} DT</p>
        </div>
      </button>
      <button
        type="button"
        onClick={onQuickAdd}
        aria-label={`Ajouter ${name}`}
        className="absolute bottom-3 right-3 w-10 h-10 rounded-full grid place-items-center bg-foreground text-background hover:bg-[#F5A800] hover:text-black active:scale-90 shadow-md transition-all"
      >
        <Plus size={18} strokeWidth={3} />
      </button>
    </div>
  )
}
