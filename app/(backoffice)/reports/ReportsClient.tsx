'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, ShoppingBag, Receipt, Bike, BadgeDollarSign, TrendingDown } from 'lucide-react'

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
  byDeliveryCompany: { name: string; count: number; revenue: number; commission: number; net: number; commissionAmount: number }[]
  topProducts: { name: string; qty: number; revenue: number }[]
  byDay: { date: string; revenue: number; count: number }[]
  byHour: { hour: number; revenue: number; count: number }[]
  byStatus: { pending: number; confirmed: number; preparing: number; ready: number; delivered: number }
}

type Preset = 'today' | 'week' | 'month' | 'thisMonth'

function getDateRange(preset: Preset): { from: string; to: string } {
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  if (preset === 'today') return { from: today, to: today }
  if (preset === 'week') {
    const d = new Date(now)
    d.setDate(d.getDate() - 6)
    return { from: d.toISOString().slice(0, 10), to: today }
  }
  if (preset === 'month') {
    const d = new Date(now)
    d.setDate(d.getDate() - 29)
    return { from: d.toISOString().slice(0, 10), to: today }
  }
  const first = new Date(now.getFullYear(), now.getMonth(), 1)
  return { from: first.toISOString().slice(0, 10), to: today }
}

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'today',     label: "Aujourd'hui" },
  { key: 'week',      label: '7 derniers jours' },
  { key: 'month',     label: '30 derniers jours' },
  { key: 'thisMonth', label: 'Ce mois-ci' },
]

const STATUS_LABELS: { key: keyof ReportData['byStatus']; label: string; color: string }[] = [
  { key: 'delivered', label: 'Livrées / Servies', color: 'text-green-600 bg-green-50' },
  { key: 'ready',     label: 'Prêtes',            color: 'text-blue-600 bg-blue-50' },
  { key: 'preparing', label: 'En préparation',    color: 'text-yellow-600 bg-yellow-50' },
  { key: 'confirmed', label: 'Confirmées',         color: 'text-purple-600 bg-purple-50' },
  { key: 'pending',   label: 'En attente',         color: 'text-gray-600 bg-gray-100' },
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
                  isEmpty ? 'bg-gray-100' : 'bg-[#F5A800] group-hover:bg-[#FF6B00]'
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
              <span className="text-[9px] text-gray-400">{h.hour}h</span>
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
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchReport = useCallback(async (p: Preset) => {
    setLoading(true)
    try {
      const { from, to } = getDateRange(p)
      const res = await fetch(`/api/reports?from=${from}&to=${to}`)
      setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchReport(preset) }, [preset, fetchReport])

  const fmt = (n: number) => n.toFixed(2)
  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })

  return (
    <div className="space-y-6">

      {/* Period selector */}
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPreset(p.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              preset === p.key
                ? 'bg-[#F5A800] text-black shadow-sm'
                : 'bg-white border border-gray-200 hover:bg-gray-50 text-gray-700'
            }`}
          >
            {p.label}
          </button>
        ))}
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
            <div className="text-center py-16 text-muted-foreground text-sm bg-white rounded-xl border">
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

              {/* ── Type + Status row ──────────────────────────────── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
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
                        <thead className="bg-gray-50 border-b">
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
                              <tr key={d.date} className="hover:bg-gray-50">
                                <td className="px-4 py-3 font-medium">{fmtDate(d.date)}</td>
                                <td className="px-4 py-3 text-right text-muted-foreground">{d.count}</td>
                                <td className="px-4 py-3 text-right font-semibold text-[#F5A800]">{fmt(d.revenue)} DT</td>
                                <td className="px-4 py-3 pr-6">
                                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
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
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            {['Plateforme', 'Commandes', 'CA brut', 'Commission', 'Net reçu'].map((h) => (
                              <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {data.byDeliveryCompany.map((c) => (
                            <tr key={c.name} className="hover:bg-gray-50">
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
                          <tfoot className="border-t-2 border-gray-300 bg-gray-50">
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
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="px-4 py-3 text-left font-medium text-muted-foreground w-10">#</th>
                            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Produit</th>
                            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Qté</th>
                            <th className="px-4 py-3 text-right font-medium text-muted-foreground">CA</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {data.topProducts.map((p, i) => (
                            <tr key={p.name} className="hover:bg-gray-50">
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
        </>
      )}
    </div>
  )
}
