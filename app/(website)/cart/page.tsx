'use client'

import { useCart } from '@/contexts/CartContext'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Trash2, Minus, Plus, ShoppingBag, MapPin, Package } from 'lucide-react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'

export default function CartPage() {
  const { items, removeItem, updateQty, total, clearCart } = useCart()
  const router = useRouter()
  const [type, setType] = useState<'delivery' | 'pickup'>('delivery')
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', notes: '' })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (items.length === 0) return toast.error('Votre panier est vide')
    if (!form.name || !form.phone) return toast.error('Nom et téléphone requis')
    if (type === 'delivery' && !form.address) return toast.error('Adresse requise pour la livraison')

    setLoading(true)
    try {
      const orderItems = items.map((item) => ({
        product: item.productId,
        productName: item.name,
        quantity: item.quantity,
        unitPrice: item.price,
        supplements: item.selectedSupplements.map((s) => ({ supplement: s._id, name: s.name, price: s.price })),
        notes: item.notes,
      }))
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer: { name: form.name, phone: form.phone, email: form.email, address: form.address }, items: orderItems, subtotal: total, total, type, notes: form.notes }),
      })
      if (!res.ok) throw new Error()
      const order = await res.json()
      clearCart()
      router.push(`/order/${order._id}`)
    } catch {
      toast.error('Une erreur est survenue, réessayez')
    } finally {
      setLoading(false)
    }
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 px-4">
        <div className="text-center">
          <ShoppingBag size={64} className="text-gray-200 mx-auto mb-4" />
          <h2 className="text-2xl font-black text-[#1A1A1A] mb-2">Votre panier est vide</h2>
          <p className="text-muted-foreground mb-6">Parcourez notre menu et ajoutez vos plats préférés</p>
          <Link href="/menu" className="bg-[#F5A800] hover:bg-[#FF6B00] text-black font-black px-8 py-3 rounded-full transition-all">
            Voir le menu
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-24 pb-16">
      <div className="max-w-5xl mx-auto px-4">
        <h1 className="text-3xl font-black text-[#1A1A1A] mb-8">Votre commande</h1>

        <div className="grid lg:grid-cols-5 gap-8">
          {/* Items — 3 cols */}
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-white rounded-2xl border p-5 space-y-3">
              <h2 className="font-black text-[#1A1A1A] mb-4">Articles ({items.length})</h2>
              {items.map((item) => {
                const suppTotal = item.selectedSupplements.reduce((s, x) => s + x.price, 0)
                return (
                  <div key={item.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{item.name.fr}</p>
                      {item.selectedSupplements.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5">{item.selectedSupplements.map((s) => s.name.fr).join(', ')}</p>
                      )}
                      <p className="text-[#F5A800] font-black mt-1">{((item.price + suppTotal) * item.quantity).toFixed(2)} DT</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 bg-white border rounded-lg p-0.5">
                        <button onClick={() => item.quantity > 1 ? updateQty(item.id, item.quantity - 1) : removeItem(item.id)} className="p-1 rounded hover:bg-gray-100"><Minus size={12} /></button>
                        <span className="w-5 text-center text-xs font-bold">{item.quantity}</span>
                        <button onClick={() => updateQty(item.id, item.quantity + 1)} className="p-1 rounded hover:bg-gray-100"><Plus size={12} /></button>
                      </div>
                      <button onClick={() => removeItem(item.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={14} /></button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Form — 2 cols */}
          <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-4">
            {/* Order type */}
            <div className="bg-white rounded-2xl border p-5">
              <h2 className="font-black text-[#1A1A1A] mb-4">Type de commande</h2>
              <div className="grid grid-cols-2 gap-3">
                {([['delivery', '🛵', 'Livraison'], ['pickup', '🏪', 'À emporter']] as const).map(([t, icon, label]) => (
                  <button key={t} type="button" onClick={() => setType(t)}
                    className={`flex flex-col items-center gap-1 py-4 rounded-xl border-2 font-bold text-sm transition-all ${type === t ? 'border-[#F5A800] bg-[#F5A800]/5 text-[#1A1A1A]' : 'border-gray-200 text-gray-500 hover:border-[#F5A800]/50'}`}>
                    <span className="text-2xl">{icon}</span>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Customer info */}
            <div className="bg-white rounded-2xl border p-5 space-y-4">
              <h2 className="font-black text-[#1A1A1A] flex items-center gap-2">
                <MapPin size={16} className="text-[#F5A800]" /> Vos coordonnées
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-gray-500 uppercase">Nom *</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Votre nom" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-gray-500 uppercase">Téléphone *</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required placeholder="+216 XX XXX XXX" />
                </div>
              </div>
              {type === 'delivery' && (
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-gray-500 uppercase">Adresse *</Label>
                  <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required placeholder="Votre adresse de livraison" />
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-xs font-bold text-gray-500 uppercase">Notes</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Instructions spéciales..." />
              </div>
            </div>

            {/* Summary */}
            <div className="bg-white rounded-2xl border p-5">
              <h2 className="font-black text-[#1A1A1A] flex items-center gap-2 mb-4">
                <Package size={16} className="text-[#F5A800]" /> Récapitulatif
              </h2>
              <div className="space-y-2 text-sm mb-4">
                <div className="flex justify-between text-muted-foreground"><span>Sous-total</span><span>{total.toFixed(2)} DT</span></div>
                <div className="flex justify-between text-muted-foreground"><span>Livraison</span><span>{type === 'delivery' ? 'Gratuite' : '—'}</span></div>
                <div className="flex justify-between font-black text-base border-t pt-2"><span>Total</span><span className="text-[#F5A800]">{total.toFixed(2)} DT</span></div>
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-[#F5A800] hover:bg-[#FF6B00] disabled:opacity-60 text-black font-black py-4 rounded-xl transition-all text-sm hover:scale-[1.02] active:scale-[0.98]">
                {loading ? '⏳ Envoi en cours...' : '✓ Confirmer la commande'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
