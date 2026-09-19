'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Check, Phone, RotateCcw, Star, MapPin, Clock } from 'lucide-react'
import { useCart } from '@/contexts/CartContext'
import {
  TrackedOrder,
  headline,
  isFinal,
  progressSteps,
  readyAt,
  shopClock,
  stepIndex,
} from '@/lib/orderProgress'
import { SITE, whatsappLink } from '@/lib/site'
import { rememberOrder } from '@/lib/webMemory'

export interface OrderView extends TrackedOrder {
  subtotal: number
  deliveryFee: number
  discount: { label: string; rate: number; amount: number }
  notes: string
  customer: { firstName: string; phoneHint: string; address: string }
  items: {
    productId: string
    name: string
    nameAr: string
    image: string
    quantity: number
    unitPrice: number
    lineTotal: number
    details: string
    supplements: { _id: string; name: { fr: string; ar: string }; price: number }[]
  }[]
}

/** How often the page asks for news while something can still change. */
const POLL_MS = 15_000

const TONE: Record<string, string> = {
  wait: 'from-amber-500/20 border-amber-500/30',
  progress: 'from-sky-500/15 border-sky-500/30',
  done: 'from-emerald-500/20 border-emerald-500/30',
  bad: 'from-red-500/15 border-red-500/30',
}

/**
 * Minutes until the announced time. Null until mounted: the server's clock is
 * not the visitor's, and a count that changes during hydration is a mismatch.
 */
function useMinutesLeft(target: Date | null) {
  const [now, setNow] = useState<number | null>(null)
  const at = target?.getTime() ?? null
  useEffect(() => {
    if (at === null) return
    const tick = () => setNow(Date.now())
    const first = setTimeout(tick, 0)
    const id = setInterval(tick, 20_000)
    return () => {
      clearTimeout(first)
      clearInterval(id)
    }
  }, [at])
  if (at === null || now === null) return null
  return Math.ceil((at - now) / 60_000)
}

/** Absolute links in a WhatsApp message; the same on the server and in the browser. */
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '')

/**
 * The page a customer lands on after ordering, and comes back to from
 * "suivre": where the order is, when it will be ready, what was ordered.
 *
 * It keeps itself current — asking every 15 s while the tab is visible and
 * the order can still move, and at once when the customer comes back to the
 * tab — and says so in the tab title, so an order that turns "prête" is
 * noticed from another tab.
 */
export default function OrderLive({ initial, justPlaced }: { initial: OrderView; justPlaced: boolean }) {
  const [order, setOrder] = useState<OrderView>(initial)
  const router = useRouter()
  const { addItem } = useCart()
  const lastStatus = useRef(initial.status)

  // The link stays in this browser's list even when opened from elsewhere.
  useEffect(() => {
    rememberOrder({ id: initial._id, number: initial.orderNumber, at: initial.createdAt })
  }, [initial._id, initial.orderNumber, initial.createdAt])

  // Drop "?merci=1" so a reload or a shared link does not say "merci" again.
  useEffect(() => {
    if (justPlaced) window.history.replaceState(null, '', `/order/${initial._id}`)
  }, [justPlaced, initial._id])

  useEffect(() => {
    if (isFinal(order.status)) return
    let stopped = false
    const refresh = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const res = await fetch(`/api/orders/track?ids=${initial._id}`, { cache: 'no-store' })
        const [fresh] = res.ok ? ((await res.json()) as TrackedOrder[]) : []
        if (!fresh || stopped) return
        setOrder((o) => ({ ...o, ...fresh }))
      } catch {
        // offline for a moment: the next tick tries again
      }
    }
    const id = setInterval(refresh, POLL_MS)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      stopped = true
      clearInterval(id)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [initial._id, order.status])

  const head = headline(order)

  // The tab title carries the news; a buzz marks the moment it is ready.
  useEffect(() => {
    document.title = `${head.emoji} ${head.title} · ${order.orderNumber}`
    if (lastStatus.current !== order.status && order.status === 'ready') navigator.vibrate?.([120, 60, 120])
    lastStatus.current = order.status
  }, [head.emoji, head.title, order.orderNumber, order.status])

  const eta = readyAt(order)
  const minutes = useMinutesLeft(eta)
  const steps = progressSteps(order.type)
  const reached = stepIndex(order.status)
  const cancelled = order.status === 'cancelled'
  const delivery = order.type === 'delivery'
  const toPay = Math.round((order.total + (delivery ? order.deliveryFee : 0)) * 100) / 100

  const waText =
    `🌯 Commande ${order.orderNumber}\n` +
    `${delivery ? '🛵 Livraison' : '🏪 À emporter'} — ${order.customer.firstName}\n` +
    (delivery && order.customer.address ? `📍 ${order.customer.address}\n` : '') +
    `\n${order.items.map((i) => `- ${i.quantity}× ${i.name}${i.details ? ` (${i.details})` : ''} = ${i.lineTotal.toFixed(2)} DT`).join('\n')}` +
    (order.notes ? `\n\n📝 ${order.notes}` : '') +
    `\n\nTotal : ${order.total.toFixed(2)} DT${order.discount.amount ? ` (promo en ligne −${order.discount.amount.toFixed(2)} DT incluse)` : ''}` +
    (SITE_URL ? `\nSuivi : ${SITE_URL}/order/${order._id}` : '')
  const wa = whatsappLink(waText)

  const reorder = () => {
    for (const i of order.items) {
      if (!i.productId) continue
      addItem({
        productId: i.productId,
        name: { fr: i.name, ar: i.nameAr },
        price: i.unitPrice,
        image: i.image,
        quantity: i.quantity,
        selectedSupplements: i.supplements,
        notes: '',
      })
    }
    // The cart checks every line against today's menu and prices.
    router.push('/cart')
  }

  return (
    <div className="pt-24 pb-16">
      <div className="max-w-xl mx-auto px-4 space-y-5">
        {justPlaced && (
          <div className="text-center">
            <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
              Merci{order.customer.firstName ? ` ${order.customer.firstName}` : ''} ! Votre commande est bien partie.
            </p>
          </div>
        )}

        {/* ── Where it stands ─────────────────────────────────────────── */}
        <section
          className={`rounded-3xl border bg-linear-to-b to-card p-6 text-center ${TONE[head.tone]}`}
          aria-live="polite"
        >
          <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
            Commande {order.orderNumber}
          </p>
          <p className="text-5xl mt-4" aria-hidden>
            {head.emoji}
          </p>
          <h1 className="text-2xl sm:text-3xl font-black text-foreground mt-3">{head.title}</h1>
          <p className="text-sm text-muted-foreground mt-1.5">{head.detail}</p>

          {eta && minutes !== null && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-background/70 border border-border px-4 py-2">
              <Clock size={15} className="text-[#F5A800]" />
              <span className="text-sm font-black text-foreground tabular-nums">
                {minutes > 0 ? `~${minutes} min` : 'D’un instant à l’autre'}
              </span>
              <span className="text-xs text-muted-foreground">· {shopClock(eta)}</span>
            </div>
          )}

          {!cancelled && (
            <ol className="mt-6 grid grid-cols-5 gap-1">
              {steps.map((s, i) => {
                const done = i < reached || order.status === 'delivered'
                const current = i === reached && order.status !== 'delivered'
                return (
                  <li key={s.status} className="flex flex-col items-center gap-1.5">
                    <span className="relative w-full flex items-center justify-center">
                      {i > 0 && (
                        <span
                          className={`absolute right-1/2 mr-3.5 w-[calc(100%-1.75rem)] h-0.5 rounded ${
                            i <= reached ? 'bg-[#F5A800]' : 'bg-border'
                          }`}
                          aria-hidden
                        />
                      )}
                      <span
                        className={`relative z-10 w-7 h-7 rounded-full grid place-items-center text-[11px] font-black transition-all ${
                          done
                            ? 'bg-[#F5A800] text-black'
                            : current
                              ? 'bg-foreground text-background ring-4 ring-[#F5A800]/40'
                              : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {done ? <Check size={14} strokeWidth={3} /> : i + 1}
                      </span>
                    </span>
                    <span
                      className={`text-[10px] sm:text-[11px] font-bold leading-tight ${
                        current || done ? 'text-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      {s.label}
                    </span>
                  </li>
                )
              })}
            </ol>
          )}

          {!isFinal(order.status) && (
            <p className="mt-5 text-[11px] text-muted-foreground">
              Cette page se met à jour toute seule — gardez-la ouverte.
            </p>
          )}
        </section>

        {/* ── Reach the shop ──────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center justify-center gap-2 rounded-2xl font-black text-sm py-3.5 transition-colors ${
                order.status === 'pending'
                  ? 'bg-[#25D366] hover:bg-[#1ebe5b] text-white col-span-2'
                  : 'border border-border bg-card text-foreground hover:border-[#25D366]'
              }`}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4.5 h-4.5 shrink-0" aria-hidden>
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              {order.status === 'pending' ? 'Envoyer aussi sur WhatsApp' : 'WhatsApp'}
            </a>
          )}
          <a
            href={`tel:${SITE.phone.replace(/\s/g, '')}`}
            className={`flex items-center justify-center gap-2 rounded-2xl border border-border bg-card text-foreground font-black text-sm py-3.5 hover:border-[#F5A800] transition-colors ${
              wa && order.status !== 'pending' ? '' : 'col-span-2'
            }`}
          >
            <Phone size={16} className="text-[#F5A800]" /> Appeler le restaurant
          </a>
        </div>

        {/* ── What was ordered ────────────────────────────────────────── */}
        <section className="rounded-3xl border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="font-black text-foreground">Votre commande</h2>
            <span className="text-xs font-bold text-muted-foreground">
              {delivery ? '🛵 Livraison' : '🏪 À emporter'}
            </span>
          </div>

          <ul className="space-y-3">
            {order.items.map((i, k) => (
              <li key={k} className="flex gap-3">
                <span className="relative w-12 h-12 shrink-0 overflow-hidden rounded-xl bg-muted">
                  {i.image ? (
                    <Image src={i.image} alt="" fill sizes="48px" className="object-cover" />
                  ) : (
                    <span className="absolute inset-0 grid place-items-center text-xl">🌯</span>
                  )}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-bold text-foreground">
                    {i.quantity}× {i.name}
                  </span>
                  {i.details && <span className="block text-xs text-muted-foreground mt-0.5">{i.details}</span>}
                </span>
                <span className="text-sm font-black text-foreground tabular-nums">{i.lineTotal.toFixed(2)} DT</span>
              </li>
            ))}
          </ul>

          <div className="mt-4 pt-4 border-t border-border space-y-1.5 text-sm">
            {order.discount.amount > 0 && (
              <>
                <div className="flex justify-between text-muted-foreground">
                  <span>Sous-total</span>
                  <span className="tabular-nums">{order.subtotal.toFixed(2)} DT</span>
                </div>
                <div className="flex justify-between font-semibold text-emerald-600 dark:text-emerald-400">
                  <span>
                    {order.discount.label || 'Remise'}
                    {order.discount.rate ? ` (−${Math.round(order.discount.rate * 100)}%)` : ''}
                  </span>
                  <span className="tabular-nums">− {order.discount.amount.toFixed(2)} DT</span>
                </div>
              </>
            )}
            {delivery && (
              <div className="flex justify-between text-muted-foreground">
                <span>Livraison</span>
                <span className="tabular-nums">
                  {order.deliveryFee > 0 ? `${order.deliveryFee.toFixed(2)} DT` : 'confirmée par appel'}
                </span>
              </div>
            )}
            <div className="flex justify-between items-baseline pt-2">
              <span className="font-black text-foreground">À payer</span>
              <span className="font-black text-xl text-[#F5A800] tabular-nums">{toPay.toFixed(2)} DT</span>
            </div>
            <p className="text-[11px] text-muted-foreground text-right">
              à la {delivery ? 'livraison' : 'récupération'}
            </p>
          </div>

          {(order.customer.address || order.notes || order.customer.phoneHint) && (
            <div className="mt-4 pt-4 border-t border-border space-y-1.5 text-xs text-muted-foreground">
              {delivery && order.customer.address && (
                <p className="flex items-start gap-2">
                  <MapPin size={13} className="shrink-0 mt-0.5 text-[#F5A800]" /> {order.customer.address}
                </p>
              )}
              {order.customer.phoneHint && (
                <p className="flex items-center gap-2">
                  <Phone size={13} className="shrink-0 text-[#F5A800]" /> {order.customer.phoneHint}
                </p>
              )}
              {order.notes && <p>📝 {order.notes}</p>}
            </div>
          )}
        </section>

        {/* ── After ───────────────────────────────────────────────────── */}
        <div className="grid sm:grid-cols-2 gap-3">
          <button
            onClick={reorder}
            className="flex items-center justify-center gap-2 bg-[#F5A800] hover:bg-[#FF6B00] text-black font-black py-3.5 rounded-2xl transition-colors text-sm"
          >
            <RotateCcw size={16} /> Commander la même chose
          </button>
          {order.status === 'delivered' ? (
            <Link
              href={`/avis?commande=${encodeURIComponent(order.orderNumber)}${
                order.customer.firstName ? `&nom=${encodeURIComponent(order.customer.firstName)}` : ''
              }`}
              className="flex items-center justify-center gap-2 border border-border bg-card hover:border-[#F5A800] text-foreground font-black py-3.5 rounded-2xl transition-colors text-sm"
            >
              <Star size={16} className="text-[#F5A800]" /> Donner mon avis
            </Link>
          ) : (
            <Link
              href="/"
              className="flex items-center justify-center border border-border bg-card hover:border-[#F5A800] text-foreground font-bold py-3.5 rounded-2xl transition-colors text-sm"
            >
              Retour à l&apos;accueil
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
