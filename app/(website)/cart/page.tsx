'use client'

import { useCart } from '@/contexts/CartContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Trash2, Minus, Plus } from 'lucide-react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

export default function CartPage() {
  const { items, removeItem, updateQty, total, clearCart } = useCart()
  const router = useRouter()
  const [type, setType] = useState<'delivery' | 'pickup'>('delivery')
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', notes: '' })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (items.length === 0) return toast.error('السلة فارغة')
    if (!form.name || !form.phone) return toast.error('الاسم والهاتف مطلوبان')
    if (type === 'delivery' && !form.address) return toast.error('العنوان مطلوب للتوصيل')

    setLoading(true)
    try {
      const orderItems = items.map((item) => ({
        product: item.productId,
        productName: item.name,
        quantity: item.quantity,
        unitPrice: item.price,
        supplements: item.selectedSupplements.map((s) => ({
          supplement: s._id,
          name: s.name,
          price: s.price,
        })),
        notes: item.notes,
      }))

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: { name: form.name, phone: form.phone, email: form.email, address: form.address },
          items: orderItems,
          subtotal: total,
          total: total,
          type,
          notes: form.notes,
        }),
      })

      if (!res.ok) throw new Error('Erreur')
      const order = await res.json()
      clearCart()
      router.push(`/order/${order._id}`)
    } catch {
      toast.error('حدث خطأ، حاول مجدداً')
    } finally {
      setLoading(false)
    }
  }

  if (items.length === 0 && !loading) {
    return (
      <div dir="rtl" className="max-w-lg mx-auto px-4 py-20 text-center">
        <p className="text-5xl mb-4">🛒</p>
        <p className="text-xl font-bold mb-2">السلة فارغة</p>
        <a href="/menu" className="text-[#F5A800] underline">تصفح القائمة</a>
      </div>
    )
  }

  return (
    <div dir="rtl" className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-black mb-6">إتمام الطلب</h1>
      <div className="grid md:grid-cols-2 gap-8">
        {/* Items */}
        <div>
          <h2 className="font-bold mb-3">المنتجات</h2>
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="border rounded-lg p-3 flex items-center gap-3">
                <div className="flex-1">
                  <p className="font-medium text-sm">{item.name.ar}</p>
                  {item.selectedSupplements.length > 0 && (
                    <p className="text-xs text-muted-foreground">{item.selectedSupplements.map((s) => s.name.ar).join(', ')}</p>
                  )}
                  <p className="text-[#F5A800] font-bold text-sm">
                    {((item.price + item.selectedSupplements.reduce((s, x) => s + x.price, 0)) * item.quantity).toFixed(2)} DT
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => item.quantity > 1 ? updateQty(item.id, item.quantity - 1) : removeItem(item.id)} className="p-1 rounded border"><Minus size={12} /></button>
                  <span className="w-6 text-center text-sm">{item.quantity}</span>
                  <button onClick={() => updateQty(item.id, item.quantity + 1)} className="p-1 rounded border"><Plus size={12} /></button>
                  <button onClick={() => removeItem(item.id)} className="p-1 rounded text-red-500 ml-1"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between font-bold text-lg mt-4 border-t pt-3">
            <span>المجموع</span>
            <span className="text-[#F5A800]">{total.toFixed(2)} DT</span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2 mb-2">
            {(['delivery', 'pickup'] as const).map((t) => (
              <button key={t} type="button" onClick={() => setType(t)}
                className={`flex-1 py-2 rounded-lg border font-medium text-sm transition-colors ${type === t ? 'bg-[#F5A800] border-[#F5A800] text-black' : 'hover:border-[#F5A800]'}`}>
                {t === 'delivery' ? '🛵 توصيل' : '🏠 استلام'}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">الاسم *</Label>
            <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">الهاتف *</Label>
            <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
          </div>
          {type === 'delivery' && (
            <div className="space-y-2">
              <Label htmlFor="address">العنوان *</Label>
              <Input id="address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="notes">ملاحظات</Label>
            <Textarea id="notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-[#F5A800] hover:bg-[#FF6B00] text-black font-bold">
            {loading ? 'جاري الإرسال...' : 'تأكيد الطلب'}
          </Button>
        </form>
      </div>
    </div>
  )
}
