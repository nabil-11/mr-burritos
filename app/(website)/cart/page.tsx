'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, BadgePercent, Clock, LocateFixed, Loader2, MapPin, ShoppingBag, Store, Bike, Check } from 'lucide-react'
import { toOrderLine, useCart } from '@/contexts/CartContext'
import CartLine from '@/components/website/CartLine'
import { useCartQuote } from '@/hooks/useCartQuote'
import { useOpenState } from '@/hooks/useOpenState'
import { PREP_MINUTES } from '@/lib/hours'
import { normalizeTnPhone } from '@/lib/phone'
import { WEB_PROMO, applyWebPromo } from '@/lib/promo'
import { loadCustomer, rememberOrder, saveCustomer } from '@/lib/webMemory'

type OrderType = 'delivery' | 'pickup'
type Field = 'name' | 'phone' | 'address'

const TYPES: { value: OrderType; label: string; hint: string; icon: typeof Bike }[] = [
  { value: 'delivery', label: 'Livraison', hint: 'Frais 2 à 7 DT, confirmés par téléphone', icon: Bike },
  { value: 'pickup', label: 'À emporter', hint: `Prête en ~${PREP_MINUTES} min · Ariana`, icon: Store },
]

const inputCls = (bad: boolean) =>
  `w-full rounded-xl border bg-background px-3.5 py-3 text-sm font-semibold text-foreground placeholder:text-muted-foreground/60 outline-none transition-colors focus:border-[#F5A800] ${
    bad ? 'border-red-500' : 'border-border'
  }`

export default function CartPage() {
  const { items, total, clearCart, hydrated } = useCart()
  const { problems, blocking } = useCartQuote()
  const open = useOpenState()
  const router = useRouter()
  // `total` is the food; `payable` is what the customer owes after the
  // online-ordering discount — the same function the server applies.
  const { discount, total: payable } = applyWebPromo(total)

  const [type, setType] = useState<OrderType>('delivery')
  const [form, setForm] = useState({ name: '', phone: '', address: '', notes: '' })
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null)
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})
  const [locating, setLocating] = useState(false)
  const [sending, setSending] = useState(false)
  const [closedAt, setClosedAt] = useState<string | null>(null)
  const submitLock = useRef(false)
  const refs = {
    name: useRef<HTMLInputElement>(null),
    phone: useRef<HTMLInputElement>(null),
    address: useRef<HTMLInputElement>(null),
  }

  // A returning customer finds the form already filled in — kept on this
  // device only, never on the server.
  useEffect(() => {
    const saved = loadCustomer()
    if (!saved) return
    const id = setTimeout(() => {
      setForm((f) => ({
        ...f,
        name: f.name || saved.name,
        phone: f.phone || saved.phone,
        address: f.address || saved.address,
      }))
      setType(saved.type)
    }, 0)
    return () => clearTimeout(id)
  }, [])

  const set = (field: keyof typeof form, value: string) => {
    setForm((f) => ({ ...f, [field]: value }))
    if (errors[field as Field]) setErrors((e) => ({ ...e, [field]: undefined }))
  }

  // The server says the same thing; saying it here spares a round trip.
  const isClosed = closedAt !== null || (open !== null && !open.open)
  const opensAt = closedAt ?? open?.at ?? ''

  const validate = () => {
    const next: Partial<Record<Field, string>> = {}
    if (!form.name.trim()) next.name = 'Votre prénom, pour vous appeler au comptoir'
    if (!normalizeTnPhone(form.phone)) next.phone = '8 chiffres, ex. 99 123 456'
    if (type === 'delivery' && !form.address.trim()) next.address = 'Où devons-nous livrer ?'
    setErrors(next)
    const first = (['name', 'phone', 'address'] as Field[]).find((f) => next[f])
    if (first) refs[first].current?.focus()
    return !first
  }

  const locate = () => {
    if (!navigator.geolocation) return toast.error("La géolocalisation n'est pas disponible sur cet appareil")
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async ({ coords: c }) => {
        // The coordinates travel with the order, so the driver can navigate
        // to the door even when the typed address is vague.
        setCoords({ latitude: c.latitude, longitude: c.longitude })
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${c.latitude}&lon=${c.longitude}&format=json&addressdetails=1&accept-language=fr`
          )
          const data = await res.json()
          const a = data?.address ?? {}
          const parts = [a.road, a.neighbourhood ?? a.suburb, a.city ?? a.town ?? a.village].filter(Boolean)
          if (parts.length) set('address', parts.join(', '))
          toast.success('Position ajoutée — précisez le bâtiment et l’étage si besoin')
        } catch {
          toast.success('Position GPS ajoutée à la commande')
        } finally {
          setLocating(false)
        }
      },
      (err) => {
        setLocating(false)
        toast.error(
          err.code === err.PERMISSION_DENIED
            ? 'Localisation refusée — saisissez votre adresse'
            : 'Position introuvable — saisissez votre adresse'
        )
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    )
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitLock.current || items.length === 0) return
    if (isClosed) return toast.error(`Nous sommes fermés — commandes en ligne dès ${opensAt}`)
    if (blocking) return toast.error('Retirez d’abord les articles indisponibles')
    if (!validate()) return

    submitLock.current = true
    setSending(true)
    try {
      const phone = normalizeTnPhone(form.phone)!
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: {
            name: form.name.trim(),
            phone,
            address: type === 'delivery' ? form.address.trim() : '',
            ...(type === 'delivery' && coords ? coords : {}),
          },
          items: items.map(toOrderLine),
          subtotal: total,
          discount,
          total: payable,
          type,
          source: 'website',
          notes: form.notes.trim(),
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        if (data?.closed) setClosedAt(String(data.opensAt ?? ''))
        throw new Error(data?.error || 'Une erreur est survenue, réessayez')
      }

      saveCustomer({ name: form.name.trim(), phone, address: form.address.trim(), type })
      rememberOrder({ id: String(data._id), number: String(data.orderNumber), at: new Date().toISOString() })
      router.push(`/order/${data._id}?merci=1`)
      clearCart()
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : 'Une erreur est survenue, réessayez')
      submitLock.current = false
      setSending(false)
    }
  }

  // Also while leaving for the order page: the basket is emptied as the
  // order is accepted, and "votre panier est vide" must not flash meanwhile.
  if (!hydrated || (sending && items.length === 0)) {
    return (
      <div className="min-h-[70vh] grid place-items-center">
        <Loader2 className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4 px-4 pt-20 text-center">
        <div className="w-24 h-24 rounded-full bg-muted grid place-items-center text-5xl">🌯</div>
        <h1 className="text-2xl font-black text-foreground">Votre panier est vide</h1>
        <p className="text-muted-foreground max-w-xs">
          Composez votre tacos ou votre burrito — {WEB_PROMO.badge} sur toute commande en ligne.
        </p>
        <Link
          href="/#composer"
          className="bg-[#F5A800] hover:bg-[#FF6B00] text-black font-black px-8 py-3 rounded-full transition-colors"
        >
          Voir le menu
        </Link>
      </div>
    )
  }

  const canSend = !sending && !isClosed && !blocking
  const buttonLabel = sending
    ? 'Envoi…'
    : isClosed
      ? `Fermé · ouvre à ${opensAt}`
      : `Commander · ${payable.toFixed(2)} DT`

  return (
    <div className="pt-24 pb-28 lg:pb-16">
      <div className="max-w-5xl mx-auto px-4">
        <Link
          href="/#composer"
          className="inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-[#F5A800] transition-colors"
        >
          <ArrowLeft size={15} /> Continuer mes achats
        </Link>
        <h1 className="text-3xl font-black text-foreground mt-3 mb-6">Finaliser la commande</h1>

        {isClosed && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3.5">
            <Clock size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-sm text-foreground">
              <span className="font-black">Nous sommes fermés.</span> Les commandes en ligne reprennent à{' '}
              <span className="font-black">{opensAt}</span> — votre panier vous attend ici.
            </p>
          </div>
        )}

        <form id="checkout" onSubmit={submit} noValidate className="grid lg:grid-cols-5 gap-6 items-start">
          <div className="lg:col-span-3 space-y-5">
            {/* 1 — How */}
            <section className="rounded-3xl border border-border bg-card p-5">
              <h2 className="font-black text-foreground mb-3">1. Livraison ou à emporter ?</h2>
              <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Mode de commande">
                {TYPES.map((t) => {
                  const on = type === t.value
                  return (
                    <button
                      key={t.value}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setType(t.value)}
                      className={`relative text-left rounded-2xl border-2 p-4 transition-all ${
                        on ? 'border-[#F5A800] bg-[#F5A800]/8' : 'border-border hover:border-[#F5A800]/50'
                      }`}
                    >
                      {on && (
                        <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-[#F5A800] text-black grid place-items-center">
                          <Check size={12} strokeWidth={3} />
                        </span>
                      )}
                      <t.icon size={22} className={on ? 'text-[#F5A800]' : 'text-muted-foreground'} />
                      <p className="font-black text-foreground mt-2">{t.label}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{t.hint}</p>
                    </button>
                  )
                })}
              </div>
            </section>

            {/* 2 — Who and where */}
            <section className="rounded-3xl border border-border bg-card p-5 space-y-4">
              <h2 className="font-black text-foreground">2. Vos coordonnées</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="c-name" className="text-xs font-bold text-muted-foreground">
                    Prénom
                  </label>
                  <input
                    id="c-name"
                    ref={refs.name}
                    value={form.name}
                    onChange={(e) => set('name', e.target.value)}
                    autoComplete="given-name"
                    placeholder="Votre prénom"
                    maxLength={80}
                    aria-invalid={!!errors.name}
                    className={inputCls(!!errors.name)}
                  />
                  {errors.name && <p className="text-xs font-semibold text-red-600 dark:text-red-400">{errors.name}</p>}
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="c-phone" className="text-xs font-bold text-muted-foreground">
                    Téléphone
                  </label>
                  <input
                    id="c-phone"
                    ref={refs.phone}
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    value={form.phone}
                    onChange={(e) => set('phone', e.target.value.replace(/[^\d+ ]/g, ''))}
                    onBlur={() =>
                      form.phone && !normalizeTnPhone(form.phone) && setErrors((x) => ({ ...x, phone: '8 chiffres, ex. 99 123 456' }))
                    }
                    placeholder="99 123 456"
                    maxLength={17}
                    aria-invalid={!!errors.phone}
                    className={inputCls(!!errors.phone)}
                  />
                  {errors.phone ? (
                    <p className="text-xs font-semibold text-red-600 dark:text-red-400">{errors.phone}</p>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">Nous vous appelons pour confirmer.</p>
                  )}
                </div>
              </div>

              {type === 'delivery' && (
                <div className="space-y-1.5">
                  <label htmlFor="c-address" className="text-xs font-bold text-muted-foreground">
                    Adresse de livraison
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="c-address"
                      ref={refs.address}
                      value={form.address}
                      onChange={(e) => set('address', e.target.value)}
                      autoComplete="street-address"
                      placeholder="Rue, immeuble, étage…"
                      maxLength={300}
                      aria-invalid={!!errors.address}
                      className={inputCls(!!errors.address)}
                    />
                    <button
                      type="button"
                      onClick={locate}
                      disabled={locating}
                      className={`shrink-0 flex items-center gap-1.5 rounded-xl border px-3 text-xs font-black transition-colors disabled:opacity-60 ${
                        coords
                          ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                          : 'border-border hover:border-[#F5A800] text-foreground'
                      }`}
                      title="Utiliser ma position"
                    >
                      {locating ? <Loader2 size={16} className="animate-spin" /> : <LocateFixed size={16} />}
                      <span className="hidden sm:inline">{coords ? 'Position ajoutée' : 'Ma position'}</span>
                    </button>
                  </div>
                  {errors.address ? (
                    <p className="text-xs font-semibold text-red-600 dark:text-red-400">{errors.address}</p>
                  ) : coords ? (
                    <p className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                      <MapPin size={11} /> Position GPS jointe pour le livreur
                    </p>
                  ) : null}
                </div>
              )}

              <div className="space-y-1.5">
                <label htmlFor="c-notes" className="text-xs font-bold text-muted-foreground">
                  Précisions <span className="font-normal">(facultatif)</span>
                </label>
                <textarea
                  id="c-notes"
                  value={form.notes}
                  onChange={(e) => set('notes', e.target.value)}
                  rows={2}
                  maxLength={500}
                  placeholder={type === 'delivery' ? 'Sans oignons, code de la porte, sonner 2 fois…' : 'Sans oignons, bien grillé…'}
                  className={`${inputCls(false)} resize-none`}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Vos coordonnées restent sur cet appareil pour votre prochaine commande.
              </p>
            </section>
          </div>

          {/* 3 — The basket and the total */}
          <aside className="lg:col-span-2 lg:sticky lg:top-24 rounded-3xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-black text-foreground flex items-center gap-2">
                <ShoppingBag size={16} className="text-[#F5A800]" /> 3. Votre panier
              </h2>
              <Link href="/#composer" className="text-xs font-bold text-muted-foreground hover:text-[#F5A800]">
                + Ajouter
              </Link>
            </div>
            <div className="space-y-2.5">
              {items.map((item) => (
                <CartLine key={item.id} item={item} problem={problems[item.id]} compact />
              ))}
            </div>

            <div className="space-y-2 text-sm border-t border-border pt-4">
              <div className="flex justify-between text-muted-foreground">
                <span>Sous-total</span>
                <span className="tabular-nums">{total.toFixed(2)} DT</span>
              </div>
              <div className="flex justify-between font-semibold text-emerald-600 dark:text-emerald-400">
                <span className="flex items-center gap-1.5">
                  <BadgePercent size={14} /> {WEB_PROMO.label} ({WEB_PROMO.badge})
                </span>
                <span className="tabular-nums">− {discount.amount.toFixed(2)} DT</span>
              </div>
              {type === 'delivery' && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Livraison</span>
                  <span>2 à 7 DT, confirmés par appel</span>
                </div>
              )}
              <div className="flex justify-between items-baseline border-t border-border pt-3">
                <span className="font-black text-foreground">{type === 'delivery' ? 'Total hors livraison' : 'Total'}</span>
                <span className="font-black text-2xl text-[#F5A800] tabular-nums">{payable.toFixed(2)} DT</span>
              </div>
              <p className="text-center text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                Vous économisez {discount.amount.toFixed(2)} DT en commandant en ligne
              </p>
            </div>

            <button
              type="submit"
              disabled={!canSend}
              className="hidden lg:flex w-full items-center justify-center gap-2 bg-[#F5A800] hover:bg-[#FF6B00] disabled:opacity-50 disabled:hover:bg-[#F5A800] text-black font-black py-4 rounded-2xl transition-colors"
            >
              {sending && <Loader2 size={16} className="animate-spin" />} {buttonLabel}
            </button>
            <p className="text-center text-[11px] text-muted-foreground">
              Paiement à la {type === 'delivery' ? 'livraison' : 'récupération'} · suivi en direct après l’envoi
            </p>
          </aside>
        </form>
      </div>

      {/* On a phone the button follows the thumb instead of waiting at the bottom of a long page. */}
      <div className="lg:hidden fixed inset-x-0 bottom-0 z-40 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-linear-to-t from-background via-background/95 to-transparent">
        <button
          type="submit"
          form="checkout"
          disabled={!canSend}
          className="w-full flex items-center justify-center gap-2 bg-[#F5A800] active:bg-[#FF6B00] disabled:opacity-60 text-black font-black py-4 rounded-2xl shadow-xl shadow-black/25"
        >
          {sending && <Loader2 size={16} className="animate-spin" />} {buttonLabel}
        </button>
      </div>
    </div>
  )
}
