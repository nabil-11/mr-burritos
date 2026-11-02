/**
 * Supplement grouping + selection rules shared by every ordering surface
 * (website, kiosk, backoffice).
 *
 * Sizes are exclusive: a product offering M / XL / XXL always carries exactly
 * one size, unlike sauces and extras which are free multi-select toggles.
 *
 * Viandes are counted: the chosen size decides how many the customer picks
 * (M 1, XL 2, XXL 3) and the same viande may be taken more than once — a
 * "double escalope" XL is two entries, not one.
 */

export interface SupplementLike {
  _id: string
  name: { fr: string }
  price: number
  type?: string
  image?: string
  meatCount?: number
}

/** Split a product's supplements into the four display groups. */
export function groupSupplements<T extends SupplementLike>(list: T[] | undefined) {
  const all = list ?? []
  return {
    sauces: all.filter((s) => s.type === 'sauce'),
    // Cheapest first, so M (incluse) → XL → XXL, quel que soit l'écart de prix.
    sizes: all.filter((s) => s.type === 'size').sort((a, b) => a.price - b.price),
    viandes: all.filter((s) => s.type === 'viande'),
    extras: all.filter((s) => s.type === 'extra'),
  }
}

/** The size pre-selected when the customer opens a product: the base one. */
export function defaultSizeSelection<T extends SupplementLike>(sizes: T[]): T[] {
  return sizes.length > 0 ? [sizes[0]] : []
}

/**
 * Toggle a supplement in a selection. Sauces and extras flip on/off; picking a
 * size swaps out whichever size was selected and can never leave the product
 * sizeless.
 */
export function toggleSupplement<T extends SupplementLike>(selected: T[], sup: T): T[] {
  if (sup.type === 'size') {
    return [...selected.filter((s) => s.type !== 'size'), sup]
  }
  return selected.find((s) => s._id === sup._id)
    ? selected.filter((s) => s._id !== sup._id)
    : [...selected, sup]
}

/** How many viandes the given size entitles you to. Defaults to one. */
export function meatQuotaFor<T extends SupplementLike>(size: T | undefined): number {
  return size?.meatCount ?? 1
}

/** A supplement as stored on an order item (names may be fr-only or ar-only). */
export interface OrderSupplementLike {
  name?: { fr?: string; ar?: string }
  price?: number
}

export interface SupplementPortions {
  name: string
  /** Price of one portion. */
  price: number
  count: number
  /** Price of the whole group (price x count). */
  total: number
}

/**
 * Collapse the repeated portions of one order item for a printed ticket: the
 * till posts a double or triple extra once per portion, and three identical
 * rows are easy to misread in a rush. Same name and same price group together,
 * in first-appearance order; the same name at another price stays separate.
 * Display only: pricing keeps summing the raw list. Unnamed entries are
 * skipped, as the kitchen ticket always did.
 */
export function collapseOrderSupplements(list: OrderSupplementLike[] | undefined): SupplementPortions[] {
  const groups = new Map<string, SupplementPortions>()
  for (const s of list ?? []) {
    const name = s?.name?.fr || s?.name?.ar
    if (!name) continue
    const n = Number(s.price)
    const price = Number.isFinite(n) ? n : 0
    const key = `${price}\u0000${name}`
    const g = groups.get(key)
    if (g) {
      g.count += 1
      g.total += price
    } else {
      groups.set(key, { name, price, count: 1, total: price })
    }
  }
  return [...groups.values()]
}

/** "Oeuf" for one portion, "2x Oeuf" for several (plain ASCII x, like x${qty}). */
export function supplementPortionsLabel(g: SupplementPortions): string {
  return g.count > 1 ? `${g.count}x ${g.name}` : g.name
}

/** Running total for a product configured in the builder. */
export function configuredPrice<T extends SupplementLike>(basePrice: number, selected: T[]): number {
  return basePrice + selected.reduce((sum, s) => sum + s.price, 0)
}
