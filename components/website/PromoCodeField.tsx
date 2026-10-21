'use client'

import { useState } from 'react'
import { Check, Loader2, Ticket, X } from 'lucide-react'
import { useCart } from '@/contexts/CartContext'
import { WEB_PROMO, normalizePromoCode, promoBadge, type PromoStatus } from '@/lib/promo'

const until = (iso: string) =>
  new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Tunis', day: 'numeric', month: 'long' }).format(new Date(iso))

/**
 * Where the customer types a promo code. The code goes into the cart; the
 * basket's next quote says whether it holds (useCartQuote), and this shows the
 * answer: applied, refused and why, or valid but not doing anything yet.
 */
export default function PromoCodeField({ subtotal, status }: { subtotal: number; status: PromoStatus | null }) {
  const { promo, setPromoCode } = useCart()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')

  const apply = () => {
    const code = normalizePromoCode(draft)
    if (code) setPromoCode(code)
  }
  const remove = () => {
    setPromoCode(null)
    setDraft('')
    setOpen(true)
  }

  // A code the server accepted, or one it is still looking at.
  if (promo && !promo.error) {
    const t = promo.terms
    return (
      <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/8 px-3.5 py-3">
        <div className="flex items-center gap-2">
          {t ? (
            <Check size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <Loader2 size={16} className="animate-spin text-muted-foreground shrink-0" />
          )}
          <p className="flex-1 min-w-0 text-sm font-black text-foreground">
            {promo.code}
            {t && <span className="ml-1.5 text-emerald-700 dark:text-emerald-300">{promoBadge(t)}</span>}
          </p>
          <button
            type="button"
            onClick={remove}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
            aria-label="Retirer le code promo"
          >
            <X size={15} />
          </button>
        </div>
        {t ? (
          <div className="mt-1 pl-6 space-y-0.5 text-[11px] leading-snug">
            {t.description && <p className="font-semibold text-foreground">{t.description}</p>}
            <p className="text-muted-foreground">
              Valable jusqu’au {until(t.expiresAt)}
              {t.minSubtotal > 0 && ` · dès ${t.minSubtotal.toFixed(2)} DT d’achat`}
              {t.stackable ? ` · cumulable avec la promo en ligne` : ''}
            </p>
            {status === 'below-minimum' && (
              <p className="font-bold text-amber-700 dark:text-amber-400">
                Ajoutez {(t.minSubtotal - subtotal).toFixed(2)} DT au panier pour en profiter.
              </p>
            )}
            {status === 'not-better' && (
              <p className="font-bold text-amber-700 dark:text-amber-400">
                Non cumulable : la promo en ligne ({WEB_PROMO.badge}) est plus avantageuse, on vous la garde.
              </p>
            )}
          </div>
        ) : (
          <p className="mt-1 pl-6 text-[11px] text-muted-foreground">Vérification du code…</p>
        )}
      </div>
    )
  }

  if (!open && !promo) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-[#F5A800] transition-colors"
      >
        <Ticket size={14} /> Vous avez un code promo ?
      </button>
    )
  }

  const value = promo?.error && !draft ? promo.code : draft
  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => {
            setDraft(e.target.value.toUpperCase())
            setOpen(true)
            if (promo?.error) setPromoCode(null)
          }}
          onKeyDown={(e) => {
            // Inside the checkout form, Entrée would place the order.
            if (e.key === 'Enter') {
              e.preventDefault()
              apply()
            }
          }}
          autoFocus={!promo}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          placeholder="CODE PROMO"
          maxLength={30}
          aria-label="Code promo"
          aria-invalid={!!promo?.error}
          className={`flex-1 min-w-0 rounded-xl border bg-background px-3.5 py-2.5 text-sm font-black tracking-wider uppercase text-foreground placeholder:text-muted-foreground/60 placeholder:font-semibold outline-none transition-colors focus:border-[#F5A800] ${
            promo?.error ? 'border-red-500' : 'border-border'
          }`}
        />
        <button
          type="button"
          onClick={apply}
          disabled={!normalizePromoCode(draft)}
          className="shrink-0 rounded-xl bg-foreground text-background px-4 text-xs font-black disabled:opacity-40 transition-opacity"
        >
          Appliquer
        </button>
      </div>
      {promo?.error && <p className="text-xs font-semibold text-red-600 dark:text-red-400">{promo.error}</p>}
    </div>
  )
}
