'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ArrowRight, Flame, Minus, Plus, Sparkles } from 'lucide-react'
import { useCart } from '@/contexts/CartContext'
import { useOpenState } from '@/hooks/useOpenState'
import { configuredPrice, groupSupplements } from '@/lib/supplements'
import { AFTER_ADD_PROMPT, COMPOSER_PILLS } from '@/lib/commerce'
import { formatDT } from '@/lib/format'
import { resolveExtras, resolveSignatures, type ResolvedSuggestion, type Signature } from '@/lib/menuExtras'
import ProductBuilder, {
  BuilderCategory,
  BuilderPick,
  BuilderPreset,
  BuilderProduct,
  categoryFrom,
  shortSize,
} from './ProductBuilder'
import Diaporama from './Diaporama'
import DishSheet, { dishName, hasChoices } from './DishSheet'
import MenuSheet from './MenuSheet'
import Photo from './Photo'
import ShareButton from './ShareButton'
import { addSuggestion } from './CartSuggestions'

/** Navbar (64px) plus the sticky chip row: where a section's top comes to rest. */
const STICKY_OFFSET = 128

/** La hauteur du bandeau « Fermé pour le moment », quand il est là (components/website/ClosedBar). */
const bannerHeight = () =>
  parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--banner-h')) || 0

/** "#menu-tacos" → "tacos". */
const slugFromHash = (hash: string) => /^#menu-([\w-]+)$/.exec(hash)?.[1] ?? null

type Sheet =
  | { kind: 'composer'; category: BuilderCategory; preset?: BuilderPreset; nonce: number }
  | { kind: 'dish'; category: BuilderCategory; product: BuilderProduct; nonce: number }

/**
 * The whole menu on one scroll, the way a delivery app shows it: every dish
 * with its photo and price is on the page, and the chip row under the navbar
 * follows the section being read and jumps to any other.
 *
 * Tacos and burritos lead, as the cards that open the composer — chaque taille
 * de leur tableau ouvre directement sur les viandes, et les tacos signatures
 * s'ajoutent d'un geste. Puis « Les plus commandés », puis tout le reste en
 * cartes. A dish with nothing to choose goes straight to the basket from its
 * "+", qui devient un −1+ dès qu'il est dans le panier.
 *
 * Shared links keep working: "/#menu-tacos" opens the composer, "/#menu-burgers"
 * scrolls to the burgers.
 */
export default function WebsiteMenu({
  categories,
  topSellers = [],
}: {
  categories: BuilderCategory[]
  /** Identifiants des produits les plus commandés, du premier au dernier. */
  topSellers?: string[]
}) {
  const { items, addItem, updateQty, setDrawerOpen } = useCart()
  const openState = useOpenState()
  const closedUntil = openState && !openState.open ? openState.at : null
  const [sheet, setSheet] = useState<Sheet | null>(null)
  // Kept apart from `sheet` so the content stays drawn while the sheet slides out.
  const [sheetOpen, setSheetOpen] = useState(false)
  const [active, setActive] = useState<string | null>(categories[0]?.slug ?? null)
  const chipsRef = useRef<HTMLElement>(null)
  const nonce = useRef(0)

  const featured = categories.filter((c) => c.base)
  const others = categories.filter((c) => !c.base)
  const extras = useMemo(() => resolveExtras(categories), [categories])
  const signatures = useMemo(() => resolveSignatures(categories), [categories])
  const topSet = useMemo(() => new Set(topSellers), [topSellers])

  /** How many of each product are already in the basket, for the card badges. */
  const inCart = useMemo(() => {
    const m = new Map<string, number>()
    for (const i of items) m.set(i.productId, (m.get(i.productId) ?? 0) + i.quantity)
    return m
  }, [items])
  const hasDrink = items.some((i) => extras.drinkIds.includes(i.productId))

  const addExtras = useCallback(
    (s: ResolvedSuggestion, quantity: number) => addSuggestion(addItem, s, quantity),
    [addItem]
  )

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
      // « Une canette avec ça ? » — tant que le panier n'a pas de boisson, et
      // jamais après une boisson.
      const offer = extras.afterAdd
      const isDrink = extras.drinkIds.includes(pick.product._id)
      if (offer && !hasDrink && !isDrink) {
        toast.success(`Ajouté ✓ · ${AFTER_ADD_PROMPT} ${formatDT(offer.price, { sign: true })}`, {
          action: { label: 'Ajouter', onClick: () => addSuggestion(addItem, offer) },
        })
      } else {
        toast.success(`${pick.quantity}× ${pick.label} ajouté au panier`, {
          action: { label: 'Voir le panier', onClick: () => setDrawerOpen(true) },
        })
      }
    },
    [addItem, setDrawerOpen, extras, hasDrink]
  )

  const openComposer = useCallback((category: BuilderCategory, preset?: BuilderPreset) => {
    setSheet({ kind: 'composer', category, preset, nonce: ++nonce.current })
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

  /** −1 : la dernière ligne de ce produit perd une unité (disparaît à zéro). */
  const removeOne = (productId: string) => {
    const line = [...items].reverse().find((i) => i.productId === productId)
    if (line) updateQty(line.id, line.quantity - 1)
  }

  /** +1 d'un produit déjà au panier : la même composition que la dernière fois. */
  const addOneMore = (productId: string) => {
    const line = [...items].reverse().find((i) => i.productId === productId)
    if (line) updateQty(line.id, line.quantity + 1)
  }

  const addSignature = (category: BuilderCategory, sig: Signature) => {
    if (!category.base) return
    add({
      product: category.base,
      supplements: [sig.size, ...sig.meats, ...sig.sauces],
      quantity: 1,
      label: `${sig.name} (${category.base.name.fr} ${shortSize(sig.size.name.fr)})`,
    })
  }

  const scrollToSection = useCallback((slug: string) => {
    const el = document.getElementById(`menu-${slug}`)
    if (!el) return
    setActive(slug)
    window.scrollTo({
      top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - STICKY_OFFSET - bannerHeight()),
      behavior: 'smooth',
    })
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
  // Above the first section, the first chip — not whichever was last.
  useEffect(() => {
    let frame = 0
    const first = categories[0]?.slug ?? null
    const update = () => {
      frame = 0
      let best: string | null = null
      let bestTop = -Infinity
      const line = STICKY_OFFSET + bannerHeight() + 48
      for (const el of document.querySelectorAll<HTMLElement>('[data-menu-section]')) {
        const top = el.getBoundingClientRect().top
        if (top <= line && top > bestTop + 1) {
          best = el.dataset.menuSection ?? null
          bestTop = top
        }
      }
      setActive(best ?? first)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [categories])

  // Keep the active chip in view. The row is scrolled directly: scrollIntoView
  // would fight the page's own smooth scroll in Chrome.
  useEffect(() => {
    const row = chipsRef.current
    const chip = row?.querySelector<HTMLElement>(`[data-slug="${active}"]`)
    if (!row || !chip) return
    row.scrollTo({ left: chip.offsetLeft - (row.clientWidth - chip.offsetWidth) / 2, behavior: 'smooth' })
  }, [active])

  const closeSheet = () => setSheetOpen(false)

  // « Les plus commandés » : les produits de la carte qui existent encore, dans l'ordre des ventes.
  const topCards = useMemo(() => {
    const out: { category: BuilderCategory; product: BuilderProduct }[] = []
    for (const id of topSellers) {
      for (const c of categories) {
        const p = c.base?._id === id ? c.base : c.products.find((x) => x._id === id)
        if (p) {
          out.push({ category: c, product: p })
          break
        }
      }
    }
    return out
  }, [topSellers, categories])

  const stepperFor = (category: BuilderCategory, product: BuilderProduct) => ({
    count: inCart.get(product._id) ?? 0,
    onAdd: () => ((inCart.get(product._id) ?? 0) > 0 ? addOneMore(product._id) : quickAdd(category, product)),
    onRemove: () => removeOne(product._id),
  })

  return (
    <div>
      <div className="sticky top-[calc(4rem+var(--banner-h,0px))] z-30 -mx-4 px-4 py-2 mb-6 bg-background/90 backdrop-blur-md border-b border-border/60">
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
                className={`shrink-0 min-h-11 flex items-center gap-1.5 rounded-full px-4 text-sm font-bold transition-colors ${
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
        <div className="grid gap-4 sm:gap-5 sm:grid-cols-2 items-start">
          {featured.map((cat) => (
            <div key={cat._id} className="space-y-4">
              <ComposerCard
                category={cat}
                count={inCart.get(cat.base!._id) ?? 0}
                onOpen={(preset) => openComposer(cat, preset)}
              />
              {signatures.length > 0 && cat.slug === 'tacos' && (
                <Signatures
                  signatures={signatures}
                  closed={!!closedUntil}
                  onAdd={(sig) => addSignature(cat, sig)}
                  onCustomize={(sig) =>
                    openComposer(cat, {
                      sizeId: sig.size._id,
                      meatIds: sig.meats.map((m) => m._id),
                      sauceIds: sig.sauces.map((s) => s._id),
                    })
                  }
                />
              )}
            </div>
          ))}
        </div>
      )}

      {topCards.length > 0 && (
        <section aria-labelledby="menu-top" className="pt-12">
          <h3 id="menu-top" className="font-display text-3xl sm:text-4xl text-foreground leading-none flex items-center gap-2">
            <Flame size={26} className="text-[#FF6B00]" aria-hidden /> Les plus commandés
          </h3>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {topCards.map(({ category, product }) =>
              category.base?._id === product._id ? (
                <DishCard
                  key={product._id}
                  product={product}
                  emoji={category.emoji}
                  image={category.gallery[0]}
                  top
                  priceFrom
                  {...stepperFor(category, product)}
                  onOpen={() => openComposer(category)}
                  onAdd={() => openComposer(category)}
                />
              ) : (
                <DishCard
                  key={product._id}
                  product={product}
                  emoji={category.emoji}
                  top
                  {...stepperFor(category, product)}
                  onOpen={() => openDish(category, product)}
                />
              )
            )}
          </div>
        </section>
      )}

      {others.map((cat) => (
        <section
          key={cat._id}
          id={`menu-${cat.slug}`}
          data-menu-section={cat.slug}
          className="scroll-mt-32 pt-12"
          aria-labelledby={`menu-title-${cat.slug}`}
        >
          <header className="flex items-end justify-between gap-3 mb-4">
            <div>
              <h3 id={`menu-title-${cat.slug}`} className="font-display text-3xl sm:text-4xl text-foreground leading-none">
                <span aria-hidden className="mr-2">{cat.emoji}</span>
                {cat.name.fr}
              </h3>
              <p className="text-sm text-muted-foreground font-semibold mt-2">
                {cat.products.length} choix · dès <span className="text-foreground">{formatDT(categoryFrom(cat))}</span>
              </p>
            </div>
          </header>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {cat.products.map((p) => (
              <DishCard
                key={p._id}
                product={p}
                emoji={cat.emoji}
                top={topSet.has(p._id)}
                {...stepperFor(cat, p)}
                onOpen={() => openDish(cat, p)}
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
            web
            preset={sheet.preset}
            upsell={extras.upsell}
            onAddExtras={addExtras}
            closedUntil={closedUntil}
          />
        )}
        {sheet?.kind === 'dish' && (
          <DishSheet
            key={sheet.nonce}
            product={sheet.product}
            category={sheet.category}
            onAdd={add}
            onClose={closeSheet}
            closedUntil={closedUntil}
          />
        )}
      </MenuSheet>
    </div>
  )
}

const meatWord = (n: number) => (n === 1 ? '1 viande' : `${n} viandes`)

/**
 * A wrap you build: its photos above, untouched by any shadow, and below them
 * what each size costs and holds. Chaque taille est un bouton : elle ouvre le
 * composeur sur les viandes, la taille déjà choisie. Le grand bouton, lui,
 * ouvre sur la plus petite taille.
 */
function ComposerCard({
  category,
  count,
  onOpen,
}: {
  category: BuilderCategory
  count: number
  onOpen: (preset?: BuilderPreset) => void
}) {
  const base = category.base!
  const sizes = groupSupplements(base.supplements).sizes
  const pill = COMPOSER_PILLS[category.slug]
  return (
    <article
      id={`menu-${category.slug}`}
      data-menu-section={category.slug}
      className="scroll-mt-32 group relative flex flex-col rounded-[2rem] overflow-hidden bg-card border border-border shadow-xl shadow-black/10 hover:shadow-2xl transition-shadow duration-300"
    >
      <button
        type="button"
        onClick={() => onOpen()}
        className="relative block w-full aspect-[16/10] sm:aspect-[4/3] overflow-hidden bg-muted"
        aria-label={`Composer ${category.name.fr}`}
      >
        <Diaporama
          images={category.gallery}
          alt=""
          sizes="(max-width: 640px) 100vw, 560px"
          className="absolute inset-0"
          imageClassName="object-cover group-hover:scale-[1.03] transition-transform duration-700"
        />
        <span className="absolute top-4 left-4 inline-flex items-center gap-1.5 bg-[#F5A800] text-black text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest shadow-md">
          <Sparkles size={11} /> À composer
        </span>
        {count > 0 && (
          <span className="absolute bottom-4 left-4 rounded-full bg-black/70 backdrop-blur-md text-white text-xs font-black px-3 py-1.5">
            {count} dans le panier
          </span>
        )}
      </button>

      <div className="flex flex-col flex-1 p-5 sm:p-6">
        <h3 className="font-display text-4xl sm:text-5xl text-foreground leading-none flex items-center gap-2">
          {category.name.fr} <span className="text-3xl" aria-hidden>{category.emoji}</span>
        </h3>
        {pill && (
          <p className="mt-3 self-start inline-flex items-center rounded-full bg-emerald-600 text-white text-[11px] font-black px-3 py-1">
            {pill}
          </p>
        )}
        {base.description.fr && (
          <p className="text-muted-foreground text-sm mt-2.5 line-clamp-2">{base.description.fr}</p>
        )}

        {sizes.length > 0 && (
          <ul className="mt-4 grid grid-cols-3 gap-2" aria-label="Choisir une taille">
            {sizes.map((s) => (
              <li key={s._id}>
                <button
                  type="button"
                  onClick={() => onOpen({ sizeId: s._id })}
                  aria-label={`${base.name.fr} ${shortSize(s.name.fr)} — ${meatWord(s.meatCount ?? 1)}, ${formatDT(configuredPrice(base.price, [s]))}`}
                  className="w-full min-h-11 rounded-2xl border border-border bg-background/60 px-2 py-2.5 text-center hover:border-[#F5A800] hover:bg-[#F5A800]/10 transition-colors"
                >
                  <span className="block font-black text-lg text-foreground leading-none">{shortSize(s.name.fr)}</span>
                  <span className="block text-[10px] font-bold uppercase tracking-wide text-muted-foreground mt-1">
                    {meatWord(s.meatCount ?? 1)}
                  </span>
                  <span className="block text-sm font-black text-brand tabular-nums mt-1">
                    {formatDT(configuredPrice(base.price, [s])).replace(',00', '')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={() => onOpen()}
          className="mt-5 min-h-12 inline-flex items-center justify-center gap-2 bg-[#F5A800] hover:bg-[#FF6B00] text-black font-black px-6 py-3.5 rounded-2xl transition-colors"
        >
          Composer mon {base.name.fr.toLowerCase()}
          <ArrowRight size={17} />
        </button>
      </div>

      <ShareButton
        title={`${category.emoji} ${category.name.fr} — Mr. Burritos`}
        description={base.description.fr}
        image={category.gallery[0]}
        url={`/#menu-${category.slug}`}
        className="absolute top-3 right-3 z-10 w-11 h-11 rounded-full grid place-items-center bg-black/45 backdrop-blur-md text-white/85 hover:text-[#F5A800] hover:bg-black/65 border border-white/15"
      />
    </article>
  )
}

/**
 * Trois tacos déjà composés, pour qui ne veut pas choisir : un geste et c'est
 * au panier, ou « Personnaliser » pour partir de là dans le composeur.
 */
function Signatures({
  signatures,
  closed,
  onAdd,
  onCustomize,
}: {
  signatures: Signature[]
  closed: boolean
  onAdd: (s: Signature) => void
  onCustomize: (s: Signature) => void
}) {
  return (
    <section aria-labelledby="signatures-title" className="rounded-[1.75rem] border border-border bg-card p-4 sm:p-5">
      <h4 id="signatures-title" className="font-black text-foreground">Nos tacos signatures</h4>
      <ul className="mt-3 divide-y divide-border">
        {signatures.map((s) => (
          <li key={s.name} className="py-3 first:pt-0 last:pb-0 flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-black text-sm text-foreground">{s.name}</p>
              <p className="text-xs text-muted-foreground leading-snug">{s.summary}</p>
              <button
                type="button"
                onClick={() => onCustomize(s)}
                className="min-h-11 -my-2 text-xs font-bold text-brand underline underline-offset-4"
              >
                Personnaliser
              </button>
            </div>
            <button
              type="button"
              onClick={() => onAdd(s)}
              className="shrink-0 min-h-11 inline-flex items-center gap-1.5 rounded-xl bg-[#F5A800] hover:bg-[#FF6B00] text-black px-3.5 text-sm font-black transition-colors"
              aria-label={`Ajouter ${s.name}, ${formatDT(s.price)}${closed ? ' — envoi à l’ouverture' : ''}`}
            >
              <Plus size={15} strokeWidth={3} /> Ajouter · {formatDT(s.price)}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * A dish: the photo square as it was shot, so nothing is cropped or darkened,
 * then name, what is in it and the price. The card opens the dish; the "+"
 * puts it straight in the basket when there is nothing to choose — et devient
 * un −1+ une fois le plat dans le panier.
 */
function DishCard({
  product,
  emoji,
  image,
  count,
  top = false,
  priceFrom = false,
  onOpen,
  onAdd,
  onRemove,
}: {
  product: BuilderProduct
  emoji: string
  /** Une autre photo que celle du produit (la galerie d'un wrap). */
  image?: string
  count: number
  /** Badge « Top vente ». */
  top?: boolean
  /** « dès 11,00 DT » : un wrap dont le prix dépend de la taille. */
  priceFrom?: boolean
  onOpen: () => void
  onAdd: () => void
  onRemove: () => void
}) {
  const name = dishName(product)
  const photo = image || product.image
  const saving =
    product.compareAtPrice && product.compareAtPrice > product.price
      ? Math.round((product.compareAtPrice - product.price) * 100) / 100
      : 0
  return (
    <div className="group relative flex flex-col rounded-3xl bg-card border border-border overflow-hidden hover:border-[#F5A800]/50 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
      <button type="button" onClick={onOpen} className="flex flex-col flex-1 text-left">
        <span className="relative block aspect-square bg-muted overflow-hidden">
          {photo ? (
            <Photo
              src={photo}
              alt={name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 280px"
              className="object-cover group-hover:scale-[1.04] transition-transform duration-500"
            />
          ) : (
            <span className="absolute inset-0 grid place-items-center text-5xl">{emoji}</span>
          )}
          {top && (
            <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-[#FF6B00] text-white text-[10px] font-black uppercase tracking-wide px-2.5 py-1 shadow-md">
              <Flame size={11} /> Top vente
            </span>
          )}
        </span>
        <span className="flex flex-col flex-1 p-3 sm:p-4 pb-3.5">
          <span className="font-black text-sm sm:text-base text-foreground leading-tight line-clamp-2">{name}</span>
          {product.description.fr && (
            <span className="text-xs text-muted-foreground mt-1 leading-snug line-clamp-2">{product.description.fr}</span>
          )}
          <span className={`mt-auto pt-2 min-h-12 flex flex-col justify-center ${count > 0 ? 'pr-0 pb-12' : 'pr-12'}`}>
            <span className="font-black text-brand tabular-nums">
              {priceFrom && <span className="text-xs font-bold text-muted-foreground mr-1">dès</span>}
              {formatDT(product.price)}
              {saving > 0 && (
                <s className="ml-1.5 text-xs font-bold text-muted-foreground">{formatDT(product.compareAtPrice ?? 0)}</s>
              )}
            </span>
            {saving > 0 && (
              <span className="text-[11px] font-black text-emerald-700 dark:text-emerald-400">Économisez {formatDT(saving)}</span>
            )}
          </span>
        </span>
      </button>
      {count > 0 ? (
        <div className="absolute bottom-2.5 inset-x-2.5 flex items-center justify-between rounded-full bg-foreground text-background shadow-md">
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Retirer un ${name}`}
            className="w-11 h-11 grid place-items-center rounded-full hover:bg-[#F5A800] hover:text-black transition-colors"
          >
            <Minus size={17} strokeWidth={3} />
          </button>
          <span className="font-black tabular-nums" aria-live="polite" aria-label={`${count} dans le panier`}>
            {count}
          </span>
          <button
            type="button"
            onClick={onAdd}
            aria-label={`Ajouter un ${name}`}
            className="w-11 h-11 grid place-items-center rounded-full hover:bg-[#F5A800] hover:text-black transition-colors"
          >
            <Plus size={17} strokeWidth={3} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onAdd}
          aria-label={`Ajouter ${name}`}
          className="absolute bottom-3 right-3 w-11 h-11 rounded-full grid place-items-center bg-foreground text-background hover:bg-[#F5A800] hover:text-black active:scale-90 shadow-md transition-all"
        >
          <Plus size={18} strokeWidth={3} />
        </button>
      )}
    </div>
  )
}
