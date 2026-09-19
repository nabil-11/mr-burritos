'use client'

import Link from 'next/link'
import { ShoppingBag, ArrowRight, BadgePercent } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useCart } from '@/contexts/CartContext'
import { useCartQuote } from '@/hooks/useCartQuote'
import { WEB_PROMO, applyWebPromo } from '@/lib/promo'
import CartLine from './CartLine'

/**
 * The basket, one tap from anywhere. Opened by the navbar, the mobile cart bar
 * and the "ajouté" toast, all through the cart context.
 */
export default function CartDrawer() {
  const { items, total, itemCount, drawerOpen, setDrawerOpen } = useCart()
  const { problems, blocking } = useCartQuote(drawerOpen)
  const { discount, total: payable } = applyWebPromo(total)
  const close = () => setDrawerOpen(false)

  return (
    <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
      <SheetContent side="right" className="data-[side=right]:w-full data-[side=right]:sm:max-w-md flex flex-col gap-0 p-0 bg-background">
        <SheetHeader className="px-5 py-4 border-b border-border">
          <SheetTitle className="flex items-center gap-2 text-foreground">
            <ShoppingBag size={18} className="text-[#F5A800]" /> Mon panier
            {itemCount > 0 && (
              <span className="ml-1 rounded-full bg-[#F5A800] text-black text-[11px] font-black px-2 py-0.5 tabular-nums">
                {itemCount}
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 px-8 text-center">
            <div className="w-20 h-20 rounded-full bg-muted grid place-items-center text-4xl">🌯</div>
            <p className="font-black text-foreground">Votre panier est vide</p>
            <p className="text-sm text-muted-foreground">
              Composez un tacos ou un burrito — {WEB_PROMO.badge} sur toute commande en ligne.
            </p>
            <Link
              href="/#composer"
              onClick={close}
              className="mt-2 inline-flex items-center gap-2 bg-[#F5A800] hover:bg-[#FF6B00] text-black font-black px-5 py-2.5 rounded-full text-sm transition-colors"
            >
              Voir le menu <ArrowRight size={15} />
            </Link>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2.5">
              {items.map((item) => (
                <CartLine key={item.id} item={item} problem={problems[item.id]} compact />
              ))}
              <Link
                href="/#composer"
                onClick={close}
                className="block text-center text-sm font-bold text-muted-foreground hover:text-[#F5A800] py-2 transition-colors"
              >
                + Ajouter autre chose
              </Link>
            </div>

            <div className="border-t border-border px-5 pt-4 pb-5 space-y-2 bg-card">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Sous-total</span>
                <span className="tabular-nums">{total.toFixed(2)} DT</span>
              </div>
              <div className="flex justify-between text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                <span className="flex items-center gap-1.5">
                  <BadgePercent size={14} /> {WEB_PROMO.label} ({WEB_PROMO.badge})
                </span>
                <span className="tabular-nums">− {discount.amount.toFixed(2)} DT</span>
              </div>
              <div className="flex justify-between items-baseline pt-1">
                <span className="font-black text-foreground">Total</span>
                <span className="font-black text-xl text-[#F5A800] tabular-nums">{payable.toFixed(2)} DT</span>
              </div>
              {blocking && (
                <p className="text-xs font-bold text-red-600 dark:text-red-400">
                  Retirez les articles indisponibles pour commander.
                </p>
              )}
              <Link
                href="/cart"
                onClick={close}
                aria-disabled={blocking}
                className={`mt-2 flex items-center justify-center gap-2 w-full bg-[#F5A800] hover:bg-[#FF6B00] text-black font-black py-3.5 rounded-xl transition-colors text-sm ${
                  blocking ? 'pointer-events-none opacity-50' : ''
                }`}
              >
                Commander <ArrowRight size={16} />
              </Link>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
