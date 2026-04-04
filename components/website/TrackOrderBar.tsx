'use client'

import { useState, useRef, useEffect } from 'react'
import { Phone, Search, X, Clock, CheckCircle2, ChefHat, Package, XCircle, Timer } from 'lucide-react'
import { toast } from 'sonner'
import type { LucideIcon } from 'lucide-react'

type Order = {
  _id: string
  orderNumber: string
  status: string
  total: number
  type: string
  createdAt: string
  confirmedAt?: string
  preparationDuration?: number
}

type StatusInfo = { label: string; color: string; icon: LucideIcon }

const STATUS: Record<string, StatusInfo> = {
  pending:   { label: 'En attente',     color: 'bg-yellow-100 text-yellow-700',   icon: Clock },
  confirmed: { label: 'Confirmée',       color: 'bg-blue-100 text-blue-700',       icon: CheckCircle2 },
  preparing: { label: 'En préparation', color: 'bg-orange-100 text-orange-700',   icon: ChefHat },
  ready:     { label: 'Prête',          color: 'bg-green-100 text-green-700',      icon: Package },
  delivered: { label: 'Livrée ✓',       color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  cancelled: { label: 'Annulée',        color: 'bg-red-100 text-red-600',         icon: XCircle },
}
const FALLBACK_STATUS: StatusInfo = { label: 'En attente', color: 'bg-gray-100 text-gray-600', icon: Clock }

function CountdownTimer({ confirmedAt, duration }: { confirmedAt: string; duration: number }) {
  const [remaining, setRemaining] = useState<number>(0)

  useEffect(() => {
    const calcRemaining = () => {
      const confirmed = new Date(confirmedAt).getTime()
      const end = confirmed + duration * 60 * 1000
      const now = Date.now()
      return Math.max(0, Math.floor((end - now) / 1000))
    }
    setRemaining(calcRemaining())
    const interval = setInterval(() => setRemaining(calcRemaining()), 1000)
    return () => clearInterval(interval)
  }, [confirmedAt, duration])

  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60

  if (remaining === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-red-100 text-red-700 animate-pulse">
        <Timer size={10} />
        En retard!
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-green-100 text-green-700">
      <Timer size={10} />
      {mins}:{secs.toString().padStart(2, '0')}
    </span>
  )
}

export default function TrackOrderBar() {
  const [phone, setPhone]     = useState('')
  const [loading, setLoading] = useState(false)
  const [orders, setOrders]   = useState<Order[] | null>(null)
  const [open, setOpen]       = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Auto-refresh every 30 seconds when dropdown is open
  useEffect(() => {
    if (!open || !orders || orders.length === 0) return
    const interval = setInterval(() => setRefreshKey(k => k + 1), 30000)
    return () => clearInterval(interval)
  }, [open, orders])

  const verify = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!phone.trim()) return toast.error('Entrez votre numéro de téléphone')
    setLoading(true)
    try {
      const res  = await fetch(`/api/orders/track?phone=${encodeURIComponent(phone.trim())}`)
      const data: Order[] = await res.json()
      setOrders(Array.isArray(data) ? data : [])
      setOpen(true)
      if (!Array.isArray(data) || data.length === 0) toast.info('Aucune commande trouvée')
    } catch {
      toast.error('Erreur, réessayez')
    } finally {
      setLoading(false)
    }
  }

  // Refresh orders when refreshKey changes
  useEffect(() => {
    if (!open || !phone.trim()) return
    fetch(`/api/orders/track?phone=${encodeURIComponent(phone.trim())}`)
      .then(res => res.json())
      .then((data: Order[]) => setOrders(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [refreshKey, open, phone])

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div ref={ref} className="relative w-full">
      {/* ── Bar ────────────────────────────────────────────── */}
      <form
        onSubmit={verify}
        className="bg-white rounded-2xl shadow-2xl shadow-black/25 flex flex-col sm:flex-row overflow-hidden"
      >
        {/* Phone input */}
        <div className="flex items-center gap-3 flex-1 px-5 py-4 border-b sm:border-b-0 sm:border-r border-gray-100">
          <Phone size={18} className="text-[#F5A800] shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">
              Numéro de téléphone
            </p>
            <input
              type="tel"
              placeholder="Ex : 99 123 456"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full text-sm font-semibold text-[#1A1A1A] placeholder:text-gray-300 outline-none bg-transparent"
            />
          </div>
          {phone && (
            <button type="button" onClick={() => { setPhone(''); setOrders(null); setOpen(false) }}
              className="text-gray-300 hover:text-gray-500 transition-colors">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Verify button */}
        <button
          type="submit"
          disabled={loading}
          className="flex items-center justify-center gap-2 bg-[#F5A800] hover:bg-[#FF6B00] disabled:opacity-60 text-black font-black px-8 py-4 text-sm transition-colors whitespace-nowrap"
        >
          <Search size={16} />
          {loading ? 'Recherche…' : 'Vérifier'}
        </button>
      </form>

      {/* ── Results dropdown ────────────────────────────────── */}
      {open && orders !== null && (
        <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-2xl shadow-black/15 border border-gray-100 overflow-hidden z-50">
          {orders.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <p className="text-3xl mb-2">🔍</p>
              <p className="font-bold text-[#1A1A1A] text-sm">Aucune commande trouvée</p>
              <p className="text-xs text-gray-400 mt-1">Vérifiez le numéro saisi</p>
            </div>
          ) : (
            <>
              <div className="px-5 py-3 border-b border-gray-50 flex items-center justify-between">
                <p className="text-xs font-black text-gray-500 uppercase tracking-widest">
                  {orders.length} commande{orders.length > 1 ? 's' : ''} trouvée{orders.length > 1 ? 's' : ''}
                </p>
                <div className="flex items-center gap-2">
                  <button 
                    type="button" 
                    onClick={() => setRefreshKey(k => k + 1)}
                    className="text-gray-400 hover:text-gray-600 text-xs font-bold"
                  >
                    ↻ Actualiser
                  </button>
                  <button type="button" onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                    <X size={14} />
                  </button>
                </div>
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
                {orders.map((order) => {
                  const s = STATUS[order.status] ?? FALLBACK_STATUS
                  const Icon = s.icon
                  return (
                    <div key={order._id} className="px-5 py-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-[#F5A800]/10 flex items-center justify-center shrink-0 text-base">
                            {order.type === 'delivery' ? '🛵' : '🏪'}
                          </div>
                          <div className="min-w-0">
                            <p className="font-black text-[#1A1A1A] text-sm">{order.orderNumber}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">{fmtDate(order.createdAt)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full ${s.color}`}>
                            <Icon size={10} />
                            {s.label}
                          </span>
                          {order.status === 'confirmed' && order.confirmedAt && order.preparationDuration && (
                            <CountdownTimer confirmedAt={order.confirmedAt} duration={order.preparationDuration} />
                          )}
                          {order.status === 'preparing' && order.preparationDuration && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-orange-100 text-orange-700">
                              <Timer size={10} />
                              {order.preparationDuration >= 60 ? '1h' : `${order.preparationDuration} min`}
                            </span>
                          )}
                          <p className="font-black text-[#F5A800] text-sm whitespace-nowrap">
                            {(order.total ?? 0).toFixed(2)} DT
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
