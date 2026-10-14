'use client'

import { createContext, useContext, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Ban, Lock, Pencil, Plus, Printer, RotateCcw, Undo2, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { MOVEMENT_LIST, MOVEMENT_META, type MovementKind } from '@/lib/movementKinds'
import type { SettlePayment } from '@/lib/correctionKinds'

/**
 * Corriger une recette depuis sa page : les commandes (plateforme, règlement,
 * montant, annulation), une vente oubliée, le comptage, un mouvement oublié.
 *
 * Tout passe par une seule route (POST /api/recettes/[id]/corrections) et
 * chaque geste demande sa raison : elle part au journal de la recette avec le
 * nom du responsable. Après coup, la page se recharge et un toast dit ce que
 * la correction a changé — au chiffre d'affaires, au tiroir, à l'écart.
 *
 * Le contexte porte ce que les dialogues ont besoin de savoir et lequel est
 * ouvert ; la page serveur n'a qu'à envelopper ses sections.
 */

export interface CorrectionCompany {
  id: string
  name: string
  commission: number
  isActive: boolean
}

export interface CorrectableOrder {
  id: string
  orderNumber: string
  time: string
  customer: string
  type: 'delivery' | 'pickup'
  sourceLabel: string
  status: string
  total: number
  companyId: string | null
  companyName: string
  paymentMethod: string | null
  /** Le versement de la plateforme est pointé : la commande est verrouillée. */
  payoutLocked: boolean
  payoutRef: string
  correction: number
}

export interface CorrectionRecette {
  id: string
  closed: boolean
  /** ISO. */
  openedAt: string
  /** ISO, ou null si encore ouverte. */
  closedAt: string | null
  openingFloat: number
  closingCash: number | null
  expectedCash: number
}

type OpenDialog =
  | { kind: 'order'; order: CorrectableOrder }
  | { kind: 'addSale' }
  | { kind: 'recount' }
  | { kind: 'addMovement' }
  | { kind: 'cancelMovement'; movement: { id: string; label: string; amount: number; kind: string } }

interface Ctx {
  canCorrect: boolean
  recette: CorrectionRecette
  companies: CorrectionCompany[]
  open: (d: OpenDialog) => void
}

const CorrectionsContext = createContext<Ctx | null>(null)

/** Null hors d'une page de recette, ou pour qui n'a pas le droit de corriger. */
export function useCorrections(): Ctx | null {
  const ctx = useContext(CorrectionsContext)
  return ctx?.canCorrect ? ctx : null
}

const money = (n: number) => `${(Number(n) || 0).toFixed(2)} DT`
const signed = (n: number) => `${n > 0.004 ? '+' : n < -0.004 ? '−' : ''}${Math.abs(n).toFixed(2)} DT`
const round2 = (n: number) => Math.round(n * 100) / 100
const parseAmount = (v: string) => {
  const n = Number(v.replace(',', '.').trim())
  return v.trim() !== '' && Number.isFinite(n) ? round2(n) : null
}
/** ISO → valeur d'un <input type="datetime-local">, à l'heure du navigateur. */
const toLocalInput = (iso: string) => {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function CorrectionsProvider({
  canCorrect,
  recette,
  companies,
  children,
}: {
  canCorrect: boolean
  recette: CorrectionRecette
  companies: CorrectionCompany[]
  children: React.ReactNode
}) {
  const [dialog, setDialog] = useState<OpenDialog | null>(null)
  const close = () => setDialog(null)
  const titles: Record<OpenDialog['kind'], string> = {
    order: 'Corriger la commande',
    addSale: 'Ajouter une vente oubliée',
    recount: 'Corriger le comptage',
    addMovement: 'Ajouter un mouvement oublié',
    cancelMovement: 'Annuler un mouvement',
  }

  return (
    <CorrectionsContext.Provider value={{ canCorrect, recette, companies, open: setDialog }}>
      {children}
      <Dialog open={dialog !== null} onOpenChange={(v) => !v && close()}>
        <DialogContent className="sm:max-w-lg">
          {dialog && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {titles[dialog.kind]}
                  {dialog.kind === 'order' && ` ${dialog.order.orderNumber}`}
                </DialogTitle>
                <DialogDescription>
                  {recette.closed
                    ? 'Recette clôturée : ses totaux seront recalculés, et la correction inscrite au journal avec votre nom.'
                    : 'La correction est inscrite au journal de la recette avec votre nom.'}
                </DialogDescription>
              </DialogHeader>
              {dialog.kind === 'order' && <OrderForm key={dialog.order.id} order={dialog.order} onDone={close} />}
              {dialog.kind === 'addSale' && <AddSaleForm onDone={close} />}
              {dialog.kind === 'recount' && <RecountForm onDone={close} />}
              {dialog.kind === 'addMovement' && <MovementForm onDone={close} />}
              {dialog.kind === 'cancelMovement' && <CancelMovementForm movement={dialog.movement} onDone={close} />}
            </>
          )}
        </DialogContent>
      </Dialog>
    </CorrectionsContext.Provider>
  )
}

// ── L'envoi, commun à tous les gestes ───────────────────────────────────────

type Result = {
  changes: string[]
  delta: { revenue: number; net: number; cashExpected: number; receivable: number }
  gapBefore: number | null
  gapAfter: number | null
}

function useSubmit(onDone: () => void) {
  const router = useRouter()
  const ctx = useContext(CorrectionsContext)!
  const [saving, setSaving] = useState(false)

  const submit = async (body: Record<string, unknown>) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/recettes/${ctx.recette.id}/corrections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Correction impossible')
      const r = data as Result
      // Ce que ça a changé, en une ligne : c'est la question qu'on se pose juste après.
      const impact = [
        Math.abs(r.delta.revenue) >= 0.005 && `CA ${signed(r.delta.revenue)}`,
        Math.abs(r.delta.cashExpected) >= 0.005 && `tiroir attendu ${signed(r.delta.cashExpected)}`,
        Math.abs(r.delta.receivable) >= 0.005 && `à recevoir ${signed(r.delta.receivable)}`,
        r.gapAfter !== r.gapBefore &&
          `écart ${r.gapBefore === null ? 'non compté' : signed(r.gapBefore)} → ${r.gapAfter === null ? 'non compté' : signed(r.gapAfter)}`,
      ].filter(Boolean)
      toast.success(r.changes[0] ?? 'Correction enregistrée', {
        description: impact.length ? impact.join(' · ') : 'Sans effet sur les totaux.',
      })
      onDone()
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Correction impossible')
    } finally {
      setSaving(false)
    }
  }
  return { submit, saving }
}

const REASONS = ['Erreur de saisie', 'Oubli à la caisse', 'Rapprochement plateforme', 'Client remboursé', 'Erreur de comptage']

function ReasonField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold" htmlFor="correction-reason">
        Raison <span className="text-red-600">*</span>
      </label>
      <div className="flex flex-wrap gap-1">
        {REASONS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => onChange(r)}
            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors ${
              value === r ? 'border-[#F5A800] bg-[#F5A800]/15 text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {r}
          </button>
        ))}
      </div>
      <textarea
        id="correction-reason"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        maxLength={300}
        placeholder="Ce qui s'est passé — lu plus tard par le comptable"
        className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
      />
    </div>
  )
}

function Actions({ saving, disabled, label, danger }: { saving: boolean; disabled: boolean; label: string; danger?: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled || saving}
      className={`w-full rounded-lg px-4 py-2.5 text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        danger ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-[#F5A800] text-black hover:bg-[#FF6B00]'
      }`}
    >
      {saving ? 'Enregistrement…' : label}
    </button>
  )
}

const inputClass = 'w-full rounded-lg border bg-background px-3 py-2 text-sm'

// ── Plateforme et règlement : décidés ensemble ───────────────────────────────

const PAYMENT_CHOICES: { key: SettlePayment; label: string; hint: string }[] = [
  { key: 'platform', label: 'Payé à la plateforme', hint: 'elle a encaissé, elle reversera — à recevoir' },
  { key: 'cash', label: 'Espèces', hint: 'dans le tiroir' },
  { key: 'card', label: 'TPE', hint: 'en banque, pas dans le tiroir' },
  { key: 'other', label: 'Autre', hint: 'ni tiroir ni plateforme' },
]

function SettleFields({
  companyId,
  setCompanyId,
  type,
  setType,
  payment,
  setPayment,
}: {
  companyId: string
  setCompanyId: (v: string) => void
  type: 'delivery' | 'pickup'
  setType: (v: 'delivery' | 'pickup') => void
  payment: SettlePayment
  setPayment: (v: SettlePayment) => void
}) {
  const { companies } = useContext(CorrectionsContext)!
  const hasCompany = companyId !== ''
  return (
    <>
      <div className="space-y-1.5">
        <label className="text-xs font-semibold">Plateforme de livraison</label>
        <select
          value={companyId}
          onChange={(e) => {
            const v = e.target.value
            setCompanyId(v)
            // Une plateforme encaisse d'habitude elle-même ; sans elle, rien ne peut l'être « par elle ».
            if (v) setPayment('platform')
            else if (payment === 'platform') setPayment('cash')
          }}
          className={inputClass}
        >
          <option value="">Aucune — vente directe</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} · commission {c.commission} %{c.isActive ? '' : ' (inactive)'}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold">Type</label>
        <div className="grid grid-cols-2 gap-2">
          {(['pickup', 'delivery'] as const).map((t) => (
            <button
              key={t}
              type="button"
              disabled={hasCompany && t === 'pickup'}
              onClick={() => setType(t)}
              className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-40 ${
                (hasCompany ? 'delivery' : type) === t ? 'border-[#F5A800] bg-[#F5A800]/15' : 'text-muted-foreground'
              }`}
            >
              {t === 'delivery' ? '🛵 Livraison' : '🥡 À emporter'}
            </button>
          ))}
        </div>
        {hasCompany && <p className="text-[11px] text-muted-foreground">Une commande plateforme est une livraison : c&apos;est elle qui porte la commission.</p>}
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold">Qui a encaissé ?</label>
        <div className="grid grid-cols-2 gap-2">
          {PAYMENT_CHOICES.map((p) => {
            const disabled = p.key === 'platform' && !hasCompany
            return (
              <button
                key={p.key}
                type="button"
                disabled={disabled}
                onClick={() => setPayment(p.key)}
                className={`rounded-lg border px-3 py-2 text-left transition-colors disabled:opacity-40 ${
                  payment === p.key ? 'border-[#F5A800] bg-[#F5A800]/15' : ''
                }`}
              >
                <span className="block text-sm font-semibold">{p.label}</span>
                <span className="block text-[11px] text-muted-foreground">{p.hint}</span>
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}

// ── Une commande ─────────────────────────────────────────────────────────────

type OrderMode = 'settle' | 'amount' | 'cancel'

function OrderForm({ order, onDone }: { order: CorrectableOrder; onDone: () => void }) {
  const { companies } = useContext(CorrectionsContext)!
  const { submit, saving } = useSubmit(onDone)
  const cancelled = order.status === 'cancelled'
  const [mode, setMode] = useState<OrderMode>(cancelled ? 'cancel' : 'settle')
  const [reason, setReason] = useState('')

  const initialCompany =
    companies.find((c) => c.id === order.companyId)?.id ??
    companies.find((c) => c.name === order.companyName)?.id ??
    ''
  const [companyId, setCompanyId] = useState(initialCompany)
  const [type, setType] = useState(order.type)
  const [payment, setPayment] = useState<SettlePayment>(
    (order.paymentMethod as SettlePayment | null) ?? (initialCompany ? 'platform' : 'cash')
  )
  const [total, setTotal] = useState(order.total.toFixed(2))
  const nextTotal = parseAmount(total)

  if (order.payoutLocked) {
    return (
      <div className="space-y-3">
        <p className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <Lock size={16} className="mt-0.5 shrink-0 text-amber-600" />
          <span>
            Le versement de <b>{order.companyName}</b> est déjà pointé sur cette commande
            {order.payoutRef ? ` (${order.payoutRef})` : ''}. La corriger ferait mentir ce versement : annulez
            d&apos;abord le pointage dans{' '}
            <Link href="/platform-payouts" className="font-semibold text-blue-600 hover:underline">
              Règlements plateformes
            </Link>
            .
          </span>
        </p>
      </div>
    )
  }

  const valid =
    reason.trim().length >= 3 &&
    (mode !== 'amount' || (nextTotal !== null && nextTotal > 0 && Math.abs(nextTotal - order.total) >= 0.005))

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid) return
    if (mode === 'settle') {
      submit({ action: 'order.settle', orderId: order.id, companyId: companyId || null, type, payment, reason })
    } else if (mode === 'amount') {
      submit({ action: 'order.amount', orderId: order.id, total: nextTotal, reason })
    } else {
      submit({ action: cancelled ? 'order.restore' : 'order.cancel', orderId: order.id, reason })
    }
  }

  const tabs: { key: OrderMode; label: string; icon: React.ReactNode }[] = cancelled
    ? [{ key: 'cancel', label: 'Rétablir', icon: <Undo2 size={14} /> }]
    : [
        { key: 'settle', label: 'Plateforme & règlement', icon: <Wallet size={14} /> },
        { key: 'amount', label: 'Montant', icon: <Pencil size={14} /> },
        { key: 'cancel', label: 'Annuler', icon: <Ban size={14} /> },
      ]

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
        {order.time} · {order.customer || '—'} · {order.type === 'delivery' ? 'livraison' : 'à emporter'}
        {order.companyName && ` · ${order.companyName}`} · <b className="text-foreground">{money(order.total)}</b>
      </div>

      {tabs.length > 1 && (
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted/50 p-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setMode(t.key)}
              className={`inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
                mode === t.key ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      )}

      {mode === 'settle' && (
        <SettleFields
          companyId={companyId}
          setCompanyId={setCompanyId}
          type={type}
          setType={setType}
          payment={payment}
          setPayment={setPayment}
        />
      )}

      {mode === 'amount' && (
        <div className="space-y-1.5">
          <label className="text-xs font-semibold" htmlFor="correct-total">
            Montant juste
          </label>
          <input
            id="correct-total"
            inputMode="decimal"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
            className={`${inputClass} text-lg font-bold`}
            autoFocus
          />
          <p className="text-xs text-muted-foreground">
            Était {money(order.total)}
            {nextTotal !== null && Math.abs(nextTotal - order.total) >= 0.005 && (
              <>
                {' '}
                → <b className="text-foreground">{money(nextTotal)}</b> ({signed(nextTotal - order.total)}). La
                différence s&apos;inscrit sur le ticket en ligne « Correction » ; la remise du caissier ne bouge pas.
              </>
            )}
          </p>
        </div>
      )}

      {mode === 'cancel' && (
        <p
          className={`rounded-lg border p-3 text-sm ${
            cancelled ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-red-500/40 bg-red-500/10'
          }`}
        >
          {cancelled ? (
            <>
              La commande revient dans la recette, livrée : <b>+ {money(order.total)}</b> au chiffre d&apos;affaires.
            </>
          ) : (
            <>
              La commande sort du chiffre d&apos;affaires (<b>− {money(order.total)}</b>). Elle n&apos;est pas effacée :
              elle reste visible, barrée, et peut être rétablie.
            </>
          )}
        </p>
      )}

      <ReasonField value={reason} onChange={setReason} />
      <Actions
        saving={saving}
        disabled={!valid}
        danger={mode === 'cancel' && !cancelled}
        label={
          mode === 'cancel' ? (cancelled ? 'Rétablir la commande' : 'Annuler la commande') : 'Enregistrer la correction'
        }
      />
    </form>
  )
}

// ── Une vente oubliée ────────────────────────────────────────────────────────

function AddSaleForm({ onDone }: { onDone: () => void }) {
  const { recette } = useContext(CorrectionsContext)!
  const { submit, saving } = useSubmit(onDone)
  const [amount, setAmount] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [type, setType] = useState<'delivery' | 'pickup'>('pickup')
  const [payment, setPayment] = useState<SettlePayment>('cash')
  const [reference, setReference] = useState('')
  const end = recette.closedAt ?? new Date().toISOString()
  const [at, setAt] = useState(toLocalInput(new Date(new Date(end).getTime() - 60_000).toISOString()))
  const [reason, setReason] = useState('')
  const value = parseAmount(amount)
  const valid = value !== null && value > 0 && reason.trim().length >= 3

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        submit({
          action: 'order.add',
          total: value,
          companyId: companyId || null,
          type,
          payment,
          reference,
          at: at ? new Date(at).toISOString() : null,
          reason,
        })
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold" htmlFor="sale-amount">
            Montant
          </label>
          <input
            id="sale-amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className={`${inputClass} text-lg font-bold`}
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold" htmlFor="sale-at">
            Heure de la vente
          </label>
          <input
            id="sale-at"
            type="datetime-local"
            value={at}
            min={toLocalInput(recette.openedAt)}
            max={toLocalInput(end)}
            onChange={(e) => setAt(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>
      <SettleFields
        companyId={companyId}
        setCompanyId={setCompanyId}
        type={type}
        setType={setType}
        payment={payment}
        setPayment={setPayment}
      />
      <div className="space-y-1.5">
        <label className="text-xs font-semibold" htmlFor="sale-ref">
          Référence <span className="font-normal text-muted-foreground">(n° Glovo, ticket…)</span>
        </label>
        <input id="sale-ref" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={60} className={inputClass} />
      </div>
      <ReasonField value={reason} onChange={setReason} />
      <Actions saving={saving} disabled={!valid} label={value ? `Ajouter la vente · ${money(value)}` : 'Ajouter la vente'} />
    </form>
  )
}

// ── Le comptage ──────────────────────────────────────────────────────────────

function RecountForm({ onDone }: { onDone: () => void }) {
  const { recette } = useContext(CorrectionsContext)!
  const { submit, saving } = useSubmit(onDone)
  const [counted, setCounted] = useState(recette.closingCash === null ? '' : recette.closingCash.toFixed(2))
  const [float, setFloat] = useState(recette.openingFloat.toFixed(2))
  const [reason, setReason] = useState('')
  const countedValue = counted.trim() === '' ? null : parseAmount(counted)
  const floatValue = parseAmount(float)
  // L'attendu dépend du fond : changer le fond déplace l'attendu d'autant.
  const expected = round2(recette.expectedCash - recette.openingFloat + (floatValue ?? recette.openingFloat))
  const gap = countedValue === null ? null : round2(countedValue - expected)
  const valid =
    reason.trim().length >= 3 &&
    floatValue !== null &&
    floatValue >= 0 &&
    (counted.trim() === '' || (countedValue !== null && countedValue >= 0))

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) submit({ action: 'count', closingCash: countedValue, openingFloat: floatValue, reason })
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold" htmlFor="recount-float">
            Fond d&apos;ouverture
          </label>
          <input id="recount-float" inputMode="decimal" value={float} onChange={(e) => setFloat(e.target.value)} className={inputClass} />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold" htmlFor="recount-cash">
            Espèces comptées
          </label>
          <input
            id="recount-cash"
            inputMode="decimal"
            value={counted}
            onChange={(e) => setCounted(e.target.value)}
            placeholder="vide = non compté"
            className={`${inputClass} font-bold`}
            autoFocus
          />
        </div>
      </div>
      <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm flex justify-between gap-3">
        <span className="text-muted-foreground">Attendu {money(expected)}</span>
        <span className="font-bold">
          Écart{' '}
          {gap === null ? (
            'non compté'
          ) : (
            <span className={Math.abs(gap) < 0.005 ? 'text-green-600' : gap > 0 ? 'text-amber-600' : 'text-red-600'}>
              {signed(gap)}
            </span>
          )}
        </span>
      </div>
      <ReasonField value={reason} onChange={setReason} />
      <Actions saving={saving} disabled={!valid} label="Enregistrer le comptage" />
    </form>
  )
}

// ── Un mouvement oublié ──────────────────────────────────────────────────────

function MovementForm({ onDone }: { onDone: () => void }) {
  const { recette } = useContext(CorrectionsContext)!
  const { submit, saving } = useSubmit(onDone)
  const [kind, setKind] = useState<MovementKind>('achat')
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const end = recette.closedAt ?? new Date().toISOString()
  const [at, setAt] = useState(toLocalInput(new Date(new Date(end).getTime() - 60_000).toISOString()))
  const [reason, setReason] = useState('')
  const meta = MOVEMENT_META[kind]
  const value = parseAmount(amount)
  const valid = value !== null && value > 0 && label.trim() !== '' && reason.trim().length >= 3

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) {
          submit({ action: 'movement.add', kind, label, amount: value, note, at: at ? new Date(at).toISOString() : null, reason })
        }
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-4 gap-1.5">
        {MOVEMENT_LIST.map((m) => (
          <button
            key={m.kind}
            type="button"
            onClick={() => setKind(m.kind)}
            className={`rounded-lg border px-2 py-1.5 text-xs font-bold transition-colors ${
              kind === m.kind ? m.accent : 'text-muted-foreground'
            }`}
          >
            {m.sign > 0 ? '+' : '−'} {m.label}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">{meta.hint}</p>
      <div className="flex flex-wrap gap-1">
        {meta.suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setLabel(s)}
            className="rounded-full border px-2.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
          >
            {s}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Libellé" maxLength={80} className={inputClass} />
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Montant"
          className={`${inputClass} font-bold`}
        />
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (facultatif)" maxLength={200} className={inputClass} />
        <input
          type="datetime-local"
          value={at}
          min={toLocalInput(recette.openedAt)}
          max={toLocalInput(end)}
          onChange={(e) => setAt(e.target.value)}
          aria-label="Heure du mouvement"
          className={inputClass}
        />
      </div>
      {value !== null && value > 0 && (
        <p className="text-xs text-muted-foreground">
          Espèces attendues dans le tiroir : {money(recette.expectedCash)} →{' '}
          <b className="text-foreground">{money(recette.expectedCash + meta.sign * value)}</b>
          {meta.expense && ' · le solde du service baisse d\'autant'}
        </p>
      )}
      <ReasonField value={reason} onChange={setReason} />
      <Actions saving={saving} disabled={!valid} label={`Ajouter ${meta.label.toLowerCase()}${value ? ` · ${money(value)}` : ''}`} />
    </form>
  )
}

function CancelMovementForm({
  movement,
  onDone,
}: {
  movement: { id: string; label: string; amount: number; kind: string }
  onDone: () => void
}) {
  const { submit, saving } = useSubmit(onDone)
  const [reason, setReason] = useState('')
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (reason.trim().length >= 3) submit({ action: 'movement.cancel', movementId: movement.id, reason })
      }}
      className="space-y-4"
    >
      <p className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm">
        « {movement.label} » ({money(movement.amount)}) sort des totaux. La ligne reste visible, barrée.
      </p>
      <ReasonField value={reason} onChange={setReason} />
      <Actions saving={saving} disabled={reason.trim().length < 3} danger label="Annuler le mouvement" />
    </form>
  )
}

// ── Ce que la page affiche ───────────────────────────────────────────────────

/** Les gestes qui ne visent pas une ligne précise. */
export function CorrectionToolbar({ count }: { count: number }) {
  const ctx = useCorrections()
  if (!ctx) return null
  const { recette, open } = ctx
  return (
    <div className="mb-4 rounded-xl border border-dashed border-[#F5A800]/50 bg-[#F5A800]/5 px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">Corriger cette recette</p>
        <p className="text-xs text-muted-foreground">
          {recette.closed
            ? "Clôturée : chaque correction recalcule ses totaux et s'inscrit au journal — qui, quand, pourquoi."
            : 'Ouverte : corrigez ici les commandes ; mouvements et comptage se font depuis la caisse.'}
          {count > 0 && ` ${count} correction${count > 1 ? 's' : ''} déjà.`}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <ToolbarButton onClick={() => open({ kind: 'addSale' })} icon={<Plus size={14} />} label="Vente oubliée" />
        {recette.closed && (
          <>
            <ToolbarButton onClick={() => open({ kind: 'addMovement' })} icon={<Plus size={14} />} label="Mouvement oublié" />
            <ToolbarButton onClick={() => open({ kind: 'recount' })} icon={<RotateCcw size={14} />} label="Comptage" />
          </>
        )}
      </div>
    </div>
  )
}

function ToolbarButton({ onClick, icon, label }: { onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-xs font-semibold hover:border-[#F5A800] transition-colors"
    >
      {icon}
      {label}
    </button>
  )
}

const statusLabels: Record<string, string> = {
  pending: 'En attente', confirmed: 'Confirmée', preparing: 'En préparation',
  ready: 'Prête', delivered: 'Livrée', cancelled: 'Annulée',
}
const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-300',
  confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300',
  preparing: 'bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300',
  ready: 'bg-purple-100 text-purple-800 dark:bg-purple-500/15 dark:text-purple-300',
  delivered: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300',
}
const paymentText = (o: CorrectableOrder) =>
  o.paymentMethod === 'cash' ? 'Espèces'
  : o.paymentMethod === 'card' ? 'TPE'
  : o.paymentMethod === 'other' ? 'Autre'
  : o.companyName ? 'Plateforme'
  : '—'

/** Les commandes de la recette, chacune corrigeable par un responsable. */
export function RecetteOrdersTable({ orders }: { orders: CorrectableOrder[] }) {
  const ctx = useCorrections()
  return (
    <div className="bg-card rounded-xl border overflow-hidden">
      <div className="px-4 py-3 border-b">
        <p className="font-semibold text-sm">
          Commandes de la recette <span className="text-muted-foreground font-normal">({orders.length})</span>
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-200 whitespace-nowrap">
          <thead className="bg-muted/50 border-b">
            <tr>
              {['N° Commande', 'Heure', 'Client', 'Type', 'Origine', 'Règlement', 'Statut', 'Total', ''].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {orders.map((o) => {
              const cancelled = o.status === 'cancelled'
              return (
                <tr key={o.id} className="hover:bg-muted/50">
                  <td className="px-4 py-3 font-semibold">{o.orderNumber}</td>
                  <td className="px-4 py-3 text-muted-foreground">{o.time}</td>
                  <td className="px-4 py-3">{o.customer}</td>
                  <td className="px-4 py-3">
                    {o.type === 'delivery' ? '🛵 Livraison' : '🥡 À emporter'}
                    {o.companyName && <span className="block text-[11px] font-semibold text-violet-600 dark:text-violet-400">{o.companyName}</span>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{o.sourceLabel}</td>
                  <td className="px-4 py-3">
                    {paymentText(o)}
                    {o.payoutLocked && (
                      <span className="ml-1.5 inline-flex items-center gap-0.5 text-[11px] text-emerald-600" title={o.payoutRef || 'Versement pointé'}>
                        <Lock size={11} /> réglé
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${statusColors[o.status] ?? 'bg-muted text-muted-foreground'}`}>
                      {statusLabels[o.status] ?? o.status}
                    </span>
                  </td>
                  <td className={`px-4 py-3 font-bold ${cancelled ? 'line-through text-muted-foreground' : ''}`}>
                    {money(o.total)}
                    {Math.abs(o.correction) >= 0.005 && (
                      <span className="block text-[11px] font-semibold text-amber-600" title="Montant corrigé après coup">
                        corrigé {signed(o.correction)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {ctx && (
                        <button
                          type="button"
                          onClick={() => ctx.open({ kind: 'order', order: o })}
                          className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:border-[#F5A800] hover:text-foreground transition-colors"
                        >
                          {cancelled ? <Undo2 size={13} /> : <Pencil size={13} />}
                          {cancelled ? 'Rétablir' : 'Corriger'}
                        </button>
                      )}
                      <Link
                        href={`/orders/${o.id}/print`}
                        title="Ticket"
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      >
                        <Printer size={15} />
                      </Link>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {orders.length === 0 && (
        <p className="text-center text-muted-foreground py-10 text-sm">Aucune commande rattachée à cette recette</p>
      )}
    </div>
  )
}
