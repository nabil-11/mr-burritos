'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Minus, Trash2, ShoppingCart, ChevronDown, ChevronUp, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

interface Supplement {
  _id: string
  name: { fr: string }
  price: number
  type: string
}

interface Product {
  _id: string
  name: { fr: string }
  price: number
  category: { _id: string; name: { fr: string }; slug: string } | null
  supplements: Supplement[]
}

interface Category {
  _id: string
  name: { fr: string }
  slug: string
}

interface OrderItem {
  uid: string
  productId: string
  name: { fr: string }
  price: number
  quantity: number
  selectedSupplements: Supplement[]
}

export default function NewOrderForm({
  products,
  categories,
}: {
  products: Product[]
  categories: Category[]
}) {
  const router = useRouter()

  const [items, setItems] = useState<OrderItem[]>([])
  const [activeCat, setActiveCat] = useState('all')
  const [search, setSearch] = useState('')
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null)
  const [pendingSupps, setPendingSupps] = useState<Record<string, Supplement[]>>({})
  const [type, setType] = useState<'delivery' | 'pickup'>('pickup')
  const [loading, setLoading] = useState(false)

  // ── Filtered products ──────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = products
    if (activeCat !== 'all') list = list.filter((p) => p.category?.slug === activeCat)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((p) => p.name.fr.toLowerCase().includes(q))
    }
    return list
  }, [products, activeCat, search])

  // ── Item helpers ───────────────────────────────────────────────────────────
  const addItem = (product: Product) => {
    const supps = pendingSupps[product._id] ?? []
    const uid = `${product._id}-${Date.now()}`
    setItems((prev) => [...prev, {
      uid,
      productId: product._id,
      name: product.name,
      price: product.price,
      quantity: 1,
      selectedSupplements: supps,
    }])
    setPendingSupps((prev) => ({ ...prev, [product._id]: [] }))
    setExpandedProduct(null)
    toast.success(`${product.name.fr} ajouté`)
  }

  const updateQty = (uid: string, qty: number) => {
    if (qty < 1) return removeItem(uid)
    setItems((prev) => prev.map((it) => it.uid === uid ? { ...it, quantity: qty } : it))
  }

  const removeItem = (uid: string) => setItems((prev) => prev.filter((it) => it.uid !== uid))

  const toggleSupp = (productId: string, supp: Supplement) => {
    setPendingSupps((prev) => {
      const current = prev[productId] ?? []
      const exists = current.find((s) => s._id === supp._id)
      return { ...prev, [productId]: exists ? current.filter((s) => s._id !== supp._id) : [...current, supp] }
    })
  }

  const total = items.reduce(
    (sum, it) => sum + (it.price + it.selectedSupplements.reduce((s, x) => s + x.price, 0)) * it.quantity,
    0
  )

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (items.length === 0) return toast.error('Aucun article dans la commande')

    setLoading(true)
    try {
      const orderItems = items.map((it) => ({
        product: it.productId,
        productName: it.name,
        quantity: it.quantity,
        unitPrice: it.price,
        supplements: it.selectedSupplements.map((s) => ({ supplement: s._id, name: s.name, price: s.price })),
        notes: '',
      }))

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: { name: 'Comptoir', phone: '—', address: '' },
          items: orderItems,
          subtotal: total,
          total,
          type,
          status: 'confirmed',
        }),
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

  return (
    <div className="grid lg:grid-cols-5 gap-6 items-start">

      {/* ── LEFT: Product browser ──────────────────────────────── */}
      <div className="lg:col-span-3 space-y-4">

        {/* Search */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Rechercher un produit..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white"
          />
        </div>

        {/* Category tabs */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setActiveCat('all')}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${activeCat === 'all' ? 'bg-[#1A1A1A] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-[#1A1A1A]'}`}
          >
            Tous
          </button>
          {categories.map((cat) => (
            <button
              key={cat._id}
              onClick={() => setActiveCat(cat.slug)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${activeCat === cat.slug ? 'bg-[#F5A800] text-black' : 'bg-white border border-gray-200 text-gray-600 hover:border-[#F5A800]'}`}
            >
              {cat.name.fr}
            </button>
          ))}
        </div>

        {/* Product list */}
        <div className="bg-white rounded-xl border overflow-hidden divide-y">
          {filtered.length === 0 && (
            <p className="text-center text-muted-foreground py-10 text-sm">Aucun produit trouvé</p>
          )}
          {filtered.map((product) => {
            const sauces = product.supplements.filter((s) => s.type === 'sauce')
            const sizes  = product.supplements.filter((s) => s.type === 'size')
            const extras = product.supplements.filter((s) => s.type === 'extra')
            const hasSupps = product.supplements.length > 0
            const isExpanded = expandedProduct === product._id
            const selected = pendingSupps[product._id] ?? []
            const selectedTotal = selected.reduce((s, x) => s + x.price, 0)

            return (
              <div key={product._id} className="p-3.5">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-[#1A1A1A]">{product.name.fr}</p>
                    <p className="text-xs text-muted-foreground">{product.category?.name.fr ?? '—'}</p>
                  </div>
                  <p className="font-black text-[#F5A800] text-sm whitespace-nowrap">
                    {(product.price + selectedTotal).toFixed(2)} DT
                  </p>
                  {hasSupps && (
                    <button
                      onClick={() => setExpandedProduct(isExpanded ? null : product._id)}
                      className="flex items-center gap-1 text-xs text-gray-500 hover:text-[#1A1A1A] border border-gray-200 rounded-lg px-2.5 py-1.5 transition-colors"
                    >
                      Options {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      {selected.length > 0 && (
                        <span className="bg-[#F5A800] text-black text-[10px] font-black px-1.5 py-0.5 rounded-full">{selected.length}</span>
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => addItem(product)}
                    className="flex items-center gap-1.5 bg-[#1A1A1A] hover:bg-[#F5A800] text-white hover:text-black text-xs font-bold px-3.5 py-2 rounded-lg transition-all"
                  >
                    <Plus size={14} /> Ajouter
                  </button>
                </div>

                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-2.5">
                    {[
                      { label: '🥫 Sauces', list: sauces },
                      { label: '📐 Taille', list: sizes },
                      { label: '✨ Extras', list: extras },
                    ].filter(({ list }) => list.length > 0).map(({ label, list }) => (
                      <div key={label}>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">{label}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {list.map((s) => {
                            const active = !!selected.find((x) => x._id === s._id)
                            return (
                              <button key={s._id} onClick={() => toggleSupp(product._id, s)}
                                className={`text-xs px-3 py-1 rounded-full border font-medium transition-all ${active ? 'bg-[#F5A800] border-[#F5A800] text-black' : 'border-gray-200 text-gray-500 hover:border-[#F5A800]'}`}>
                                {s.name.fr}{s.price > 0 ? ` +${s.price} DT` : ''}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── RIGHT: Order summary ───────────────────────────────── */}
      <div className="lg:col-span-2 space-y-4 sticky top-6">

        {/* Type toggle */}
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Type</p>
          <div className="grid grid-cols-2 gap-2">
            {(['pickup', 'delivery'] as const).map((t) => (
              <button key={t} onClick={() => setType(t)}
                className={`flex flex-col items-center gap-1 py-3 rounded-xl border-2 font-semibold text-xs transition-all ${type === t ? 'border-[#F5A800] bg-[#F5A800]/5 text-[#1A1A1A]' : 'border-gray-200 text-gray-400 hover:border-gray-300'}`}>
                <span className="text-xl">{t === 'pickup' ? '🏪' : '🛵'}</span>
                {t === 'pickup' ? 'À emporter' : 'Livraison'}
              </button>
            ))}
          </div>
        </div>

        {/* Cart */}
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5 mb-3">
            <ShoppingCart size={12} /> Articles ({items.length})
          </p>

          {items.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-8">
              Sélectionnez des produits à gauche
            </p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {items.map((it) => {
                const linePrice = (it.price + it.selectedSupplements.reduce((s, x) => s + x.price, 0)) * it.quantity
                return (
                  <div key={it.uid} className="flex items-start gap-2 bg-gray-50 rounded-lg p-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[#1A1A1A] truncate">{it.name.fr}</p>
                      {it.selectedSupplements.length > 0 && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                          + {it.selectedSupplements.map((s) => s.name.fr).join(', ')}
                        </p>
                      )}
                      <p className="text-[#F5A800] font-black text-xs mt-0.5">{linePrice.toFixed(2)} DT</p>
                    </div>
                    <div className="flex items-center gap-1 bg-white border rounded-lg p-0.5 shrink-0">
                      <button onClick={() => updateQty(it.uid, it.quantity - 1)} className="p-1 rounded hover:bg-gray-100"><Minus size={11} /></button>
                      <span className="w-5 text-center text-xs font-bold">{it.quantity}</span>
                      <button onClick={() => updateQty(it.uid, it.quantity + 1)} className="p-1 rounded hover:bg-gray-100"><Plus size={11} /></button>
                    </div>
                    <button onClick={() => removeItem(it.uid)} className="text-red-400 hover:text-red-600 p-1 shrink-0"><Trash2 size={13} /></button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Total + Submit */}
        <div className="bg-white rounded-xl border p-4 space-y-4">
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
                <span>Total</span>
                <span className="text-[#F5A800]">{total.toFixed(2)} DT</span>
              </div>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading || items.length === 0}
            className="w-full bg-[#F5A800] hover:bg-[#FF6B00] disabled:opacity-50 disabled:cursor-not-allowed text-black font-black py-4 rounded-xl transition-all text-sm hover:scale-[1.01] active:scale-[0.99]"
          >
            {loading ? '⏳ Création...' : items.length > 0 ? `✓ Valider — ${total.toFixed(2)} DT` : '✓ Valider la commande'}
          </button>
        </div>
      </div>
    </div>
  )
}
