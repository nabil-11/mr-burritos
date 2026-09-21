'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, ShoppingBag, Receipt, Bike, BadgeDollarSign, TrendingDown, ShoppingCart, PiggyBank, Wallet } from 'lucide-react'
import { ORDER_SOURCE_ICONS, ORDER_SOURCE_LABELS, type OrderSource } from '@/lib/orderSource'
import { MOVEMENT_META, isMovementKind } from '@/lib/movementKinds'

type ReportData = {
  totalRevenue: number
  netTotalRevenue: number
  orderCount: number
  avgOrder: number
  byType: {
    delivery: { count: number; revenue: number }
    pickup: { count: number; revenue: number }
  }
  deliverySummary: {
    gross: number
    commissionAmount: number
    net: number
  }
  bySource: Record<OrderSource | 'unknown', { count: number; revenue: number; net: number }>
  byDeliveryCompany: { name: string; count: number; revenue: number; commission: number; net: number; commissionAmount: number }[]
  topProducts: { name: string; qty: number; revenue: number }[]
  byDay: { date: string; revenue: number; count: number }[]
  byHour: { hour: number; revenue: number; count: number }[]
  byStatus: { pending: number; confirmed: number; preparing: number; ready: number; delivered: number }
  // Tout ce qui suit est arrivé avec la caisse et reste facultatif : un serveur
  // pas encore redéployé ne l'envoie pas, et le rapport masque la section
  // plutôt que d'afficher des zéros qui se liraient comme des faits.
  sorties?: MovementSummary
  /** Espèces déplacées sans être dépensées : fond complété, tiroir vidé. */
  fond?: MovementSummary & { apports: number; retraits: number; net: number }
  /** CA net − achats − dépenses. */
  solde?: number
  recettes?: ReportRecette[]
  caisse?: {
    sessions: number
    open: number
    counted: number
    ecartTotal: number
    /** Des tailles, toujours positives : 7,50 manquants, 2,00 en trop. */
    manquants: { count: number; amount: number }
    excedents: { count: number; amount: number }
  }
}

type MovementLine = { kind: string; label: string; count: number; amount: number }

type MovementSummary = {
  achats?: number
  depenses?: number
  total?: number
  count: number
  byLabel: MovementLine[]
}

type ReportRecette = {
  _id: string
  number: string
  status: 'open' | 'closed'
  openedAt: string | null
  closedAt: string | null
  orders: number
  revenue: number
  net: number
  /** Achats et dépenses cumulés. */
  sorties: number
  /** Ajouts au fond moins retraits. */
  fond?: number
  openingFloat: number
  expected: number
  closingCash: number | null
  /** Compté moins attendu ; null tant que le tiroir n'a pas été compté. */
  ecart: number | null
}

type Preset = 'today' | 'week' | 'month' | 'thisMonth' | 'custom'

/**
 * YYYY-MM-DD on the shop's clock. toISOString() gives the UTC date: a day
 * behind in the first hour after midnight, and — for "Ce mois-ci" — the 1st
 * at local midnight becomes the last day of the month before.
 */
function dayString(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function todayStr() {
  return dayString(new Date())
}

function getDateRange(preset: Preset, customFrom?: string, customTo?: string): { from: string; to: string } {
  const now = new Date()
  const today = todayStr()
  if (preset === 'today') return { from: today, to: today }
  if (preset === 'week') {
    const d = new Date(now); d.setDate(d.getDate() - 6)
    return { from: dayString(d), to: today }
  }
  if (preset === 'month') {
    const d = new Date(now); d.setDate(d.getDate() - 29)
    return { from: dayString(d), to: today }
  }
  if (preset === 'thisMonth') {
    const first = new Date(now.getFullYear(), now.getMonth(), 1)
    return { from: dayString(first), to: today }
  }
  // custom
  return { from: customFrom || today, to: customTo || today }
}

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'today',     label: "Aujourd'hui" },
  { key: 'week',      label: '7 derniers jours' },
  { key: 'month',     label: '30 derniers jours' },
  { key: 'thisMonth', label: 'Ce mois-ci' },
  { key: 'custom',    label: 'Personnalisé' },
]

const STATUS_LABELS: { key: keyof ReportData['byStatus']; label: string; color: string }[] = [
  { key: 'delivered', label: 'Livrées / Servies', color: 'text-green-600 bg-green-50' },
  { key: 'ready',     label: 'Prêtes',            color: 'text-blue-600 bg-blue-50' },
  { key: 'preparing', label: 'En préparation',    color: 'text-yellow-600 bg-yellow-50' },
  { key: 'confirmed', label: 'Confirmées',         color: 'text-purple-600 bg-purple-50' },
  { key: 'pending',   label: 'En attente',         color: 'text-muted-foreground bg-muted' },
]

// Legacy orders (no source stored) get their own row so the web share is not
// inflated by everything that came before the field existed.
const SOURCE_ROWS: { key: OrderSource | 'unknown'; label: string; color: string }[] = [
  { key: 'website', label: `${ORDER_SOURCE_ICONS.website} ${ORDER_SOURCE_LABELS.website}`, color: 'bg-[#F5A800]' },
  { key: 'counter', label: `${ORDER_SOURCE_ICONS.counter} ${ORDER_SOURCE_LABELS.counter}`, color: 'bg-blue-500' },
  { key: 'kiosk',   label: `${ORDER_SOURCE_ICONS.kiosk} ${ORDER_SOURCE_LABELS.kiosk}`,     color: 'bg-purple-500' },
  { key: 'unknown', label: '❔ Origine inconnue',                                          color: 'bg-gray-400' },
]

function HourlyChart({ byHour }: { byHour: ReportData['byHour'] }) {
  const maxRev = Math.max(...byHour.map((h) => h.revenue), 1)
  const hasData = byHour.some((h) => h.revenue > 0)

  if (!hasData) {
    return <p className="text-center text-sm text-muted-foreground py-8">Aucune commande sur cette période</p>
  }

  return (
    <div>
      {/* Bars */}
      <div className="flex items-end gap-px h-28 px-1">
        {byHour.map((h) => {
          const pct = (h.revenue / maxRev) * 100
          const isEmpty = h.revenue === 0
          return (
            <div
              key={h.hour}
              className="flex-1 flex flex-col justify-end group relative"
              style={{ height: '100%' }}
            >
              {/* Tooltip */}
              {!isEmpty && (
                <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 z-10
                  hidden group-hover:flex flex-col items-center whitespace-nowrap
                  bg-[#1A1A1A] text-white text-[10px] px-2 py-1 rounded shadow-lg pointer-events-none">
                  <span className="font-bold">{h.revenue.toFixed(2)} DT</span>
                  <span className="text-white/60">{h.count} cmd</span>
                </div>
              )}
              {/* Bar */}
              <div
                className={`w-full rounded-t-sm transition-all ${
                  isEmpty ? 'bg-muted' : 'bg-[#F5A800] group-hover:bg-[#FF6B00]'
                }`}
                style={{ height: isEmpty ? '4px' : `${Math.max(pct, 4)}%` }}
              />
            </div>
          )
        })}
      </div>

      {/* Hour labels — every 3h */}
      <div className="flex gap-px px-1 mt-1">
        {byHour.map((h) => (
          <div key={h.hour} className="flex-1 text-center">
            {h.hour % 3 === 0 && (
              <span className="text-[9px] text-muted-foreground">{h.hour}h</span>
            )}
          </div>
        ))}
      </div>

      {/* Peak hour callout */}
      {(() => {
        const peak = byHour.reduce((best, h) => (h.revenue > best.revenue ? h : best), byHour[0])
        if (peak.revenue === 0) return null
        return (
          <p className="text-xs text-muted-foreground mt-3 text-center">
            Pic d&apos;activité à <span className="font-semibold text-[#F5A800]">{peak.hour}h</span>{' '}
            — {peak.revenue.toFixed(2)} DT · {peak.count} commande{peak.count > 1 ? 's' : ''}
          </p>
        )
      })()}
    </div>
  )
}

export default function ReportsClient() {
  const [preset, setPreset] = useState<Preset>('today')
  const [customFrom, setCustomFrom] = useState(todayStr())
  const [customTo, setCustomTo]     = useState(todayStr())
  const [data, setData]   = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchReport = useCallback(async (p: Preset, from?: string, to?: string) => {
    setLoading(true)
    try {
      const range = getDateRange(p, from, to)
      const res = await fetch(`/api/reports?from=${range.from}&to=${range.to}`)
      setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  // Auto-fetch when preset changes (except custom — needs explicit submit)
  useEffect(() => {
    if (preset !== 'custom') fetchReport(preset)
  }, [preset, fetchReport])

  const handleCustomSubmit = () => {
    if (customFrom && customTo && customFrom <= customTo) {
      fetchReport('custom', customFrom, customTo)
    }
  }

  const fmt = (n: number) => n.toFixed(2)
  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })

  return (
    <div className="space-y-6">

      {/* Period selector */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPreset(p.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                preset === p.key
                  ? 'bg-[#F5A800] text-black shadow-sm'
                  : 'bg-muted/50 border border-border hover:bg-muted text-foreground'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom date range inputs */}
        {preset === 'custom' && (
          <div className="flex flex-wrap items-end gap-3 pt-1 border-t border-border">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Du</label>
              <input
                type="date"
                value={customFrom}
                max={customTo}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="block border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5A800] focus:border-transparent"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Au</label>
              <input
                type="date"
                value={customTo}
                min={customFrom}
                max={todayStr()}
                onChange={(e) => setCustomTo(e.target.value)}
                className="block border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5A800] focus:border-transparent"
              />
            </div>
            <button
              onClick={handleCustomSubmit}
              disabled={!customFrom || !customTo || customFrom > customTo}
              className="px-5 py-2 bg-[#1A1A1A] hover:bg-[#F5A800] text-white hover:text-black font-semibold rounded-lg text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Générer
            </button>
          </div>
        )}
      </div>

      {loading && (
        <div className="text-center py-20 text-muted-foreground text-sm">Chargement du rapport…</div>
      )}

      {!loading && data && (
        <>
          {/* ── Summary cards ─────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-green-200 lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">CA net reçu</CardTitle>
                <TrendingUp size={18} className="text-green-600" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-black text-green-600">{fmt(data.netTotalRevenue)} DT</p>
                {data.byType.delivery.count > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Brut {fmt(data.totalRevenue)} DT — commissions {fmt(data.deliverySummary.commissionAmount)} DT
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Commandes</CardTitle>
                <ShoppingBag size={18} className="text-blue-500" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-black text-blue-500">{data.orderCount}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Panier moyen</CardTitle>
                <Receipt size={18} className="text-[#F5A800]" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-black text-[#F5A800]">{fmt(data.avgOrder)} DT</p>
              </CardContent>
            </Card>
          </div>

          {/* ── Delivery financial summary (only when delivery orders exist) ── */}
          {data.byType.delivery.count > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="border-orange-100">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">CA livraison brut</CardTitle>
                  <Bike size={18} className="text-orange-400" />
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-black text-orange-500">{fmt(data.deliverySummary.gross)} DT</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {data.byType.delivery.count} commande{data.byType.delivery.count > 1 ? 's' : ''}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-red-100">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Commission payée</CardTitle>
                  <TrendingDown size={18} className="text-red-400" />
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-black text-red-500">-{fmt(data.deliverySummary.commissionAmount)} DT</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {data.deliverySummary.gross > 0
                      ? `${((data.deliverySummary.commissionAmount / data.deliverySummary.gross) * 100).toFixed(1)}% du brut`
                      : '—'}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-green-100">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Net reçu livraison</CardTitle>
                  <BadgeDollarSign size={18} className="text-green-500" />
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-black text-green-600">{fmt(data.deliverySummary.net)} DT</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {data.deliverySummary.gross > 0
                      ? `${((data.deliverySummary.net / data.deliverySummary.gross) * 100).toFixed(1)}% récupéré`
                      : '—'}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {data.orderCount === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm bg-card rounded-xl border">
              Aucune commande pour cette période
            </div>
          ) : (
            <>
              {/* ── Hourly chart ──────────────────────────────────── */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">CA par heure de la journée</CardTitle>
                </CardHeader>
                <CardContent>
                  <HourlyChart byHour={data.byHour} />
                </CardContent>
              </Card>

              {/* ── Type + Origine + Status row ────────────────────── */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Répartition par type</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {[
                      { label: '🛵 Livraison',           count: data.byType.delivery.count, revenue: data.byType.delivery.revenue, color: 'bg-[#F5A800]' },
                      { label: '🏪 Comptoir / Emporter', count: data.byType.pickup.count,   revenue: data.byType.pickup.revenue,   color: 'bg-blue-500' },
                    ].map((row) => (
                      <div key={row.label}>
                        <div className="flex justify-between text-sm mb-1.5">
                          <span className="text-muted-foreground">{row.label}</span>
                          <span className="font-semibold">{row.count} · {fmt(row.revenue)} DT</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full ${row.color} rounded-full transition-all duration-500`}
                            style={{ width: data.totalRevenue > 0 ? `${(row.revenue / data.totalRevenue) * 100}%` : '0%' }}
                          />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Répartition par origine</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {SOURCE_ROWS.map(({ key, label, color }) => {
                      const row = data.bySource?.[key]
                      if (!row || row.count === 0) return null
                      return (
                        <div key={key}>
                          <div className="flex justify-between text-sm mb-1.5">
                            <span className="text-muted-foreground">{label}</span>
                            <span className="font-semibold">{row.count} · {fmt(row.revenue)} DT</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full ${color} rounded-full transition-all duration-500`}
                              style={{ width: data.totalRevenue > 0 ? `${(row.revenue / data.totalRevenue) * 100}%` : '0%' }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Statuts des commandes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      {STATUS_LABELS.map(({ key, label, color }) => {
                        const count = data.byStatus[key]
                        if (count === 0) return null
                        return (
                          <div key={key} className="flex justify-between items-center">
                            <span className="text-muted-foreground">{label}</span>
                            <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${color}`}>{count}</span>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* ── By day ────────────────────────────────────────── */}
              {data.byDay.length > 1 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Ventes par jour</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm min-w-120">
                        <thead className="bg-muted/50 border-b">
                          <tr>
                            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Commandes</th>
                            <th className="px-4 py-3 text-right font-medium text-muted-foreground">CA</th>
                            <th className="px-4 py-3 w-40 font-medium text-muted-foreground">Progression</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {(() => {
                            const maxRev = Math.max(...data.byDay.map((x) => x.revenue))
                            return data.byDay.map((d) => (
                              <tr key={d.date} className="hover:bg-muted/50">
                                <td className="px-4 py-3 font-medium">{fmtDate(d.date)}</td>
                                <td className="px-4 py-3 text-right text-muted-foreground">{d.count}</td>
                                <td className="px-4 py-3 text-right font-semibold text-[#F5A800]">{fmt(d.revenue)} DT</td>
                                <td className="px-4 py-3 pr-6">
                                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-[#F5A800] rounded-full"
                                      style={{ width: `${maxRev > 0 ? (d.revenue / maxRev) * 100 : 0}%` }}
                                    />
                                  </div>
                                </td>
                              </tr>
                            ))
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* ── By delivery company ───────────────────────────── */}
              {data.byDeliveryCompany.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Plateformes de livraison</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm min-w-120">
                        <thead className="bg-muted/50 border-b">
                          <tr>
                            {['Plateforme', 'Commandes', 'CA brut', 'Commission', 'Net reçu'].map((h) => (
                              <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {data.byDeliveryCompany.map((c) => (
                            <tr key={c.name} className="hover:bg-muted/50">
                              <td className="px-4 py-3 font-semibold">{c.name}</td>
                              <td className="px-4 py-3 text-muted-foreground">{c.count}</td>
                              <td className="px-4 py-3 font-medium">{fmt(c.revenue)} DT</td>
                              <td className="px-4 py-3">
                                <span className="text-xs font-bold text-red-500 bg-red-50 px-2.5 py-0.5 rounded-full">
                                  -{fmt(c.commissionAmount)} DT ({c.commission}%)
                                </span>
                              </td>
                              <td className="px-4 py-3 font-semibold text-green-600">{fmt(c.net)} DT</td>
                            </tr>
                          ))}
                        </tbody>
                        {data.byDeliveryCompany.length >= 1 && (
                          <tfoot className="border-t-2 border-border bg-muted/50">
                            <tr>
                              <td className="px-4 py-3 font-black text-sm">TOTAL</td>
                              <td className="px-4 py-3 font-bold text-sm">
                                {data.byDeliveryCompany.reduce((s, c) => s + c.count, 0)}
                              </td>
                              <td className="px-4 py-3 font-bold text-sm">
                                {fmt(data.deliverySummary.gross)} DT
                              </td>
                              <td className="px-4 py-3 font-bold text-sm text-red-500">
                                -{fmt(data.deliverySummary.commissionAmount)} DT
                              </td>
                              <td className="px-4 py-3 font-black text-sm text-green-600">
                                {fmt(data.deliverySummary.net)} DT
                              </td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* ── Top products ──────────────────────────────────── */}
              {data.topProducts.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Top produits — comptoir & emporter</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm min-w-96">
                        <thead className="bg-muted/50 border-b">
                          <tr>
                            <th className="px-4 py-3 text-left font-medium text-muted-foreground w-10">#</th>
                            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Produit</th>
                            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Qté</th>
                            <th className="px-4 py-3 text-right font-medium text-muted-foreground">CA</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {data.topProducts.map((p, i) => (
                            <tr key={p.name} className="hover:bg-muted/50">
                              <td className="px-4 py-3 text-muted-foreground text-xs">{i + 1}</td>
                              <td className="px-4 py-3 font-medium">{p.name}</td>
                              <td className="px-4 py-3 text-right text-muted-foreground">{p.qty}</td>
                              <td className="px-4 py-3 text-right font-semibold text-[#F5A800]">{fmt(p.revenue)} DT</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* ── Caisse & trésorerie ───────────────────────────── */}
          <CashSection data={data} />
        </>
      )}
    </div>
  )
}

const money = (n: number) => `${(Number(n) || 0).toFixed(2)} DT`

/** Un écart sous le demi-centime n'en est pas un : les prix arrondis laissent de la poussière. */
const ecartTone = (gap: number) =>
  Math.abs(gap) < 0.005
    ? 'text-green-600 dark:text-green-400'
    : gap > 0
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-red-600 dark:text-red-400'

/**
 * Caisse & trésorerie : ce que la période a coûté en espèces, ce qui a été
 * remis dans le tiroir, et comment chaque service s'est terminé.
 *
 * La question à laquelle cette section répond n'est pas « combien avons-nous
 * vendu » — le haut du rapport s'en charge — mais « où est passé l'argent » :
 * le pain payé au comptant, le fond complété à midi, le tiroir qui tombe juste
 * ou pas. Les deux familles de mouvements restent séparées, parce qu'un fond
 * complété n'est pas une dépense.
 */
function CashSection({ data }: { data: ReportData }) {
  const sorties = data.sorties
  const fond = data.fond
  const recettes = data.recettes ?? []
  const caisse = data.caisse
  const hasSorties = (sorties?.count ?? 0) > 0
  const hasFond = (fond?.count ?? 0) > 0
  if (!hasSorties && !hasFond && recettes.length === 0) return null

  const fmtDay = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : '—'
  const fmtTime = (d: string | null) =>
    d ? new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'

  return (
    <div className="space-y-4">
      <div className="flex items-baseline gap-3 pt-2">
        <h2 className="text-lg font-bold">Caisse &amp; trésorerie</h2>
        <p className="text-xs text-muted-foreground">
          Les espèces qui ont bougé sur la période, sessions comprises
        </p>
      </div>

      {(hasSorties || hasFond) && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Tile
            label="Achats"
            value={`− ${money(sorties?.achats ?? 0)}`}
            hint="Marchandise payée en espèces"
            icon={<ShoppingCart size={18} className="text-amber-500" />}
            tone="text-amber-600 dark:text-amber-400"
          />
          <Tile
            label="Dépenses"
            value={`− ${money(sorties?.depenses ?? 0)}`}
            hint="Livreur, avances, réparations…"
            icon={<TrendingDown size={18} className="text-orange-500" />}
            tone="text-orange-600 dark:text-orange-400"
          />
          <Tile
            label="Ajouts au fond"
            value={`+ ${money(fond?.apports ?? 0)}`}
            hint={
              (fond?.retraits ?? 0) > 0
                ? `Retraits − ${money(fond?.retraits ?? 0)}`
                : 'Monnaie remise dans le tiroir'
            }
            icon={<PiggyBank size={18} className="text-emerald-500" />}
            tone="text-emerald-600 dark:text-emerald-400"
          />
          <Tile
            label="Solde après sorties"
            value={money(data.solde ?? data.netTotalRevenue - (sorties?.total ?? 0))}
            hint="CA net − achats − dépenses"
            icon={<Wallet size={18} className="text-green-600" />}
            tone="text-green-600"
          />
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {hasSorties && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Où part l&apos;argent</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {sorties?.byLabel.map((line) => {
                const meta = isMovementKind(line.kind) ? MOVEMENT_META[line.kind] : null
                const max = Math.max(...(sorties?.byLabel.map((l) => l.amount) ?? [1]), 1)
                return (
                  <div key={`${line.kind}-${line.label}`}>
                    <div className="flex justify-between items-center gap-2 text-sm mb-1.5">
                      <span className="flex items-center gap-2 min-w-0">
                        <span
                          className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            meta?.badge ?? 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {meta?.short ?? line.kind}
                        </span>
                        <span className="truncate">{line.label || '—'}</span>
                        {line.count > 1 && (
                          <span className="text-xs text-muted-foreground shrink-0">×{line.count}</span>
                        )}
                      </span>
                      <span className="font-semibold whitespace-nowrap">{money(line.amount)}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full transition-all duration-500"
                        style={{ width: `${(line.amount / max) * 100}%` }}
                      />
                    </div>
                  </div>
                )
              })}
              <p className="text-xs text-muted-foreground pt-1">
                {sorties?.count} mouvement{(sorties?.count ?? 0) > 1 ? 's' : ''} · total{' '}
                <span className="font-semibold text-foreground">{money(sorties?.total ?? 0)}</span>
              </p>
            </CardContent>
          </Card>
        )}

        {hasFond && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Mouvements de fond</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              <p className="text-xs text-muted-foreground -mt-1">
                Des espèces déplacées, pas dépensées : elles ne changent pas le résultat du
                service, seulement ce que le tiroir doit contenir.
              </p>
              {fond?.byLabel.map((line) => {
                const meta = isMovementKind(line.kind) ? MOVEMENT_META[line.kind] : null
                return (
                  <div
                    key={`${line.kind}-${line.label}`}
                    className="flex justify-between items-center gap-2 text-sm"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span
                        className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          meta?.badge ?? 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {meta?.short ?? line.kind}
                      </span>
                      <span className="truncate">{line.label || '—'}</span>
                      {line.count > 1 && (
                        <span className="text-xs text-muted-foreground shrink-0">×{line.count}</span>
                      )}
                    </span>
                    <span className={`font-semibold whitespace-nowrap ${meta?.amountTone ?? ''}`}>
                      {meta && meta.sign > 0 ? '+' : '−'} {money(line.amount)}
                    </span>
                  </div>
                )
              })}
              <div className="flex justify-between items-center border-t pt-2 text-sm">
                <span className="text-muted-foreground">Net remis dans les tiroirs</span>
                <span className="font-black">
                  {(fond?.net ?? 0) >= 0 ? '+' : '−'} {money(Math.abs(fond?.net ?? 0))}
                </span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {recettes.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Sessions de caisse</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {caisse && (
              <p className="px-4 pb-3 text-xs text-muted-foreground">
                {caisse.sessions} session{caisse.sessions > 1 ? 's' : ''}
                {caisse.open > 0 ? ` · ${caisse.open} encore ouverte${caisse.open > 1 ? 's' : ''}` : ''}{' '}
                · {caisse.counted} comptée{caisse.counted > 1 ? 's' : ''}
                {caisse.manquants.count > 0 && (
                  <span className="text-red-600 dark:text-red-400 font-semibold">
                    {' '}
                    · {caisse.manquants.count} manquant{caisse.manquants.count > 1 ? 's' : ''} pour{' '}
                    {money(caisse.manquants.amount)}
                  </span>
                )}
                {caisse.excedents.count > 0 && (
                  <span className="text-amber-600 dark:text-amber-400 font-semibold">
                    {' '}
                    · {caisse.excedents.count} excédent{caisse.excedents.count > 1 ? 's' : ''} pour{' '}
                    {money(caisse.excedents.amount)}
                  </span>
                )}
              </p>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-200">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    {['N°', 'Jour', 'Horaires', 'Cmd', 'CA', 'Sorties', 'Fond (net)', 'Attendu', 'Compté', 'Écart'].map(
                      (h) => (
                        <th key={h} className="px-3 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {recettes.map((r) => (
                    <tr key={r._id} className="hover:bg-muted/50">
                      <td className="px-3 py-3 font-semibold whitespace-nowrap">
                        {r.number}
                        {r.status === 'open' && (
                          <span className="ml-1.5 text-[10px] font-bold text-green-600 dark:text-green-400">
                            en cours
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">{fmtDay(r.openedAt)}</td>
                      <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">
                        {fmtTime(r.openedAt)} → {r.status === 'open' ? '…' : fmtTime(r.closedAt)}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">{r.orders}</td>
                      <td className="px-3 py-3 font-semibold">{money(r.revenue)}</td>
                      <td className="px-3 py-3">
                        {r.sorties > 0 ? (
                          <span className="text-amber-600 dark:text-amber-400">− {money(r.sorties)}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {/* Ajouts moins retraits : vert quand le tiroir s'est rempli,
                            neutre quand il s'est vidé — un moins en vert se lit mal. */}
                        {r.fond ? (
                          <span
                            className={
                              r.fond > 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-sky-600 dark:text-sky-400'
                            }
                          >
                            {r.fond > 0 ? '+' : '−'} {money(Math.abs(r.fond))}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3">{money(r.expected)}</td>
                      <td className="px-3 py-3">
                        {r.closingCash === null ? (
                          <span className="text-muted-foreground">non compté</span>
                        ) : (
                          money(r.closingCash)
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {r.ecart === null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span className={`font-semibold ${ecartTone(r.ecart)}`}>
                            {r.ecart > 0 ? '+' : ''}
                            {r.ecart.toFixed(2)} DT
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function Tile({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string
  value: string
  hint: string
  icon: React.ReactNode
  tone: string
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <p className={`text-xl font-black ${tone}`}>{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>
      </CardContent>
    </Card>
  )
}
