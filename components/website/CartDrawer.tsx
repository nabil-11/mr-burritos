'use client'

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useCart } from '@/contexts/CartContext'
import { Trash2, Plus, Minus } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import Link from 'next/link'

export default function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { items, removeItem, updateQty, total } = useCart()

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full max-w-sm flex flex-col">
        <SheetHeader>
          <SheetTitle>🛒 سلة الطلبات</SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            السلة فارغة
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto space-y-3 mt-4">
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 border rounded-lg p-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{item.name.ar}</p>
                    {item.selectedSupplements.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        + {item.selectedSupplements.map((s) => s.name.ar).join(', ')}
                      </p>
                    )}
                    <p className="text-[#F5A800] font-semibold text-sm mt-0.5">
                      {((item.price + item.selectedSupplements.reduce((s, x) => s + x.price, 0)) * item.quantity).toFixed(2)} DT
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => item.quantity > 1 ? updateQty(item.id, item.quantity - 1) : removeItem(item.id)} className="p-1 rounded hover:bg-muted">
                      <Minus size={14} />
                    </button>
                    <span className="w-5 text-center text-sm">{item.quantity}</span>
                    <button onClick={() => updateQty(item.id, item.quantity + 1)} className="p-1 rounded hover:bg-muted">
                      <Plus size={14} />
                    </button>
                    <button onClick={() => removeItem(item.id)} className="p-1 rounded hover:bg-red-50 text-red-500 ml-1">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t pt-4 mt-4 space-y-3">
              <div className="flex justify-between font-bold text-lg">
                <span>المجموع</span>
                <span className="text-[#F5A800]">{total.toFixed(2)} DT</span>
              </div>
              <Link href="/cart" onClick={onClose} className={cn(buttonVariants({ variant: 'default' }), 'w-full bg-[#F5A800] hover:bg-[#FF6B00] text-black font-bold')}>إتمام الطلب</Link>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
