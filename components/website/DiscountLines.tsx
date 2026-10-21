import { BadgePercent, Ticket } from 'lucide-react'
import { WEB_PROMO, promoBadge, type PromoTerms, type WebDiscounts } from '@/lib/promo'

/**
 * The reductions under a basket's subtotal: the online promo and the promo
 * code, each on its own line, so the customer sees what the code added — or
 * that it replaced the online promo, when it does not stack.
 */
export default function DiscountLines({ applied, terms }: { applied: WebDiscounts; terms: PromoTerms | null }) {
  const codeAmount = applied.promo?.amount ?? 0
  const webAmount = Math.round((applied.discount.amount - codeAmount) * 100) / 100
  return (
    <>
      {webAmount > 0 && (
        <div className="flex justify-between font-semibold text-emerald-600 dark:text-emerald-400">
          <span className="flex items-center gap-1.5">
            <BadgePercent size={14} /> {WEB_PROMO.label} ({WEB_PROMO.badge})
          </span>
          <span className="tabular-nums">− {webAmount.toFixed(2)} DT</span>
        </div>
      )}
      {applied.promo && terms && (
        <div className="flex justify-between font-semibold text-emerald-600 dark:text-emerald-400">
          <span className="flex items-center gap-1.5">
            <Ticket size={14} /> Code {applied.promo.code} ({promoBadge(terms)})
          </span>
          <span className="tabular-nums">− {codeAmount.toFixed(2)} DT</span>
        </div>
      )}
    </>
  )
}
