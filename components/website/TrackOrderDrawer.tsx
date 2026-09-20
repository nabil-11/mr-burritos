'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Search, PackageSearch, ChevronRight, RefreshCw } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { normalizeTnPhone } from '@/lib/phone'
import { STATUS_SHORT, TrackedOrder, isFinal, payableTotal, readyAt, shopClock } from '@/lib/orderProgress'
import { loadCustomer, loadOrders } from '@/lib/webMemory'

const BADGE: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  confirmed: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  preparing: 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
  ready: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  delivered: 'bg-muted text-muted-foreground',
  cancelled: 'bg-red-500/15 text-red-700 dark:text-red-300',
}

const fmtDay = (d: string) =>
  new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'Africa/Tunis' }) +
  ' · ' +
  shopClock(new Date(d))

function OrderRow({ order, onOpen }: { order: TrackedOrder; onOpen: () => void }) {
  const eta = readyAt(order)
  return (
    <Link
      href={`/order/${order._id}`}
      onClick={onOpen}
      className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/60 transition-colors"
    >
      <span className="w-10 h-10 rounded-xl bg-[#F5A800]/12 grid place-items-center text-lg shrink-0">
        {order.type === 'delivery' ? '🛵' : '🏪'}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-black text-sm text-foreground truncate">{order.orderNumber}</span>
        <span className="block text-[11px] text-muted-foreground mt-0.5">{fmtDay(order.createdAt)}</span>
      </span>
      <span className="flex flex-col items-end gap-1 shrink-0">
        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${BADGE[order.status] ?? BADGE.pending}`}>
          {STATUS_SHORT[order.status] ?? 'En attente'}
          {eta ? ` · ${shopClock(eta)}` : ''}
        </span>
        <span className="text-xs font-black text-foreground tabular-nums">{payableTotal(order).toFixed(2)} DT</span>
      </span>
      <ChevronRight size={16} className="text-muted-foreground shrink-0" />
    </Link>
  )
}

/**
 * "Where is my order?" — answered without a form for anyone who ordered from
 * this device (the browser remembers which orders it placed), and with a phone
 * number for everyone else. Every row opens the live order page.
 */
export default function TrackOrderDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [found, setFound] = useState<TrackedOrder[] | null>(null)
  const [mine, setMine] = useState<TrackedOrder[]>([])
  const [error, setError] = useState('')

  const loadMine = useCallback(async () => {
    const ids = loadOrders().map((o) => o.id)
    if (!ids.length) return setMine([])
    try {
      const res = await fetch(`/api/orders/track?ids=${ids.join(',')}`, { cache: 'no-store' })
      if (res.ok) setMine(await res.json())
    } catch {
      // offline: keep the last list
    }
  }, [])

  // Opened: prefill the number used last time and show this device's orders.
  // While open, refresh every 30 s if any of them is still moving.
  useEffect(() => {
    if (!open) return
    const saved = loadCustomer()
    if (saved?.phone) setPhone((p) => p || saved.phone)
    const first = setTimeout(loadMine, 0)
    const id = setInterval(loadMine, 30_000)
    return () => {
      clearTimeout(first)
      clearInterval(id)
    }
  }, [open, loadMine])

  const search = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const digits = normalizeTnPhone(phone)
    if (!digits) return setError('Entrez un numéro à 8 chiffres.')
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`/api/orders/track?phone=${digits}`, { cache: 'no-store' })
      const data = await res.json()
      setFound(Array.isArray(data) ? data : [])
    } catch {
      setError('Connexion impossible, réessayez.')
    } finally {
      setLoading(false)
    }
  }

  const activeMine = mine.filter((o) => !isFinal(o.status))
  const pastMine = mine.filter((o) => isFinal(o.status)).slice(0, 5)

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="left"
        className="data-[side=left]:w-full data-[side=left]:sm:max-w-md flex flex-col gap-0 p-0 bg-background"
      >
        <SheetHeader className="px-5 py-4 border-b border-border">
          <SheetTitle className="flex items-center gap-2 text-foreground">
            <PackageSearch size={18} className="text-[#F5A800]" /> Suivre ma commande
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {mine.length > 0 && (
            <section className="border-b border-border">
              <div className="px-5 pt-4 pb-1 flex items-center justify-between">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                  Commandes de cet appareil
                </p>
                <button
                  onClick={loadMine}
                  className="text-muted-foreground hover:text-foreground p-1"
                  aria-label="Actualiser"
                >
                  <RefreshCw size={13} />
                </button>
              </div>
              {[...activeMine, ...pastMine].map((o) => (
                <OrderRow key={o._id} order={o} onOpen={onClose} />
              ))}
            </section>
          )}

          <form onSubmit={search} className="px-5 py-5 space-y-2">
            <label htmlFor="track-phone" className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
              {mine.length ? 'Une autre commande ? Votre numéro' : 'Votre numéro de téléphone'}
            </label>
            <div className="flex gap-2">
              <input
                id="track-phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder="99 123 456"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^\d+ ]/g, ''))}
                className="flex-1 min-w-0 px-3.5 py-2.5 rounded-xl border border-border bg-card text-sm font-semibold text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-[#F5A800] transition-colors"
              />
              <button
                type="submit"
                disabled={loading}
                className="flex items-center justify-center gap-2 bg-[#F5A800] hover:bg-[#FF6B00] disabled:opacity-60 text-black font-black px-4 rounded-xl text-sm transition-colors"
              >
                <Search size={15} />
                {loading ? '…' : 'Chercher'}
              </button>
            </div>
            {error && <p className="text-xs font-bold text-red-600 dark:text-red-400">{error}</p>}
          </form>

          {found !== null &&
            (found.length === 0 ? (
              <div className="px-6 pb-8 text-center">
                <p className="text-3xl mb-2">🔍</p>
                <p className="font-bold text-foreground text-sm">Aucune commande avec ce numéro</p>
                <p className="text-xs text-muted-foreground mt-1">Vérifiez le numéro utilisé pour commander.</p>
              </div>
            ) : (
              <section className="border-t border-border">
                <p className="px-5 pt-4 pb-1 text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                  {found.length} commande{found.length > 1 ? 's' : ''}
                </p>
                {found.map((o) => (
                  <OrderRow key={o._id} order={o} onOpen={onClose} />
                ))}
              </section>
            ))}

          {found === null && mine.length === 0 && (
            <div className="px-8 pb-10 pt-4 flex flex-col items-center text-center gap-3 text-muted-foreground">
              <PackageSearch size={44} className="opacity-30" />
              <p className="text-sm">Entrez le numéro utilisé pour commander : vous verrez où en est votre commande, en direct.</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
