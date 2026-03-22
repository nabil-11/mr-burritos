'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { toast } from 'sonner'
import { Plus, Minus, ShoppingCart, X, Check, ChevronRight, Trash2 } from 'lucide-react'

interface Supplement {
  _id: string
  name: { fr: string }
  price: number
  type: string
}

interface Product {
  _id: string
  name: { fr: string }
  description: { fr: string }
  price: number
  image: string
  category: { _id: string; name: { fr: string }; slug: string } | null
  supplements: Supplement[]
}

interface Category {
  _id: string
  name: { fr: string }
  slug: string
}

interface CartItem {
  uid: string
  productId: string
  name: { fr: string }
  price: number
  image: string
  quantity: number
  selectedSupplements: Supplement[]
}

function getCardStyle(name: string): { emoji: string; gradient: string } {
  const n = name.toLowerCase()
  if (n.includes('tacos'))      return { emoji: '🌮', gradient: 'from-orange-800 via-amber-700 to-orange-600' }
  if (n.includes('burrito'))    return { emoji: '🌯', gradient: 'from-green-900 via-emerald-800 to-green-700' }
  if (n.includes('nugget'))     return { emoji: '🍗', gradient: 'from-yellow-700 via-amber-600 to-yellow-500' }
  if (n.includes('popper'))     return { emoji: '🧀', gradient: 'from-yellow-600 via-orange-500 to-amber-500' }
  if (n.includes('finger') || n.includes('chicken')) return { emoji: '🍗', gradient: 'from-amber-700 via-yellow-600 to-orange-500' }
  if (n.includes('box famille') || n.includes('box chilla') || n.includes('box hob')) return { emoji: '📦', gradient: 'from-purple-800 via-violet-700 to-purple-600' }
  if (n.includes('mix') || n.includes('box')) return { emoji: '🍱', gradient: 'from-red-800 via-orange-700 to-red-600' }
  if (n.includes('soda') || n.includes('eau') || n.includes('boisson') || n.includes('canette')) return { emoji: '🥤', gradient: 'from-blue-700 via-cyan-600 to-blue-500' }
  return { emoji: '🍴', gradient: 'from-gray-800 via-gray-700 to-gray-600' }
}

export default function KioskForm({
  products,
  categories,
}: {
  products: Product[]
  categories: Category[]
}) {
  const router = useRouter()
  const [activeCat, setActiveCat] = useState('all')
  const [cart, setCart] = useState<CartItem[]>([])
  const [configProduct, setConfigProduct] = useState<Product | null>(null)
  const [pendingSupps, setPendingSupps] = useState<Supplement[]>([])
  const [showCart, setShowCart] = useState(false)
  const [orderType, setOrderType] = useState<'pickup' | 'delivery'>('pickup')
  const [loading, setLoading] = useState(false)

  const filtered = useMemo(() => {
    if (activeCat === 'all') return products
    return products.filter((p) => p.category?.slug === activeCat)
  }, [products, activeCat])

  const total = cart.reduce(
    (sum, it) => sum + (it.price + it.selectedSupplements.reduce((s, x) => s + x.price, 0)) * it.quantity,
    0
  )
  const itemCount = cart.reduce((s, it) => s + it.quantity, 0)

  const addToCart = (product: Product, supps: Supplement[]) => {
    const uid = `${product._id}-${Date.now()}`
    setCart((prev) => [...prev, {
      uid,
      productId: product._id,
      name: product.name,
      price: product.price,
      image: product.image,
      quantity: 1,
      selectedSupplements: supps,
    }])
    toast.success(`${product.name.fr} ajouté !`, { duration: 1500 })
  }

  const handleProductTap = (product: Product) => {
    if (product.supplements.length > 0) {
      setConfigProduct(product)
      setPendingSupps([])
    } else {
      addToCart(product, [])
    }
  }

  const confirmConfig = () => {
    if (!configProduct) return
    addToCart(configProduct, pendingSupps)
    setConfigProduct(null)
    setPendingSupps([])
  }

  const togglePendingSupp = (supp: Supplement) => {
    setPendingSupps((prev) =>
      prev.find((s) => s._id === supp._id)
        ? prev.filter((s) => s._id !== supp._id)
        : [...prev, supp]
    )
  }

  const updateQty = (uid: string, qty: number) => {
    if (qty < 1) setCart((prev) => prev.filter((it) => it.uid !== uid))
    else setCart((prev) => prev.map((it) => it.uid === uid ? { ...it, quantity: qty } : it))
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
        <div className="px-4 pt-4 pb-0 flex items-center justify-between">
          <div>
            <p className="font-black text-xl tracking-widest text-[#F5A800]">MR. BURRITOS</p>
            <p className="text-[11px] text-white/50 -mt-0.5 pb-2">Choisissez vos articles</p>
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

        {/* Category tabs */}
        <div className="px-4 pb-3 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          <button
            onClick={() => setActiveCat('all')}
            className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
              activeCat === 'all'
                ? 'bg-[#F5A800] text-black'
                : 'bg-white/10 text-white/60 hover:bg-white/20'
            }`}
          >
            Tous
          </button>
          {categories.map((cat) => (
            <button
              key={cat._id}
              onClick={() => setActiveCat(cat.slug)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                activeCat === cat.slug
                  ? 'bg-[#F5A800] text-black'
                  : 'bg-white/10 text-white/60 hover:bg-white/20'
              }`}
            >
              {cat.name.fr}
            </button>
          ))}
        </div>
      </header>

      {/* ── Product grid ────────────────────────────────────── */}
      <div className="flex-1 p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 pb-32">
        {filtered.map((product) => {
          const { emoji, gradient } = getCardStyle(product.name.fr)
          return (
            <button
              key={product._id}
              onClick={() => handleProductTap(product)}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm active:scale-95 transition-all duration-150 overflow-hidden text-left group hover:shadow-lg hover:border-[#F5A800]/30"
            >
              {/* Image / placeholder */}
              <div className={`relative h-44 w-full bg-linear-to-br ${gradient} overflow-hidden`}>
                {product.image ? (
                  <Image
                    src={product.image}
                    alt={product.name.fr}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <span className="text-6xl drop-shadow-xl select-none group-hover:scale-110 transition-transform duration-200">
                      {emoji}
                    </span>
                  </div>
                )}
                <div className="absolute inset-0 bg-linear-to-t from-black/55 to-transparent" />

                {/* Price badge */}
                <div className="absolute bottom-2.5 right-2.5">
                  <span className="bg-[#F5A800] text-black text-xs font-black px-3 py-1.5 rounded-full shadow-lg">
                    {product.price.toFixed(2)} DT
                  </span>
                </div>

                {/* Options badge */}
                {product.supplements.length > 0 && (
                  <div className="absolute top-2 left-2">
                    <span className="bg-black/50 backdrop-blur-sm text-white text-[9px] font-bold px-2 py-0.5 rounded-full border border-white/10">
                      Options
                    </span>
                  </div>
                )}
              </div>

              {/* Name + add icon */}
              <div className="p-3 flex items-center justify-between gap-2">
                <p className="font-bold text-sm text-[#1A1A1A] leading-snug flex-1 line-clamp-2">
                  {product.name.fr}
                </p>
                <div className="shrink-0 w-9 h-9 rounded-xl bg-[#1A1A1A] group-hover:bg-[#F5A800] flex items-center justify-center transition-colors">
                  <Plus size={18} className="text-white group-hover:text-black transition-colors" />
                </div>
              </div>
            </button>
          )
        })}

        {filtered.length === 0 && (
          <div className="col-span-full text-center py-20 text-gray-400">
            <p className="text-4xl mb-3">🍽️</p>
            <p className="font-medium">Aucun produit dans cette catégorie</p>
          </div>
        )}
      </div>

      {/* ── Sticky bottom bar ───────────────────────────────── */}
      {itemCount > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-40 p-4 bg-white border-t border-gray-200 shadow-2xl">
          <button
            onClick={() => setShowCart(true)}
            className="w-full bg-[#F5A800] hover:bg-[#FF6B00] text-black font-black py-4 rounded-2xl text-base transition-all active:scale-[0.99] flex items-center justify-between px-6 shadow-lg shadow-[#F5A800]/30"
          >
            <span className="bg-black/15 rounded-lg px-2.5 py-0.5 text-sm font-black">
              {itemCount}
            </span>
            <span>Voir ma commande</span>
            <span className="font-black">{total.toFixed(2)} DT</span>
          </button>
        </div>
      )}

      {/* ── Supplement selection modal ──────────────────────── */}
      {configProduct && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl">

            {/* Header */}
            <div className="p-5 border-b flex items-center gap-4 shrink-0">
              <div className={`w-14 h-14 rounded-2xl bg-linear-to-br ${getCardStyle(configProduct.name.fr).gradient} flex items-center justify-center shrink-0`}>
                <span className="text-3xl">{getCardStyle(configProduct.name.fr).emoji}</span>
              </div>
              <div className="flex-1">
                <p className="font-black text-[#1A1A1A] text-base">{configProduct.name.fr}</p>
                <p className="text-[#F5A800] font-bold text-sm">{configProduct.price.toFixed(2)} DT base</p>
              </div>
              <button onClick={() => setConfigProduct(null)} className="p-2 hover:bg-gray-100 rounded-xl shrink-0">
                <X size={20} />
              </button>
            </div>

            {/* Supplement groups */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {[
                { label: '🥫 Sauces', list: configProduct.supplements.filter((s) => s.type === 'sauce') },
                { label: '📐 Taille', list: configProduct.supplements.filter((s) => s.type === 'size') },
                { label: '✨ Extras', list: configProduct.supplements.filter((s) => s.type === 'extra') },
              ].filter(({ list }) => list.length > 0).map(({ label, list }) => (
                <div key={label}>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">{label}</p>
                  <div className="flex flex-wrap gap-2">
                    {list.map((s) => {
                      const active = !!pendingSupps.find((x) => x._id === s._id)
                      return (
                        <button
                          key={s._id}
                          onClick={() => togglePendingSupp(s)}
                          className={`flex items-center gap-2 px-4 py-2.5 rounded-full border-2 text-sm font-semibold transition-all active:scale-95 ${
                            active
                              ? 'bg-[#F5A800] border-[#F5A800] text-black shadow-md'
                              : 'border-gray-200 text-gray-600 hover:border-[#F5A800]/50 bg-white'
                          }`}
                        >
                          {active && <Check size={13} />}
                          <span>{s.name.fr}</span>
                          {s.price > 0 && (
                            <span className={`font-black text-xs ${active ? 'text-black/60' : 'text-[#F5A800]'}`}>
                              +{s.price} DT
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Confirm button */}
            <div className="p-5 border-t shrink-0">
              <button
                onClick={confirmConfig}
                className="w-full bg-[#1A1A1A] hover:bg-[#F5A800] text-white hover:text-black font-black py-4 rounded-2xl transition-all text-sm active:scale-[0.98]"
              >
                Ajouter — {(configProduct.price + pendingSupps.reduce((s, x) => s + x.price, 0)).toFixed(2)} DT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Cart review modal ───────────────────────────────── */}
      {showCart && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md max-h-[92vh] flex flex-col shadow-2xl">

            {/* Header */}
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

            {/* Order type toggle */}
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

            {/* Cart items */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {cart.map((it) => {
                const { emoji, gradient } = getCardStyle(it.name.fr)
                const linePrice = (it.price + it.selectedSupplements.reduce((s, x) => s + x.price, 0)) * it.quantity
                return (
                  <div key={it.uid} className="flex items-start gap-3 bg-gray-50 rounded-2xl p-3.5">
                    {/* Mini icon */}
                    <div className={`w-10 h-10 shrink-0 rounded-xl bg-linear-to-br ${gradient} flex items-center justify-center`}>
                      <span className="text-xl">{emoji}</span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-[#1A1A1A] truncate">{it.name.fr}</p>
                      {it.selectedSupplements.length > 0 && (
                        <p className="text-[10px] text-gray-400 mt-0.5 truncate">
                          + {it.selectedSupplements.map((s) => s.name.fr).join(', ')}
                        </p>
                      )}
                      <p className="font-black text-[#F5A800] text-sm mt-0.5">{linePrice.toFixed(2)} DT</p>
                    </div>

                    {/* Qty controls */}
                    <div className="flex items-center gap-1 bg-white border rounded-xl p-1 shrink-0">
                      <button
                        onClick={() => updateQty(it.uid, it.quantity - 1)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors"
                      >
                        {it.quantity === 1
                          ? <Trash2 size={13} className="text-red-400" />
                          : <Minus size={13} />
                        }
                      </button>
                      <span className="w-6 text-center text-sm font-bold">{it.quantity}</span>
                      <button
                        onClick={() => updateQty(it.uid, it.quantity + 1)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors"
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Total + submit */}
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
