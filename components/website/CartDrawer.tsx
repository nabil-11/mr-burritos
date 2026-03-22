'use client'

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useCart } from '@/contexts/CartContext'
import { Trash2, Plus, Minus, ShoppingBag } from 'lucide-react'
import Link from 'next/link'

export default function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { items, removeItem, updateQty, total } = useCart()

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full max-w-sm flex flex-col p-0">
        <SheetHeader className="px-5 py-4 border-b bg-[#1A1A1A] text-white">
          <SheetTitle className="text-white flex items-center gap-2">
            <ShoppingBag size={18} className="text-[#F5A800]" /> Mon Panier
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <ShoppingBag size={48} className="text-gray-200" />
            <p className="font-medium">Votre panier est vide</p>
            <Link href="/menu" onClick={onClose}
              className="text-sm bg-[#F5A800] text-black font-bold px-4 py-2 rounded-full hover:bg-[#FF6B00] transition-colors">
              Voir le menu
            </Link>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {items.map((item) => {
                const suppTotal = item.selectedSupplements.reduce((s, x) => s + x.price, 0)
                const lineTotal = (item.price + suppTotal) * item.quantity
                return (
                  <div key={item.id} className="flex items-start gap-3 bg-gray-50 rounded-xl p-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{item.name.fr}</p>
                      {item.selectedSupplements.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          + {item.selectedSupplements.map((s) => s.name.fr).join(', ')}
                        </p>
                      )}
                      <p className="text-[#F5A800] font-bold text-sm mt-1">{lineTotal.toFixed(2)} DT</p>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <div className="flex items-center gap-1 bg-white rounded-lg border p-0.5">
                        <button onClick={() => item.quantity > 1 ? updateQty(item.id, item.quantity - 1) : removeItem(item.id)}
                          className="p-1 rounded hover:bg-gray-100"><Minus size={12} /></button>
                        <span className="w-5 text-center text-xs font-bold">{item.quantity}</span>
                        <button onClick={() => updateQty(item.id, item.quantity + 1)}
                          className="p-1 rounded hover:bg-gray-100"><Plus size={12} /></button>
                      </div>
                      <button onClick={() => removeItem(item.id)} className="text-red-400 hover:text-red-600 p-1">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="border-t px-4 pt-4 pb-5 bg-white space-y-3">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Sous-total</span><span>{total.toFixed(2)} DT</span>
              </div>
              <div className="flex justify-between font-black text-lg">
                <span>Total</span>
                <span className="text-[#F5A800]">{total.toFixed(2)} DT</span>
              </div>
              <Link href="/cart" onClick={onClose}
                className="block w-full text-center bg-[#F5A800] hover:bg-[#FF6B00] text-black font-bold py-3 rounded-xl transition-colors text-sm">
                Commander →
              </Link>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
