'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Minus, Trash2, ShoppingCart } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import ProductBuilder, {
  BuilderCategory,
  BuilderPick,
  BuilderSupplement,
} from '@/components/website/ProductBuilder'

interface DeliveryCompany {
  _id: string
  name: string
  commission: number
}

interface OrderItem {
  uid: string
  productId: string
  name: { ar: string; fr: string }
  price: number
  quantity: number
  selectedSupplements: BuilderSupplement[]
}

// ── Pickup: the same step-by-step builder the customers use ────────────────
function PickupForm({
  categories,
  onSubmit,
  loading,
}: {
  categories: BuilderCategory[]
  onSubmit: (items: OrderItem[], total: number) => void
  loading: boolean
}) {
  const [items, setItems] = useState<OrderItem[]>([])
  const seq = useRef(0)

  const handleAdd = (pick: BuilderPick) => {
    seq.current += 1
    setItems((prev) => [
      ...prev,
      {
        uid: `${pick.product._id}-${seq.current}`,
        productId: pick.product._id,
        name: pick.product.name,
        price: pick.product.price,
        quantity: pick.quantity,
        selectedSupplements: pick.supplements,
      },
    ])
    toast.success(`${pick.quantity}× ${pick.label} ajouté`)
  }

  const updateQty = (uid: string, qty: number) => {
    if (qty < 1) setItems((prev) => prev.filter((it) => it.uid !== uid))
    else setItems((prev) => prev.map((it) => (it.uid === uid ? { ...it, quantity: qty } : it)))
  }

  const total = items.reduce(
    (sum, it) => sum + (it.price + it.selectedSupplements.reduce((s, x) => s + x.price, 0)) * it.quantity,
    0
  )

  return (
    <div className="grid lg:grid-cols-5 gap-6 items-start">
      {/* LEFT: the builder */}
      <div className="lg:col-span-3">
        {categories.length > 0 ? (
          <ProductBuilder categories={categories} onAdd={handleAdd} compact />
        ) : (
          <div className="bg-card rounded-xl border p-10 text-center text-muted-foreground text-sm">
            Aucun produit disponible
          </div>
        )}
      </div>

      {/* RIGHT: order being built */}
      <div className="lg:col-span-2 space-y-4 sticky top-6">
        <div className="bg-card rounded-xl border p-4">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5 mb-3">
            <ShoppingCart size={12} /> Articles ({items.length})
          </p>
          {items.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-8">
              Composez un article à gauche
            </p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {items.map((it) => {
                const linePrice =
                  (it.price + it.selectedSupplements.reduce((s, x) => s + x.price, 0)) * it.quantity
                return (
                  <div key={it.uid} className="flex items-start gap-2 bg-muted/50 rounded-lg p-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{it.name.fr}</p>
                      {it.selectedSupplements.length > 0 && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
                          + {it.selectedSupplements.map((s) => s.name.fr).join(', ')}
                        </p>
                      )}
                      <p className="text-[#F5A800] font-black text-xs mt-0.5">{linePrice.toFixed(2)} DT</p>
                    </div>
                    <div className="flex items-center gap-1 bg-card border rounded-lg p-0.5 shrink-0">
                      <button onClick={() => updateQty(it.uid, it.quantity - 1)} className="p-1 rounded hover:bg-muted" aria-label="Réduire">
                        <Minus size={11} />
                      </button>
                      <span className="w-5 text-center text-xs font-bold">{it.quantity}</span>
                      <button onClick={() => updateQty(it.uid, it.quantity + 1)} className="p-1 rounded hover:bg-muted" aria-label="Augmenter">
                        <Plus size={11} />
                      </button>
                    </div>
                    <button
                      onClick={() => setItems((prev) => prev.filter((x) => x.uid !== it.uid))}
                      className="text-red-400 hover:text-red-600 p-1 shrink-0"
                      aria-label="Retirer"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="bg-card rounded-xl border p-4 space-y-4">
          {items.length > 0 && (
            <div className="space-y-1 text-sm">
              {items.map((it) => (
                <div key={it.uid} className="flex justify-between text-muted-foreground">
                  <span className="truncate flex-1">{it.quantity}× {it.name.fr}</span>
                  <Badge variant="outline" className="text-[10px] ml-2 shrink-0">
                    {((it.price + it.selectedSupplements.reduce((s, x) => s + x.price, 0)) * it.quantity).toFixed(2)} DT
                  </Badge>
                </div>
              ))}
              <div className="flex justify-between font-black text-base border-t pt-2 mt-2">
                <span>Total</span><span className="text-[#F5A800]">{total.toFixed(2)} DT</span>
              </div>
            </div>
          )}
          <button
            onClick={() => onSubmit(items, total)}
            disabled={loading || items.length === 0}
            className="w-full bg-[#F5A800] hover:bg-[#FF6B00] disabled:opacity-50 disabled:cursor-not-allowed text-black font-black py-4 rounded-xl transition-all text-sm"
          >
            {loading ? '⏳ Création...' : items.length > 0 ? `✓ Valider — ${total.toFixed(2)} DT` : '✓ Valider la commande'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Delivery: amount + reference form ─────────────────────────────────────
function DeliveryForm({
  deliveryCompanies,
  onSubmit,
  loading,
}: {
  deliveryCompanies: DeliveryCompany[]
  onSubmit: (amount: number, reference: string, company: DeliveryCompany | null) => void
  loading: boolean
}) {
  const [selectedCompanyId, setSelectedCompanyId] = useState('')
  const [amount, setAmount] = useState('')
  const [reference, setReference] = useState('')

  const company = deliveryCompanies.find((c) => c._id === selectedCompanyId) ?? null
  const amountNum = parseFloat(amount) || 0
  const commissionAmt = company ? amountNum * (company.commission / 100) : 0
  const netAmt = amountNum - commissionAmt

  return (
    <div className="max-w-lg mx-auto space-y-6">

      {/* Company selector */}
      <div className="bg-card rounded-xl border p-5 space-y-3">
        <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">Société de livraison</p>
        {deliveryCompanies.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune société configurée — ajoutez-en dans <strong>Sociétés livraison</strong></p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {deliveryCompanies.map((c) => (
              <button
                key={c._id}
                onClick={() => setSelectedCompanyId(c._id)}
                className={`px-4 py-2 rounded-xl border-2 text-sm font-bold transition-all ${
                  selectedCompanyId === c._id
                    ? 'bg-[#1A1A1A] border-[#1A1A1A] text-white'
                    : 'border-border text-muted-foreground hover:border-[#1A1A1A]'
                }`}
              >
                {c.name}
                <span className={`ml-2 font-black ${selectedCompanyId === c._id ? 'text-[#F5A800]' : 'text-orange-500'}`}>
                  {c.commission}%
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Amount + Reference */}
      <div className="bg-card rounded-xl border p-5 space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-black text-muted-foreground uppercase tracking-widest">Montant de la commande</Label>
          <div className="relative">
            <Input
              type="number"
              step="0.1"
              min="0"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="pr-10 text-lg font-bold"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">DT</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-black text-muted-foreground uppercase tracking-widest">Référence / N° commande</Label>
          <Input
            placeholder="ex: GLV-123456"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            className="font-mono"
          />
        </div>
      </div>

      {/* Commission breakdown */}
      {company && amountNum > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-2 text-sm">
          <p className="text-xs font-black text-orange-700 uppercase tracking-widest mb-3">Calcul commission</p>
          <div className="flex justify-between text-muted-foreground">
            <span>Total commande</span>
            <span className="font-bold">{amountNum.toFixed(2)} DT</span>
          </div>
          <div className="flex justify-between text-orange-600">
            <span>Commission {company.name} ({company.commission}%)</span>
            <span className="font-bold">− {commissionAmt.toFixed(2)} DT</span>
          </div>
          <div className="flex justify-between text-green-700 font-black border-t border-orange-200 pt-2 mt-2 text-base">
            <span>Vous recevez</span>
            <span>{netAmt.toFixed(2)} DT</span>
          </div>
        </div>
      )}

      {/* Submit */}
      <button
        onClick={() => onSubmit(amountNum, reference, company)}
        disabled={loading || amountNum <= 0}
        className="w-full bg-[#F5A800] hover:bg-[#FF6B00] disabled:opacity-50 disabled:cursor-not-allowed text-black font-black py-4 rounded-xl transition-all text-sm"
      >
        {loading
          ? '⏳ Création...'
          : amountNum > 0
            ? `✓ Valider — ${amountNum.toFixed(2)} DT`
            : '✓ Valider la commande'
        }
      </button>
    </div>
  )
}

// ── Main form ──────────────────────────────────────────────────────────────
export default function NewOrderForm({
  categories,
  deliveryCompanies,
}: {
  categories: BuilderCategory[]
  deliveryCompanies: DeliveryCompany[]
}) {
  const router = useRouter()
  const [type, setType] = useState<'pickup' | 'delivery'>('pickup')
  const [loading, setLoading] = useState(false)

  const submitOrder = async (body: Record<string, unknown>) => {
    setLoading(true)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      const order = await res.json()
      toast.success('Commande créée !')
      router.push(`/orders/${order._id}/print`)
    } catch {
      toast.error('Erreur lors de la création')
    } finally {
      setLoading(false)
    }
  }

  const handlePickup = (items: OrderItem[], total: number) => {
    if (items.length === 0) return toast.error('Aucun article dans la commande')
    submitOrder({
      customer: { name: 'Comptoir', phone: '—', address: '' },
      items: items.map((it) => ({
        product: it.productId,
        productName: it.name,
        quantity: it.quantity,
        unitPrice: it.price,
        supplements: it.selectedSupplements.map((s) => ({ supplement: s._id, name: s.name, price: s.price })),
        notes: '',
      })),
      subtotal: total,
      total,
      type: 'pickup',
      source: 'counter',
      // Rung up at the till means the kitchen already has it: it opens in
      // preparation and its timer decides when it turns prête.
      status: 'preparing',
      deliveryCompany: { companyId: null, name: '', commission: 0 },
      reference: '',
    })
  }

  const handleDelivery = (amount: number, reference: string, company: DeliveryCompany | null) => {
    if (amount <= 0) return toast.error('Saisissez un montant valide')
    submitOrder({
      customer: { name: 'Livraison', phone: '—', address: '' },
      items: [],
      subtotal: amount,
      total: amount,
      type: 'delivery',
      source: 'counter',
      status: 'confirmed',
      reference,
      deliveryCompany: company
        ? { companyId: company._id, name: company.name, commission: company.commission }
        : { companyId: null, name: '', commission: 0 },
    })
  }

  return (
    <div className="space-y-6">
      {/* Type toggle */}
      <div className="bg-card rounded-xl border p-4">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Type de commande</p>
        <div className="grid grid-cols-2 gap-2 max-w-xs">
          {(['pickup', 'delivery'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`flex flex-col items-center gap-1 py-3 rounded-xl border-2 font-semibold text-xs transition-all ${
                type === t ? 'border-[#F5A800] bg-[#F5A800]/5 text-foreground' : 'border-border text-muted-foreground hover:border-border'
              }`}
            >
              <span className="text-xl">{t === 'pickup' ? '🏪' : '🛵'}</span>
              {t === 'pickup' ? 'À emporter' : 'Livraison plateforme'}
            </button>
          ))}
        </div>
      </div>

      {/* Mode-specific form */}
      {type === 'pickup' ? (
        <PickupForm categories={categories} onSubmit={handlePickup} loading={loading} />
      ) : (
        <DeliveryForm deliveryCompanies={deliveryCompanies} onSubmit={handleDelivery} loading={loading} />
      )}
    </div>
  )
}
