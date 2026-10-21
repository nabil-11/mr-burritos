/**
 * The online-ordering discount, and the promo codes that come on top of it.
 *
 * It applies to orders placed on the website only — the counter and the kiosk
 * charge full price, which is the whole point of the incentive. Anything that
 * builds a website order must go through `applyWebDiscounts` so the figure
 * shown to the customer and the figure stored on the order can never drift
 * apart.
 *
 * No server imports: the cart computes with the very function the order route
 * applies. Whether a code exists, is still valid and has uses left is the
 * server's call (lib/promoCodes); what it is worth once it is, is decided here.
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

/** What a customer may know about a code once the server has accepted it. */
export interface PromoTerms {
  code: string
  /** "Offre Ramadan" — shown under the applied code. */
  description: string
  kind: 'percent' | 'fixed'
  /** A percentage (1–100) or dinars, according to `kind`. */
  value: number
  /** Food total the code needs before it applies; 0 for none. */
  minSubtotal: number
  /** Comes on top of the online promo instead of replacing it. */
  stackable: boolean
  /** Last instant it is valid, ISO. */
  expiresAt: string
}

/**
 * Why a valid code took nothing off:
 *  - `below-minimum`: the basket has not reached `minSubtotal`;
 *  - `not-better`: the code does not stack and the online promo is worth more,
 *    so the customer keeps the online promo — never less than without a code.
 */
export type PromoStatus = 'applied' | 'below-minimum' | 'not-better'

export interface WebDiscounts {
  discount: AppliedPromo
  total: number
  /** The code's own share of `discount.amount`, when it took something off. */
  promo: { code: string; amount: number } | null
  promoStatus: PromoStatus | null
}

export const promoBadge = (t: Pick<PromoTerms, 'kind' | 'value'>) =>
  t.kind === 'percent' ? `−${t.value}%` : `−${t.value.toFixed(2)} DT`

/** The code's worth on a base, never more than the base itself. */
const codeValue = (t: PromoTerms, base: number) =>
  round2(Math.min(base, t.kind === 'percent' ? (base * t.value) / 100 : t.value))

export function applyWebDiscounts(subtotal: number, terms?: PromoTerms | null): WebDiscounts {
  const web = applyWebPromo(subtotal)
  const without = (promoStatus: PromoStatus | null): WebDiscounts => ({ ...web, promo: null, promoStatus })
  if (!terms) return without(null)
  if (subtotal < terms.minSubtotal) return without('below-minimum')

  const tag = `code ${terms.code}`
  if (terms.stackable) {
    // On top: the code counts from what the online promo left.
    const amount = codeValue(terms, round2(subtotal - web.discount.amount))
    if (amount <= 0) return without('not-better')
    const total = round2(web.discount.amount + amount)
    return {
      discount: { label: `${WEB_PROMO.label} + ${tag}`, rate: 0, amount: total },
      total: round2(subtotal - total),
      promo: { code: terms.code, amount },
      promoStatus: 'applied',
    }
  }

  const amount = codeValue(terms, subtotal)
  if (amount <= web.discount.amount) return without('not-better')
  return {
    discount: {
      label: `Code promo ${terms.code}`,
      rate: terms.kind === 'percent' ? terms.value / 100 : 0,
      amount,
    },
    total: round2(subtotal - amount),
    promo: { code: terms.code, amount },
    promoStatus: 'applied',
  }
}

/** Codes are typed by customers: case, spaces and stray symbols do not count. */
export const normalizePromoCode = (raw: unknown) =>
  String(raw ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, 30)
