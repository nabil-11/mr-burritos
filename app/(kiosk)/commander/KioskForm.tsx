'use client'

import Image from 'next/image'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Minus, ShoppingCart, X, ChevronRight, Trash2 } from 'lucide-react'
import ProductBuilder, {
  BuilderCategory,
  BuilderPick,
  BuilderSupplement,
} from '@/components/website/ProductBuilder'

interface CartItem {
  uid: string
  productId: string
  name: { ar: string; fr: string }
  image: string
  price: number
  quantity: number
  selectedSupplements: BuilderSupplement[]
}

export default function KioskForm({ categories }: { categories: BuilderCategory[] }) {
  const router = useRouter()
  const [cart, setCart] = useState<CartItem[]>([])
  const [showCart, setShowCart] = useState(false)
  const [orderType, setOrderType] = useState<'pickup' | 'delivery'>('pickup')
  const [loading, setLoading] = useState(false)
  const seq = useRef(0)

  const total = cart.reduce(
    (sum, it) => sum + (it.price + it.selectedSupplements.reduce((s, x) => s + x.price, 0)) * it.quantity,
    0
  )
  const itemCount = cart.reduce((s, it) => s + it.quantity, 0)

  const handleAdd = (pick: BuilderPick) => {
    seq.current += 1
    setCart((prev) => [
      ...prev,
      {
        uid: `${pick.product._id}-${seq.current}`,
        productId: pick.product._id,
        name: pick.product.name,
        image: pick.product.image,
        price: pick.product.price,
        quantity: pick.quantity,
        selectedSupplements: pick.supplements,
      },
    ])
    toast.success(`${pick.quantity}× ${pick.label} ajouté !`, { duration: 1500 })
  }

  const updateQty = (uid: string, qty: number) => {
    if (qty < 1) setCart((prev) => prev.filter((it) => it.uid !== uid))
    else setCart((prev) => prev.map((it) => (it.uid === uid ? { ...it, quantity: qty } : it)))
  }

  const handleSubmit = async () => {
    if (cart.length === 0) return
    setLoading(true)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: { name: 'Comptoir', phone: '—', address: '' },
          items: cart.map((it) => ({
            product: it.productId,
            productName: it.name,
            quantity: it.quantity,
            unitPrice: it.price,
            supplements: it.selectedSupplements.map((s) => ({ supplement: s._id, name: s.name, price: s.price })),
            notes: '',
          })),
          subtotal: total,
          total,
          type: orderType,
          source: 'kiosk',
          status: 'confirmed',
        }),
      })
      if (!res.ok) throw new Error()
      const order = await res.json()
      toast.success('Commande créée !')
      router.push(`/commander/${order._id}/print`)
    } catch {
      toast.error('Erreur lors de la création')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* ── Header ──────────────────────────────────────────── */}
      <header className="bg-[#1A1A1A] text-white sticky top-0 z-30 shadow-xl">
        <div className="px-4 py-4 flex items-center justify-between">
          <div>
            <p className="font-black text-xl tracking-widest text-[#F5A800]">MR. BURRITOS</p>
            <p className="text-[11px] text-white/50 -mt-0.5">Composez votre commande</p>
          </div>
          {itemCount > 0 && (
            <button
              onClick={() => setShowCart(true)}
              className="flex items-center gap-2 bg-[#F5A800] text-black font-black px-4 py-2.5 rounded-xl text-sm active:scale-95 transition-transform shadow-lg"
            >
              <ShoppingCart size={16} />
              <span>{itemCount}</span>
              <span className="hidden sm:inline">article{itemCount > 1 ? 's' : ''} ·</span>
              <span>{total.toFixed(2)} DT</span>
              <ChevronRight size={14} />
            </button>
          )}
        </div>
      </header>

      {/* ── Le composeur — même logique que le site ─────────── */}
      <div className="flex-1 p-4 pb-32">
        <div className="max-w-3xl mx-auto">
          {categories.length > 0 ? (
            <ProductBuilder categories={categories} onAdd={handleAdd} />
          ) : (
            <div className="bg-white rounded-3xl border p-10 text-center">
              <p className="text-4xl mb-3">🍽️</p>
              <p className="font-bold text-[#1A1A1A]">Aucun produit disponible</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Sticky bottom bar ───────────────────────────────── */}
      {itemCount > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-40 p-4 bg-white border-t border-gray-200 shadow-2xl">
          <button
            onClick={() => setShowCart(true)}
            className="w-full bg-[#F5A800] hover:bg-[#FF6B00] text-black font-black py-4 rounded-2xl text-base transition-all active:scale-[0.99] flex items-center justify-between px-6 shadow-lg shadow-[#F5A800]/30"
          >
            <span className="bg-black/15 rounded-lg px-2.5 py-0.5 text-sm font-black">{itemCount}</span>
            <span>Voir ma commande</span>
            <span className="font-black">{total.toFixed(2)} DT</span>
          </button>
        </div>
      )}

      {/* ── Cart drawer ─────────────────────────────────────── */}
      {showCart && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md max-h-[92vh] flex flex-col shadow-2xl">

            <div className="p-5 border-b flex items-center justify-between shrink-0 rounded-t-3xl">
              <p className="font-black text-lg flex items-center gap-2.5">
                <ShoppingCart size={20} className="text-[#F5A800]" />
                Ma commande
                <span className="bg-[#F5A800] text-black text-xs font-black px-2 py-0.5 rounded-full">{itemCount}</span>
              </p>
              <button onClick={() => setShowCart(false)} className="p-2 hover:bg-gray-100 rounded-xl">
                <X size={20} />
              </button>
            </div>

            <div className="px-5 pt-4 pb-3 border-b shrink-0">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Type de commande</p>
              <div className="grid grid-cols-2 gap-2">
                {(['pickup', 'delivery'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setOrderType(t)}
                    className={`flex flex-col items-center gap-1.5 py-3.5 rounded-2xl border-2 font-semibold text-sm transition-all active:scale-95 ${
                      orderType === t
                        ? 'border-[#F5A800] bg-[#F5A800]/8 text-[#1A1A1A]'
                        : 'border-gray-200 text-gray-400 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-2xl">{t === 'pickup' ? '🏪' : '🛵'}</span>
                    {t === 'pickup' ? 'À emporter' : 'Livraison'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {cart.map((it) => {
                const linePrice =
                  (it.price + it.selectedSupplements.reduce((s, x) => s + x.price, 0)) * it.quantity
                return (
                  <div key={it.uid} className="flex items-start gap-3 bg-gray-50 rounded-2xl p-3.5">
                    <div className="relative w-10 h-10 shrink-0 rounded-xl overflow-hidden bg-gray-200">
                      {it.image && <Image src={it.image} alt={it.name.fr} fill sizes="40px" className="object-cover" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-[#1A1A1A] truncate">{it.name.fr}</p>
                      {it.selectedSupplements.length > 0 && (
                        <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-2">
                          + {it.selectedSupplements.map((s) => s.name.fr).join(', ')}
                        </p>
                      )}
                      <p className="font-black text-[#F5A800] text-sm mt-0.5">{linePrice.toFixed(2)} DT</p>
                    </div>

                    <div className="flex items-center gap-1 bg-white border rounded-xl p-1 shrink-0">
                      <button
                        onClick={() => updateQty(it.uid, it.quantity - 1)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors"
                        aria-label="Réduire"
                      >
                        {it.quantity === 1 ? <Trash2 size={13} className="text-red-400" /> : <Minus size={13} />}
                      </button>
                      <span className="w-6 text-center text-sm font-bold">{it.quantity}</span>
                      <button
                        onClick={() => updateQty(it.uid, it.quantity + 1)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors"
                        aria-label="Augmenter"
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="p-5 border-t shrink-0 space-y-3 rounded-b-3xl bg-white">
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-sm">Sous-total</span>
                <span className="font-bold">{total.toFixed(2)} DT</span>
              </div>
              <div className="flex justify-between items-center font-black text-lg border-t pt-3">
                <span>Total</span>
                <span className="text-[#F5A800]">{total.toFixed(2)} DT</span>
              </div>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full bg-[#F5A800] hover:bg-[#FF6B00] disabled:opacity-60 text-black font-black py-4 rounded-2xl transition-all text-base active:scale-[0.99] shadow-lg shadow-[#F5A800]/30"
              >
                {loading ? '⏳ Création en cours...' : `✓ Confirmer la commande · ${total.toFixed(2)} DT`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
