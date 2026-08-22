/**
 * The online-ordering discount.
 *
 * It applies to orders placed on the website only — the counter and the kiosk
 * charge full price, which is the whole point of the incentive. Anything that
 * builds a website order must go through `applyWebPromo` so the figure shown to
 * the customer and the figure stored on the order can never drift apart.
 */

export const WEB_PROMO = {
  rate: 0.15,
  /** Shown on the site and stored on the order, so a receipt explains itself. */
  label: 'Promo commande en ligne',
  badge: '−15%',
}

/** Money is displayed to two decimals, so it must be stored that way too. */
const round2 = (n: number) => Math.round(n * 100) / 100

export interface AppliedPromo {
  label: string
  rate: number
  /** Positive number of dinars taken off. */
  amount: number
}

export function applyWebPromo(subtotal: number): { discount: AppliedPromo; total: number } {
  const amount = round2(subtotal * WEB_PROMO.rate)
  return {
    discount: { label: WEB_PROMO.label, rate: WEB_PROMO.rate, amount },
    total: round2(subtotal - amount),
  }
}
