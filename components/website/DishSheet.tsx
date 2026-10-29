'use client'

import { useMemo, useState } from 'react'
import { Check, Minus, Plus, ShoppingBag, X } from 'lucide-react'
import { configuredPrice, groupSupplements } from '@/lib/supplements'
import type { BuilderCategory, BuilderPick, BuilderProduct, BuilderSupplement } from './ProductBuilder'
import Photo from './Photo'
import ShareButton from './ShareButton'
import { formatDT } from '@/lib/format'

/** "mini burrito  bowl  " → "Mini burrito bowl": names are typed by hand in the backoffice. */
export const dishName = (p: BuilderProduct) => {
  const n = p.name.fr.replace(/\s+/g, ' ').trim()
  return n.charAt(0).toUpperCase() + n.slice(1)
}

/** Whether a dish can go to the basket as is, or has choices to make first. */
export const hasChoices = (p: BuilderProduct) => {
  const g = groupSupplements(p.supplements)
  return g.sauces.length + g.extras.length > 0
}

function Chips({
  options,
  picked,
  onToggle,
}: {
  options: BuilderSupplement[]
  picked: BuilderSupplement[]
  onToggle: (s: BuilderSupplement) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((s) => {
        const on = picked.some((x) => x._id === s._id)
        return (
          <button
            key={s._id}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(s)}
            className={`min-h-11 flex items-center gap-1.5 px-3.5 rounded-full border-2 text-sm font-semibold transition-colors ${
              on
                ? 'bg-[#F5A800] border-[#F5A800] text-black'
                : 'border-border text-foreground/85 hover:border-[#F5A800]/60 bg-background'
            }`}
          >
            {on && <Check size={13} />} {s.name.fr.trim()}
            {s.price > 0 && (
              <span className={`font-black text-xs ${on ? 'text-black/70' : 'text-brand'}`}>{formatDT(s.price, { sign: true })}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/**
 * One dish, on one screen: its photo full size, what is in it, the sauces and
 * extras it takes, how many, and the button with the price on it. Everything
 * the old four-step flow asked for a canette or a burger, without the steps.
 */
export default function DishSheet({
  product,
  category,
  onAdd,
  onClose,
  closedUntil = null,
}: {
  product: BuilderProduct
  category: BuilderCategory
  onAdd: (pick: BuilderPick) => void
  onClose: () => void
  /** Restaurant fermé : l'heure d'ouverture, pour dire quand la commande partira. */
  closedUntil?: string | null
}) {
  const groups = useMemo(() => groupSupplements(product.supplements), [product])
  const [sauces, setSauces] = useState<BuilderSupplement[]>([])
  const [extras, setExtras] = useState<BuilderSupplement[]>([])
  const [quantity, setQuantity] = useState(1)

  const toggle = (list: BuilderSupplement[], set: (v: BuilderSupplement[]) => void) => (s: BuilderSupplement) =>
    set(list.some((x) => x._id === s._id) ? list.filter((x) => x._id !== s._id) : [...list, s])

  const selected = [...sauces, ...extras]
  const total = configuredPrice(product.price, selected) * quantity
  const name = dishName(product)
  const freeSauces = groups.sauces.every((s) => s.price === 0)

  const confirm = () => {
    onAdd({ product, supplements: selected, quantity, label: name })
    onClose()
  }

  return (
    <div className="h-full flex flex-col sm:grid sm:grid-cols-[auto_minmax(0,1fr)]">
      {/* The photo, square as it was shot — no crop, no shadow over the food. */}
      <div className="relative h-full aspect-square max-w-[55vw] bg-muted max-sm:hidden">
        {product.image ? (
          <Photo src={product.image} alt={name} fill sizes="560px" className="object-cover" preload />
        ) : (
          <span className="absolute inset-0 grid place-items-center text-7xl">{category.emoji}</span>
        )}
      </div>

      <div className="relative flex flex-col min-h-0 flex-1">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="absolute top-3 right-3 z-10 w-11 h-11 rounded-full grid place-items-center bg-black/55 text-white backdrop-blur-md hover:bg-black/75 transition-colors"
        >
          <X size={18} />
        </button>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {/* On a phone the photo scrolls away with the options, so they get the room. */}
          <div className="relative aspect-square bg-muted sm:hidden">
            {product.image ? (
              <Photo src={product.image} alt={name} fill sizes="100vw" className="object-cover" preload />
            ) : (
              <span className="absolute inset-0 grid place-items-center text-7xl">{category.emoji}</span>
            )}
          </div>

          <div className="p-5 sm:p-7 space-y-6">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brand">
                {category.emoji} {category.name.fr}
              </p>
              <div className="flex items-start justify-between gap-3 mt-1.5 sm:pr-10">
                <h3 className="font-display text-3xl sm:text-4xl leading-[1.05]">{name}</h3>
                <ShareButton
                  title={`${name} — Mr. Burritos`}
                  description={`${product.description.fr || category.name.fr} · ${formatDT(product.price)}`}
                  image={product.image}
                  url={`/#menu-${category.slug}`}
                  className="shrink-0 w-11 h-11 rounded-full grid place-items-center border border-border text-muted-foreground hover:text-brand hover:border-[#F5A800]/50 transition-colors"
                />
              </div>
              <p className="mt-2 text-xl font-black text-brand tabular-nums">
                {formatDT(product.price)}
                {product.compareAtPrice && product.compareAtPrice > product.price ? (
                  <>
                    {' '}
                    <s className="text-sm font-bold text-muted-foreground">{formatDT(product.compareAtPrice)}</s>
                    <span className="ml-2 text-xs font-black text-emerald-700 dark:text-emerald-400">
                      Économisez {formatDT(product.compareAtPrice - product.price)}
                    </span>
                  </>
                ) : null}
              </p>
              {product.description.fr && (
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{product.description.fr}</p>
              )}
            </div>

            {groups.sauces.length > 0 && (
              <section>
                <div className="flex items-baseline justify-between gap-3 mb-3">
                  <h4 className="font-black text-sm">Sauces</h4>
                  <span className="text-xs font-bold text-muted-foreground">
                    {freeSauces ? 'Offertes · autant que vous voulez' : 'Au choix'}
                  </span>
                </div>
                <Chips options={groups.sauces} picked={sauces} onToggle={toggle(sauces, setSauces)} />
              </section>
            )}

            {groups.extras.length > 0 && (
              <section>
                <div className="flex items-baseline justify-between gap-3 mb-3">
                  <h4 className="font-black text-sm">Un petit extra ?</h4>
                  <span className="text-xs font-bold text-muted-foreground">Optionnel</span>
                </div>
                <Chips options={groups.extras} picked={extras} onToggle={toggle(extras, setExtras)} />
              </section>
            )}
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-3 border-t border-border bg-muted/40 px-5 sm:px-7 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-1 bg-background border border-border rounded-xl p-1">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              className="w-11 h-11 grid place-items-center rounded-lg hover:bg-muted disabled:opacity-30 transition-colors"
              aria-label="Réduire la quantité"
            >
              <Minus size={16} />
            </button>
            <span className="w-7 text-center font-black tabular-nums">{quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.min(99, q + 1))}
              className="w-11 h-11 grid place-items-center rounded-lg hover:bg-muted transition-colors"
              aria-label="Augmenter la quantité"
            >
              <Plus size={16} />
            </button>
          </div>
          <button
            type="button"
            onClick={confirm}
            className="flex-1 flex items-center justify-center gap-2 bg-[#F5A800] hover:bg-[#FF6B00] text-black font-black px-5 py-3.5 rounded-xl transition-colors text-sm active:scale-[0.98]"
          >
            <ShoppingBag size={16} />
            {closedUntil ? (
              <span>Ajouter au panier · envoi dès {closedUntil}</span>
            ) : (
              <span className="tabular-nums">Ajouter · {formatDT(total)}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
