'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  AlertTriangle,
  Bike,
  CalendarClock,
  Check,
  CheckCheck,
  HandCoins,
  Loader2,
  RotateCcw,
  Scale,
  Trash2,
  Undo2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  PAYOUT_METHODS,
  PAYOUT_METHOD_LABELS,
  SETTLEMENT_META,
  type PayoutMethod,
} from '@/lib/platformSettlement'

/**
 * L'écran des créances plateformes.
 *
 * Il répond à une question posée dans cet ordre, du haut vers le bas : combien
 * me doit-on, depuis combien de temps, et sur quelles commandes. Le geste qui
 * compte — « Glovo a viré 500 DT » — est un bouton par plateforme, pas une case
 * à cocher quarante-huit fois ; les cases restent là pour les cas où la
 * plateforme ne règle qu'une partie.
 *
 * Les créances sont affichées toutes dates confondues : une facture oubliée doit
 * sauter aux yeux même quand on regarde la semaine en cours. Seuls les
 * versements reçus suivent la période choisie.
 */

type CompanyRow = {
  name: string
  companyId: string | null
  rate: number | null
  unpaid: { count: number; gross: number; commission: number; net: number }
  paid: { count: number; net: number }
  oldest: string | null
  days: number
}

type SettlementOrder = {
  id: string
  orderNumber: string
  reference: string
  company: string
  customer: string
  gross: number
  commission: number
  net: number
  rate: number
  paid: boolean
  paidAt: string | null
  payoutRef: string
  createdAt: string | null
  days: number
  status: string
  source: string
}

type Payout = {
  id: string
  company: string
  amount: number
  expected: number
  gap: number
  orderCount: number
  from: string | null
  to: string | null
  method: string
  reference: string
  note: string
  recordedBy: string
  createdAt: string | null
}

type Data = {
  period: { from: string | null; to: string | null }
  companies: CompanyRow[]
  totals: {
    unpaidCount: number
    unpaidNet: number
    paidCount: number
    paidNet: number
    oldestDays: number
    payoutsCount: number
    payoutsAmount: number
  }
  orders: SettlementOrder[]
  truncated: boolean
  scanned: number
  payouts: Payout[]
}

const money = (n: number) => `${n.toFixed(2)} DT`
const dateFr = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('fr-FR') : '—')
const dayLabel = (days: number) => (days === 0 ? "aujourd'hui" : days === 1 ? 'hier' : `il y a ${days} j`)

/** Le jour local au format des champs date, sans passer par UTC. */
function dayString(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * Le numéro de semaine ISO — celui des relevés. Une plateforme qui règle le
 * lundi parle de « S38 », pas de « la quatrième semaine de septembre ».
 */
function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  // Jeudi de la même semaine : c'est lui qui décide de l'année ISO.
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7))
  const start = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  return Math.ceil(((t.getTime() - start.getTime()) / 86_400_000 + 1) / 7)
}

type Preset = 'week' | 'month' | 'thisMonth' | 'all'
const PRESETS: { key: Preset; label: string }[] = [
  { key: 'week', label: '7 jours' },
  { key: 'month', label: '30 jours' },
  { key: 'thisMonth', label: 'Ce mois-ci' },
  { key: 'all', label: 'Tout' },
]

function periodOf(preset: Preset): { from: string | null; to: string | null } {
  if (preset === 'all') return { from: null, to: null }
  const now = new Date()
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  const from =
    preset === 'thisMonth'
      ? new Date(now.getFullYear(), now.getMonth(), 1)
      : new Date(now.getFullYear(), now.getMonth(), now.getDate() - (preset === 'week' ? 6 : 29))
  return { from: from.toISOString(), to: to.toISOString() }
}

export default function PayoutsClient() {
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [preset, setPreset] = useState<Preset>('month')
  const [tab, setTab] = useState<'unpaid' | 'paid'>('unpaid')
  const [company, setCompany] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [dialogFor, setDialogFor] = useState<{ company: string; ids: string[] } | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { from, to } = periodOf(preset)
      const params = new URLSearchParams({ status: tab })
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      if (company) params.set('company', company)
      const res = await fetch(`/api/platform-payouts?${params}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Chargement impossible')
      setData(json)
      setError('')
      // Une commande pointée entre-temps ne doit pas rester cochée.
      setSelected((prev) => {
        const ids = new Set((json.orders as SettlementOrder[]).map((o) => o.id))
        return new Set([...prev].filter((id) => ids.has(id)))
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chargement impossible')
    } finally {
      setLoading(false)
    }
  }, [preset, tab, company])

  useEffect(() => {
    load()
  }, [load])

  const orders = data?.orders ?? []
  const selectedOrders = useMemo(() => orders.filter((o) => selected.has(o.id)), [orders, selected])
  const selectedNet = selectedOrders.reduce((s, o) => s + o.net, 0)
  const selectedCompanies = [...new Set(selectedOrders.map((o) => o.company))]

  /** Pointer ou dépointer, puis recharger : rien n'est deviné localement. */
  const settle = async (body: Record<string, unknown>, done: string) => {
    setBusy(true)
    try {
      const res = await fetch('/api/platform-payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Opération refusée')
      toast.success(done, {
        description:
          json.gap !== null && json.gap !== undefined && Math.abs(json.gap) > 0.005
            ? `${json.count} commande(s) · écart ${json.gap > 0 ? '+' : ''}${money(json.gap)}`
            : `${json.count} commande(s) · ${money(json.expected)}`,
      })
      setSelected(new Set())
      setDialogFor(null)
      await load()
      return true
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Opération refusée')
      return false
    } finally {
      setBusy(false)
    }
  }

  const cancelPayout = async (payout: Payout) => {
    if (
      !confirm(
        `Annuler le versement de ${money(payout.amount)} (${payout.company}) ?\n\n` +
          `Les ${payout.orderCount} commande(s) qu'il soldait redeviendront « à recevoir ».`
      )
    )
      return
    setBusy(true)
    try {
      const res = await fetch(`/api/platform-payouts/${payout.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Suppression refusée')
      toast.success('Versement annulé', { description: `${json.reopened} commande(s) à recevoir` })
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Suppression refusée')
    } finally {
      setBusy(false)
    }
  }

  if (loading && !data) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-16 justify-center">
        <Loader2 className="animate-spin" size={16} /> Chargement des créances…
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center">
        <p className="text-sm text-red-600 font-medium">{error}</p>
        <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={load}>
          <RotateCcw size={14} /> Réessayer
        </Button>
      </div>
    )
  }

  const totals = data!.totals
  const gapTotal = data!.payouts.reduce((s, p) => s + p.gap, 0)
  const late = totals.oldestDays >= 14 && totals.unpaidNet > 0
  // La date de la plus vieille créance ouverte, toutes plateformes confondues.
  const oldest = data!.companies.reduce<string | null>(
    (old, c) => (c.oldest && (!old || c.oldest < old) ? c.oldest : old),
    null
  )

  return (
    <div className="space-y-4">
      {/* ── Ce qui est dû, ce qui est arrivé ─────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          icon={<HandCoins size={15} />}
          label="À recevoir"
          value={money(totals.unpaidNet)}
          hint={
            totals.unpaidCount === 0
              ? 'Aucune créance ouverte — tout est réglé'
              : `${totals.unpaidCount} commande${totals.unpaidCount > 1 ? 's' : ''} · toutes dates`
          }
          tone={totals.unpaidNet > 0 ? 'amber' : 'emerald'}
        />
        <Tile
          icon={<CalendarClock size={15} />}
          label="Plus ancienne créance"
          value={totals.unpaidCount === 0 ? '—' : `${totals.oldestDays} j`}
          hint={
            totals.unpaidCount === 0
              ? 'Rien n’attend'
              : late
                ? `Depuis le ${dateFr(oldest)} — au-delà de deux semaines, réclamez`
                : `La plus vieille facture ouverte date du ${dateFr(oldest)}`
          }
          tone={late ? 'red' : 'neutral'}
        />
        <Tile
          icon={<CheckCheck size={15} />}
          label="Versements reçus"
          value={money(totals.payoutsAmount)}
          hint={`${totals.payoutsCount} versement${totals.payoutsCount > 1 ? 's' : ''} · période choisie`}
          tone="emerald"
        />
        <Tile
          icon={<Scale size={15} />}
          label="Écart cumulé"
          value={`${gapTotal > 0 ? '+' : ''}${money(gapTotal)}`}
          hint={
            Math.abs(gapTotal) < 0.005
              ? 'Les plateformes ont versé exactement ce qui était dû'
              : gapTotal < 0
                ? 'Versé de moins que le net attendu'
                : 'Versé de plus que le net attendu'
          }
          tone={Math.abs(gapTotal) < 0.005 ? 'neutral' : gapTotal < 0 ? 'red' : 'sky'}
        />
      </div>

      {data!.truncated && (
        <p className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-800 dark:text-amber-300">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          Beaucoup de commandes plateformes à balayer : les totaux ci-dessus portent sur les{' '}
          {data!.scanned} plus récentes. Pointez les anciennes pour y voir clair.
        </p>
      )}

      {/* ── Une carte par plateforme ─────────────────────────────────── */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {data!.companies.map((c) => (
          <CompanyCard
            key={c.name}
            row={c}
            active={company === c.name}
            onFilter={() => {
              setCompany((v) => (v === c.name ? '' : c.name))
              setSelected(new Set())
            }}
            onPay={() => setDialogFor({ company: c.name, ids: [] })}
          />
        ))}
        {data!.companies.length === 0 && (
          <p className="rounded-xl border bg-card px-4 py-6 text-center text-sm text-muted-foreground md:col-span-2 xl:col-span-3">
            Aucune société de livraison enregistrée — ajoutez-en dans{' '}
            <strong>Sociétés livraison</strong>.
          </p>
        )}
      </div>

      {/* ── Les commandes, à recevoir ou déjà pointées ───────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">
                {tab === 'unpaid' ? 'Commandes à recevoir' : 'Commandes réglées'}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {tab === 'unpaid'
                  ? 'Toutes dates confondues, la plus récente en haut.'
                  : 'Pointées pendant la période choisie.'}
                {company && ` Filtré sur ${company}.`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Seg
                options={[
                  { key: 'unpaid', label: `À recevoir (${totals.unpaidCount})` },
                  { key: 'paid', label: `Réglées (${totals.paidCount})` },
                ]}
                value={tab}
                onChange={(v) => {
                  setTab(v as 'unpaid' | 'paid')
                  setSelected(new Set())
                }}
              />
              {company && (
                <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => setCompany('')}>
                  <Undo2 size={13} /> Toutes
                </Button>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mr-1">
              Versements
            </span>
            {PRESETS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPreset(p.key)}
                className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
                  preset === p.key
                    ? 'border-[#F5A800] bg-[#F5A800]/15 text-foreground'
                    : 'border-border text-muted-foreground hover:bg-muted'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-200">
              <thead className="bg-muted/50 border-b">
                <tr>
                  {tab === 'unpaid' && (
                    <th className="px-4 py-3 w-10">
                      <Checkbox
                        checked={orders.length > 0 && selected.size === orders.length}
                        onCheckedChange={(v) =>
                          setSelected(v ? new Set(orders.map((o) => o.id)) : new Set())
                        }
                        aria-label="Tout sélectionner"
                      />
                    </th>
                  )}
                  {['Commande', 'Plateforme', 'Brut', 'Commission', 'Net', 'Attente', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {orders.map((o) => (
                  <tr key={o.id} className={`hover:bg-muted/50 ${selected.has(o.id) ? 'bg-[#F5A800]/5' : ''}`}>
                    {tab === 'unpaid' && (
                      <td className="px-4 py-3">
                        <Checkbox
                          checked={selected.has(o.id)}
                          onCheckedChange={(v) =>
                            setSelected((prev) => {
                              const next = new Set(prev)
                              if (v) next.add(o.id)
                              else next.delete(o.id)
                              return next
                            })
                          }
                          aria-label={`Sélectionner ${o.orderNumber}`}
                        />
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs font-bold">{o.orderNumber}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {dateFr(o.createdAt)}
                        {o.reference && ` · ${o.reference}`}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold">{o.company}</span>
                      {o.rate > 0 && (
                        <span className="ml-1.5 text-[11px] font-bold text-orange-600">{o.rate}%</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium">{money(o.gross)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">−{money(o.commission)}</td>
                    <td className="px-4 py-3 font-black text-[#F5A800]">{money(o.net)}</td>
                    <td className="px-4 py-3">
                      {o.paid ? (
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${SETTLEMENT_META.paid.badge}`}
                        >
                          <Check size={11} /> {dateFr(o.paidAt)}
                        </span>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${SETTLEMENT_META.unpaid.badge}`}
                        >
                          {dayLabel(o.days)}
                        </span>
                      )}
                      {o.payoutRef && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">{o.payoutRef}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        className="h-7 gap-1 text-xs"
                        onClick={() =>
                          settle(
                            { orderIds: [o.id], paid: !o.paid },
                            o.paid ? 'Remis à recevoir' : 'Commande pointée comme réglée'
                          )
                        }
                      >
                        {o.paid ? (
                          <>
                            <Undo2 size={12} /> Dépointer
                          </>
                        ) : (
                          <>
                            <Check size={12} /> Réglée
                          </>
                        )}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {orders.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {tab === 'unpaid'
                ? 'Aucune créance ouverte — les plateformes sont à jour.'
                : 'Aucune commande pointée sur cette période.'}
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Historique des versements ────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Versements reçus</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Ce que chaque plateforme a réellement versé, face à ce qui était attendu.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-200">
              <thead className="bg-muted/50 border-b">
                <tr>
                  {['Date', 'Plateforme', 'Attendu', 'Versé', 'Écart', 'Commandes', 'Référence', ''].map(
                    (h) => (
                      <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y">
                {data!.payouts.map((p) => {
                  const off = Math.abs(p.gap) > 0.005
                  return (
                    <tr key={p.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="font-semibold text-xs">{dateFr(p.createdAt)}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {PAYOUT_METHOD_LABELS[(p.method as PayoutMethod) ?? 'transfer'] ?? p.method}
                        </p>
                      </td>
                      <td className="px-4 py-3 font-semibold">{p.company}</td>
                      <td className="px-4 py-3 text-muted-foreground">{money(p.expected)}</td>
                      <td className="px-4 py-3 font-black text-emerald-600">{money(p.amount)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                            !off
                              ? 'bg-muted text-muted-foreground'
                              : p.gap < 0
                                ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300'
                                : 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300'
                          }`}
                        >
                          {p.gap > 0 ? '+' : ''}
                          {money(p.gap)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {p.orderCount}
                        {p.from && (
                          <span className="block text-[11px]">
                            {dateFr(p.from)} → {dateFr(p.to)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <p className="font-mono">{p.reference || '—'}</p>
                        {p.recordedBy && (
                          <p className="text-[11px] text-muted-foreground">par {p.recordedBy}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => cancelPayout(p)}
                          disabled={busy}
                          title="Annuler ce versement"
                          className="rounded-lg p-1.5 text-red-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {data!.payouts.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Aucun versement enregistré sur cette période.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Barre de sélection, collée en bas ────────────────────────── */}
      {selectedOrders.length > 0 && (
        <div className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card/95 px-4 py-3 shadow-lg backdrop-blur">
          <p className="text-sm">
            <strong>{selectedOrders.length}</strong> commande
            {selectedOrders.length > 1 ? 's' : ''} sélectionnée
            {selectedOrders.length > 1 ? 's' : ''} ·{' '}
            <strong className="text-[#F5A800]">{money(selectedNet)}</strong>
            {selectedCompanies.length > 1 && (
              <span className="ml-2 text-xs text-amber-600">
                {selectedCompanies.join(' + ')} — un versement ne peut couvrir qu&apos;une plateforme
              </span>
            )}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setSelected(new Set())}>
              Annuler
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              className="gap-1.5"
              onClick={() =>
                settle(
                  { orderIds: selectedOrders.map((o) => o.id), paid: true },
                  'Commandes pointées comme réglées'
                )
              }
            >
              <Check size={14} /> Pointer sans versement
            </Button>
            <Button
              size="sm"
              disabled={busy || selectedCompanies.length > 1}
              className="gap-1.5 bg-[#F5A800] font-bold text-black hover:bg-[#FF6B00]"
              onClick={() =>
                setDialogFor({
                  company: selectedCompanies[0] ?? '',
                  ids: selectedOrders.map((o) => o.id),
                })
              }
            >
              <HandCoins size={14} /> Enregistrer le versement
            </Button>
          </div>
        </div>
      )}

      {dialogFor && (
        <PayoutDialog
          company={dialogFor.company}
          ids={dialogFor.ids}
          unpaid={(data!.orders ?? []).filter((o) => !o.paid && o.company === dialogFor.company)}
          fallbackNet={
            data!.companies.find((c) => c.name === dialogFor.company)?.unpaid.net ?? 0
          }
          fallbackCount={
            data!.companies.find((c) => c.name === dialogFor.company)?.unpaid.count ?? 0
          }
          busy={busy}
          onClose={() => setDialogFor(null)}
          onSubmit={(body) => settle(body, `Versement ${dialogFor.company} enregistré`)}
        />
      )}
    </div>
  )
}

// ── Pièces d'interface ──────────────────────────────────────────────────

const TONES = {
  amber: 'text-amber-600 dark:text-amber-400',
  emerald: 'text-emerald-600 dark:text-emerald-400',
  red: 'text-red-600 dark:text-red-400',
  sky: 'text-sky-600 dark:text-sky-400',
  neutral: 'text-foreground',
} as const

function Tile({
  icon,
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint: string
  tone?: keyof typeof TONES
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        {icon} {label}
      </p>
      <p className={`mt-1.5 text-2xl font-black tabular-nums ${TONES[tone]}`}>{value}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
    </div>
  )
}

function Seg({
  options,
  value,
  onChange,
}: {
  options: { key: string; label: string }[]
  value: string
  onChange: (key: string) => void
}) {
  return (
    <div className="inline-flex rounded-lg border p-0.5">
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
            value === o.key ? 'bg-[#1A1A1A] text-white dark:bg-white dark:text-black' : 'text-muted-foreground hover:bg-muted'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function CompanyCard({
  row,
  active,
  onFilter,
  onPay,
}: {
  row: CompanyRow
  active: boolean
  onFilter: () => void
  onPay: () => void
}) {
  const due = row.unpaid.net > 0
  return (
    <div
      className={`rounded-xl border bg-card p-4 transition-colors ${active ? 'border-[#F5A800] ring-1 ring-[#F5A800]/30' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 font-bold">
            <Bike size={15} className="text-muted-foreground" /> {row.name}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {row.rate === null ? 'Commission non renseignée' : `Commission ${row.rate} %`}
          </p>
        </div>
        {due ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
            {row.unpaid.count} en attente
          </span>
        ) : (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
            À jour
          </span>
        )}
      </div>

      <p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        À recevoir
      </p>
      <p className={`text-3xl font-black tabular-nums ${due ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>
        {money(row.unpaid.net)}
      </p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        {due
          ? `${money(row.unpaid.gross)} brut − ${money(row.unpaid.commission)} de commission · plus ancienne ${dayLabel(row.days)}`
          : 'Aucune commande en attente de versement'}
      </p>
      {row.paid.count > 0 && (
        <p className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400">
          {money(row.paid.net)} pointés sur la période ({row.paid.count} commandes)
        </p>
      )}

      <div className="mt-3 flex items-center gap-2">
        <Button
          size="sm"
          disabled={!due}
          onClick={onPay}
          className="gap-1.5 bg-[#F5A800] font-bold text-black hover:bg-[#FF6B00] disabled:opacity-40"
        >
          <HandCoins size={14} /> Versement
        </Button>
        <Button variant="outline" size="sm" onClick={onFilter}>
          {active ? 'Ne plus filtrer' : 'Voir les commandes'}
        </Button>
      </div>
    </div>
  )
}

/**
 * La saisie d'un versement.
 *
 * Deux façons de désigner ce qu'il solde : la sélection faite dans le tableau,
 * ou « tout jusqu'au » — le cas courant, puisqu'une plateforme règle une période
 * entière. Le montant est prérempli avec l'attendu, parce que c'est presque
 * toujours le bon ; l'écart s'affiche dès qu'on le change, parce que c'est
 * précisément ce qu'on vient vérifier.
 */
function PayoutDialog({
  company,
  ids,
  unpaid,
  fallbackNet,
  fallbackCount,
  busy,
  onClose,
  onSubmit,
}: {
  company: string
  ids: string[]
  unpaid: SettlementOrder[]
  fallbackNet: number
  fallbackCount: number
  busy: boolean
  onClose: () => void
  onSubmit: (body: Record<string, unknown>) => void
}) {
  const bySelection = ids.length > 0
  const [mode, setMode] = useState<'selection' | 'until'>(bySelection ? 'selection' : 'until')
  const [until, setUntil] = useState(dayString(new Date()))
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PayoutMethod>('transfer')
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')

  // Ce que le pointage va couvrir. La liste chargée s'arrête à 300 lignes : au
  // delà, on fait confiance au total de la plateforme plutôt qu'à la somme
  // visible, quitte à ne pas pouvoir compter les commandes.
  const covered = useMemo(() => {
    if (mode === 'selection') return unpaid.filter((o) => ids.includes(o.id))
    const limit = new Date(`${until}T23:59:59.999`).getTime()
    return unpaid.filter((o) => (o.createdAt ? new Date(o.createdAt).getTime() <= limit : true))
  }, [mode, ids, unpaid, until])

  const wholeCompany = mode === 'until' && covered.length === unpaid.length
  const expected =
    wholeCompany && unpaid.length < fallbackCount
      ? fallbackNet
      : Math.round(covered.reduce((s, o) => s + o.net, 0) * 100) / 100
  const count = wholeCompany && unpaid.length < fallbackCount ? fallbackCount : covered.length

  const paid = amount.trim() === '' ? expected : Number(amount.replace(',', '.')) || 0
  const gap = Math.round((paid - expected) * 100) / 100
  const off = Math.abs(gap) > 0.005

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HandCoins size={18} className="text-[#F5A800]" /> Versement — {company}
          </DialogTitle>
          <DialogDescription>
            Ce que la plateforme a réellement versé, et les commandes que cela solde.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Ce que le versement couvre */}
          <div className="space-y-2">
            <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Commandes soldées
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setMode('until')}
                className={`rounded-xl border-2 p-2.5 text-left text-xs transition-colors ${
                  mode === 'until' ? 'border-[#F5A800] bg-[#F5A800]/5' : 'border-border hover:bg-muted'
                }`}
              >
                <span className="block font-bold">Tout jusqu&apos;au…</span>
                <span className="text-muted-foreground">La période que la plateforme a réglée</span>
              </button>
              <button
                onClick={() => setMode('selection')}
                disabled={!bySelection}
                className={`rounded-xl border-2 p-2.5 text-left text-xs transition-colors disabled:opacity-40 ${
                  mode === 'selection' ? 'border-[#F5A800] bg-[#F5A800]/5' : 'border-border hover:bg-muted'
                }`}
              >
                <span className="block font-bold">La sélection</span>
                <span className="text-muted-foreground">
                  {bySelection ? `${ids.length} commande(s) cochée(s)` : 'Cochez des lignes d’abord'}
                </span>
              </button>
            </div>
            {mode === 'until' && (
              <Input
                type="date"
                value={until}
                max={dayString(new Date())}
                onChange={(e) => setUntil(e.target.value)}
                className="font-mono"
              />
            )}
          </div>

          {/* Le montant */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Montant versé
            </Label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  placeholder={expected.toFixed(2)}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pr-10 text-xl font-black tabular-nums"
                  autoFocus
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                  DT
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAmount(expected.toFixed(2))}
                className="shrink-0 text-xs"
              >
                = attendu
              </Button>
            </div>
          </div>

          {/* Le rapprochement */}
          <div
            className={`rounded-xl border p-3 text-sm ${
              off
                ? gap < 0
                  ? 'border-red-500/40 bg-red-500/5'
                  : 'border-sky-500/40 bg-sky-500/5'
                : 'border-emerald-500/40 bg-emerald-500/5'
            }`}
          >
            <div className="flex justify-between text-muted-foreground">
              <span>
                Attendu — {count} commande{count > 1 ? 's' : ''}
              </span>
              <strong className="tabular-nums">{money(expected)}</strong>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Versé</span>
              <strong className="tabular-nums">{money(paid)}</strong>
            </div>
            <div className="mt-1.5 flex justify-between border-t pt-1.5 font-black">
              <span>Écart</span>
              <span
                className={`tabular-nums ${off ? (gap < 0 ? 'text-red-600' : 'text-sky-600') : 'text-emerald-600'}`}
              >
                {gap > 0 ? '+' : ''}
                {money(gap)}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {!off
                ? 'La plateforme a versé exactement le net attendu.'
                : gap < 0
                  ? "Il manque de l'argent : une commande annulée après coup, ou une retenue de la plateforme. L'écart est conservé tel quel."
                  : 'Versé plus que le net attendu — une commande d’une autre période a pu être incluse.'}
            </p>
          </div>

          {/* Comment, et sous quelle référence */}
          <div className="space-y-2">
            <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Reçu par
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {PAYOUT_METHODS.map((m) => (
                <button
                  key={m}
                  onClick={() => setMethod(m)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    method === m
                      ? 'border-[#1A1A1A] bg-[#1A1A1A] text-white dark:border-white dark:bg-white dark:text-black'
                      : 'border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {PAYOUT_METHOD_LABELS[m]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Référence
              </Label>
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder={`ex: ${company} S${isoWeek(new Date())}`}
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Note
              </Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={1}
                placeholder="Optionnel"
                className="min-h-9"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button
              disabled={busy || count === 0}
              className="gap-1.5 bg-[#F5A800] font-bold text-black hover:bg-[#FF6B00]"
              onClick={() =>
                onSubmit({
                  paid: true,
                  company,
                  ...(mode === 'selection'
                    ? { orderIds: ids }
                    : { until: new Date(`${until}T23:59:59.999`).toISOString() }),
                  amount: paid,
                  method,
                  reference,
                  note,
                })
              }
            >
              {busy ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
              Pointer {count} commande{count > 1 ? 's' : ''} · {money(paid)}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
