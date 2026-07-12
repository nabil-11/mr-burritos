'use client'

import { useState, useEffect } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Search, Clock, CheckCircle2, ChefHat, Package, XCircle, Timer, PackageSearch } from 'lucide-react'
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

export default function TrackOrderDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [phone, setPhone]     = useState('')
  const [loading, setLoading] = useState(false)
  const [orders, setOrders]   = useState<Order[] | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const verify = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!phone.trim()) return toast.error('Entrez votre numéro de téléphone')
    setLoading(true)
    try {
      const res  = await fetch(`/api/orders/track?phone=${encodeURIComponent(phone.trim())}`)
      const data: Order[] = await res.json()
      setOrders(Array.isArray(data) ? data : [])
      if (!Array.isArray(data) || data.length === 0) toast.info('Aucune commande trouvée')
    } catch {
      toast.error('Erreur, réessayez')
    } finally {
      setLoading(false)
    }
  }

  // Auto-refresh every 30 seconds while the drawer is open and showing orders
  useEffect(() => {
    if (!open || !orders || orders.length === 0) return
    const interval = setInterval(() => setRefreshKey((k) => k + 1), 30000)
    return () => clearInterval(interval)
  }, [open, orders])

  useEffect(() => {
    if (!open || !phone.trim()) return
    fetch(`/api/orders/track?phone=${encodeURIComponent(phone.trim())}`)
      .then((res) => res.json())
      .then((data: Order[]) => setOrders(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [refreshKey, open, phone])

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="left" className="w-full max-w-sm flex flex-col p-0">
        <SheetHeader className="px-5 py-4 border-b bg-[#1A1A1A] text-white">
          <SheetTitle className="text-white flex items-center gap-2">
            <PackageSearch size={18} className="text-[#F5A800]" /> Suivre ma commande
          </SheetTitle>
        </SheetHeader>

        {/* Search form */}
        <form onSubmit={verify} className="px-5 py-4 border-b space-y-2">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
            Numéro de téléphone
          </label>
          <div className="flex gap-2">
            <input
              type="tel"
              placeholder="Ex : 99 123 456"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="flex-1 min-w-0 px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-[#1A1A1A] placeholder:text-gray-300 outline-none focus:border-[#F5A800] transition-colors"
            />
            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-2 bg-[#F5A800] hover:bg-[#FF6B00] disabled:opacity-60 text-black font-black px-4 rounded-xl text-sm transition-colors whitespace-nowrap"
            >
              <Search size={15} />
              {loading ? '…' : 'Vérifier'}
            </button>
          </div>
        </form>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {orders === null ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-6 text-muted-foreground">
              <PackageSearch size={48} className="text-gray-200" />
              <p className="text-sm">Entrez votre numéro pour suivre vos commandes en temps réel.</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-center px-6">
              <p className="text-3xl mb-1">🔍</p>
              <p className="font-bold text-[#1A1A1A] text-sm">Aucune commande trouvée</p>
              <p className="text-xs text-gray-400">Vérifiez le numéro saisi</p>
            </div>
          ) : (
            <>
              <div className="px-5 py-3 flex items-center justify-between sticky top-0 bg-white border-b border-gray-50">
                <p className="text-xs font-black text-gray-500 uppercase tracking-widest">
                  {orders.length} commande{orders.length > 1 ? 's' : ''}
                </p>
                <button
                  type="button"
                  onClick={() => setRefreshKey((k) => k + 1)}
                  className="text-gray-400 hover:text-gray-600 text-xs font-bold"
                >
                  ↻ Actualiser
                </button>
              </div>
              <div className="divide-y divide-gray-50">
                {orders.map((order) => {
                  const s = STATUS[order.status] ?? FALLBACK_STATUS
                  const Icon = s.icon
                  return (
                    <div key={order._id} className="px-5 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-[#F5A800]/10 flex items-center justify-center shrink-0 text-base">
                            {order.type === 'delivery' ? '🛵' : '🏪'}
                          </div>
                          <div className="min-w-0">
                            <p className="font-black text-[#1A1A1A] text-sm">{order.orderNumber}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">{fmtDate(order.createdAt)}</p>
                          </div>
                        </div>
                        <p className="font-black text-[#F5A800] text-sm whitespace-nowrap">
                          {(order.total ?? 0).toFixed(2)} DT
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap mt-2 pl-12">
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
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
