/**
 * Supplement grouping + selection rules shared by every ordering surface
 * (website, kiosk, backoffice).
 *
 * Sizes are exclusive: a product offering M / XL / XXL always carries exactly
 * one size, unlike sauces and extras which are free multi-select toggles.
 */

export interface SupplementLike {
  _id: string
  name: { fr: string }
  price: number
  type?: string
}

/** Split a product's supplements into the three display groups. */
export function groupSupplements<T extends SupplementLike>(list: T[] | undefined) {
  const all = list ?? []
  return {
    sauces: all.filter((s) => s.type === 'sauce'),
    // Cheapest first, so M (0 DT) → XL (+4.5) → XXL (+8).
    sizes: all.filter((s) => s.type === 'size').sort((a, b) => a.price - b.price),
    extras: all.filter((s) => s.type !== 'sauce' && s.type !== 'size'),
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
