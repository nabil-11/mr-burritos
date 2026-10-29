import { Bike } from 'lucide-react'
import { FREE_DELIVERY_FROM } from '@/lib/commerce'
import { formatDT } from '@/lib/format'

/**
 * « Plus que 6,40 DT pour la livraison offerte » — la jauge du panier, en
 * livraison seulement. Compte la nourriture une fois les remises déduites,
 * comme le serveur (lib/commerce deliveryQuote). Absente sans seuil configuré.
 */
export default function FreeDeliveryBar({ foodTotal }: { foodTotal: number }) {
  if (FREE_DELIVERY_FROM === null || FREE_DELIVERY_FROM <= 0) return null
  const missing = Math.max(0, Math.round((FREE_DELIVERY_FROM - foodTotal) * 100) / 100)
  const ratio = Math.min(1, foodTotal / FREE_DELIVERY_FROM)
  const done = missing === 0

  return (
    <div className="rounded-xl bg-muted/60 px-3 py-2.5" aria-live="polite">
      <p className={`flex items-center gap-2 text-xs font-bold ${done ? 'text-emerald-700 dark:text-emerald-300' : 'text-foreground'}`}>
        <Bike size={14} className={done ? '' : 'text-brand'} />
        {done ? 'Livraison offerte ✓' : `Plus que ${formatDT(missing)} pour la livraison offerte`}
      </p>
      <div
        className="mt-2 h-1.5 rounded-full bg-border overflow-hidden"
        role="progressbar"
        aria-label="Vers la livraison offerte"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(ratio * 100)}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${done ? 'bg-emerald-500' : 'bg-[#F5A800]'}`}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  )
}
