'use client'

import Image from 'next/image'
import { Minus, Plus, Trash2, AlertTriangle } from 'lucide-react'
import { CartItem, MAX_LINE_QTY, lineUnitPrice, useCart } from '@/contexts/CartContext'
import { describeSupplements } from '@/lib/cartText'

export default function CartLine({
  item,
  /** Why this line cannot be ordered any more, from the server's quote. */
  problem,
  compact = false,
}: {
  item: CartItem
  problem?: string | null
  compact?: boolean
}) {
  const { updateQty, removeItem } = useCart()
  const details = describeSupplements(item.selectedSupplements)
  const lineTotal = lineUnitPrice(item) * item.quantity

  return (
    <div
      className={`flex gap-3 rounded-2xl border p-3 transition-colors ${
        problem ? 'border-red-500/40 bg-red-500/5' : 'border-border bg-card'
      }`}
    >
      <div className={`relative shrink-0 overflow-hidden rounded-xl bg-muted ${compact ? 'w-14 h-14' : 'w-16 h-16'}`}>
        {item.image ? (
          <Image src={item.image} alt="" fill sizes="64px" className={`object-cover ${problem ? 'grayscale' : ''}`} />
        ) : (
          <span className="absolute inset-0 grid place-items-center text-2xl">🌯</span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="font-bold text-sm text-foreground leading-tight">{item.name.fr}</p>
          <p className="font-black text-sm text-foreground tabular-nums whitespace-nowrap">
            {lineTotal.toFixed(2)} DT
          </p>
        </div>
        {details && <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{details}</p>}

        {problem ? (
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-xs font-bold text-red-600 dark:text-red-400">
              <AlertTriangle size={13} className="shrink-0" /> {problem}
            </p>
            <button
              onClick={() => removeItem(item.id)}
              className="text-xs font-bold text-red-600 dark:text-red-400 underline underline-offset-2 shrink-0"
            >
              Retirer
            </button>
          </div>
        ) : (
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="flex items-center rounded-full border border-border bg-background">
              <button
                onClick={() => updateQty(item.id, item.quantity - 1)}
                className="w-8 h-8 grid place-items-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label={item.quantity > 1 ? `Retirer un ${item.name.fr}` : `Supprimer ${item.name.fr}`}
              >
                {item.quantity > 1 ? <Minus size={13} /> : <Trash2 size={13} />}
              </button>
              <span className="w-7 text-center text-sm font-black tabular-nums" aria-live="polite">
                {item.quantity}
              </span>
              <button
                onClick={() => updateQty(item.id, item.quantity + 1)}
                disabled={item.quantity >= MAX_LINE_QTY}
                className="w-8 h-8 grid place-items-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 transition-colors"
                aria-label={`Ajouter un ${item.name.fr}`}
              >
                <Plus size={13} />
              </button>
            </div>
            {item.quantity > 1 && (
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {lineUnitPrice(item).toFixed(2)} DT / pièce
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
