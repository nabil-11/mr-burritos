'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, ShoppingBag, Receipt, Bike, BadgeDollarSign, TrendingDown, ShoppingCart, PiggyBank, Wallet } from 'lucide-react'
import { ORDER_SOURCE_ICONS, ORDER_SOURCE_LABELS, type OrderSource } from '@/lib/orderSource'

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
  byDeliveryCompany: {
    name: string
    count: number
    revenue: number
    commission: number
    net: number
    commissionAmount: number
    due?: number
    paidNet?: number
    paidCount?: number
    unpaidNet?: number
    unpaidCount?: number
  }[]
  byPayment: {
    cash: { count: number; revenue: number }
    card: { count: number; revenue: number }
    other: { count: number; revenue: number }
    unknown: { count: number; revenue: number }
  }
  sorties?: {
    achats: number
    depenses: number
    total: number
    count: number
  }
  fond?: {
    apports: number
    retraits: number
    net: number
    count: number
  }
  solde?: number
  recettes?: {
    _id: string
    number: string
    status: 'open' | 'closed'
    openedAt: string | null
    closedAt: string | null
    orders: number
    revenue: number
    net: number
    sorties: number
    fond?: number
    openingFloat: number
    expected: number
    closingCash: number | null
  }[]
  caisse?: {
    sessions: number
    open: number
    counted: number
    ecartTotal: number
    manquants: { count: number; amount: number }
    excedents: { count: number; amount: number }
  }
}

type Preset = 'today' | 'yesterday' | 'week' | 'month' | 'thisMonth' | 'custom'

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
  if (preset === 'yesterday') {
    const d = new Date(now)
    d.setDate(d.getDate() - 1)
    return { from: dayString(d), to: dayString(d) }
  }
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
  return { from: customFrom || today, to: customTo || today }
}

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'today', label: "Aujourd'hui" },
  { key: 'yesterday', label: 'Hier' },
  { key: 'week', label: '7 derniers jours' },
  { key: 'month', label: '30 derniers jours' },
  { key: 'thisMonth', label: 'Ce mois-ci' },
  { key: 'custom', label: 'Personnalisé' },
]

const STATUS_LABELS: { key: keyof ReportData['byType']; label: string; color: string }[] = [
  { key: 'delivery', label: 'Livraison', color: 'text-orange-600 bg-orange-50' },
  { key: 'pickup', label: 'Comptoir / Emporter', color: 'text-blue-600 bg-blue-50' },
]

const SOURCE_ROWS: { key: OrderSource | 'unknown'; label: string; color: string }[] = [
  { key: 'website', label: `${ORDER_SOURCE_ICONS.website} ${ORDER_SOURCE_LABELS.website}`, color: 'bg-[#F5A800]' },
  { key: 'counter', label: `${ORDER_SOURCE_ICONS.counter} ${ORDER_SOURCE_LABELS.counter}`, color: 'bg-blue-500' },
  { key: 'kiosk', label: `${ORDER_SOURCE_ICONS.kiosk} ${ORDER_SOURCE_LABELS.kiosk}`, color: 'bg-purple-500' },
  { key: 'unknown', label: '❔ Origine inconnue', color: 'bg-gray-400' },
]

export default function ReportsClient() {
  const [preset, setPreset] = useState<Preset>('today')
  const [customFrom, setCustomFrom] = useState(todayStr())
  const [customTo, setCustomTo] = useState(todayStr())
  const [data, setData] = useState<ReportData | null>(null)
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
                <CardTitle className="text-sm font-medium text-muted-foreground">Recettes</CardTitle>
                <Receipt size={18} className="text-[#F5A800]" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-black text-[#F5A800]">{data.caisse?.sessions ?? 0}</p>
                <p className="text-xs text-muted-foreground">{data.orderCount} commandes</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Panier moyen</CardTitle>
                <ShoppingBag size={18} className="text-blue-500" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-black text-blue-500">{fmt(data.avgOrder)} DT</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Répartition par type</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {STATUS_LABELS.map(({ key, label, color }) => {
                  const row = data.byType[key]
                  if (!row || row.count === 0) return null
                  return (
                    <div key={key}>
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-semibold">{row.count} · {fmt(row.revenue)} DT</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full ${color.includes('orange') ? 'bg-orange-500' : 'bg-blue-500'} rounded-full transition-all duration-500`}
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
                <CardTitle className="text-base">Règlement</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Espèces</span>
                  <span className="font-semibold">{fmt(data.byPayment.cash.revenue)} DT</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">TPE</span>
                  <span className="font-semibold">{fmt(data.byPayment.card.revenue)} DT</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Plateformes réglées</span>
                  <span className="font-semibold">{fmt(data.deliverySummary.commissionAmount)} DT</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">À recevoir</span>
                  <span className="font-semibold text-amber-600">{fmt(data.deliverySummary.net)} DT</span>
                </div>
              </CardContent>
            </Card>
          </div>

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
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Plateforme</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">Commandes</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">CA brut</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">Commission</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">Net reçu</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {data.byDeliveryCompany.map((c) => (
                        <tr key={c.name} className="hover:bg-muted/50">
                          <td className="px-4 py-3 font-semibold">{c.name}</td>
                          <td className="px-4 py-3 text-right text-muted-foreground">{c.count}</td>
                          <td className="px-4 py-3 text-right font-medium">{fmt(c.revenue)} DT</td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-xs font-bold text-red-500 bg-red-50 px-2.5 py-0.5 rounded-full">
                              -{fmt(c.commissionAmount)} DT ({c.commission}%)
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-green-600">{fmt(c.net)} DT</td>
                        </tr>
                      ))}
                    </tbody>
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
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Trésorerie</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ventes espèces</span>
                  <span className="font-semibold text-green-600">+ {fmt(data.byPayment.cash.revenue)} DT</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">TPE</span>
                  <span className="font-semibold text-green-600">+ {fmt(data.byPayment.card.revenue)} DT</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Achats</span>
                  <span className="font-semibold text-red-600">- {fmt(data.sorties?.achats ?? 0)} DT</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Dépenses</span>
                  <span className="font-semibold text-red-600">- {fmt(data.sorties?.depenses ?? 0)} DT</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ajouts au fond</span>
                  <span className="font-semibold text-emerald-600">+ {fmt(data.fond?.apports ?? 0)} DT</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Retraits</span>
                  <span className="font-semibold text-sky-600">- {fmt(data.fond?.retraits ?? 0)} DT</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-muted-foreground">Solde</span>
                  <span className="font-black">{fmt(data.solde ?? 0)} DT</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Caisse</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Recettes</span>
                  <span className="font-semibold">{data.caisse?.sessions ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ouvertes</span>
                  <span className="font-semibold">{data.caisse?.open ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Comptées</span>
                  <span className="font-semibold">{data.caisse?.counted ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Manquants</span>
                  <span className="font-semibold text-red-600">{data.caisse?.manquants.count ?? 0} ({fmt(data.caisse?.manquants.amount ?? 0)} DT)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Excédents</span>
                  <span className="font-semibold text-amber-600">{data.caisse?.excedents.count ?? 0} ({fmt(data.caisse?.excedents.amount ?? 0)} DT)</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {data.recettes && data.recettes.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Recettes</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-120">
                    <thead className="bg-muted/50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">N°</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Statut</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Ouverture</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">Commandes</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">CA</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">Net</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {data.recettes.map((r) => (
                        <tr key={r._id} className="hover:bg-muted/50">
                          <td className="px-4 py-3 font-semibold">{r.number}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${r.status === 'open' ? 'text-green-600 bg-green-50' : 'text-muted-foreground bg-muted'}`}>
                              {r.status === 'open' ? 'Ouverte' : 'Fermée'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {r.openedAt ? new Date(r.openedAt).toLocaleDateString('fr-FR') : '—'}
                          </td>
                          <td className="px-4 py-3 text-right">{r.orders}</td>
                          <td className="px-4 py-3 text-right font-semibold text-[#F5A800]">{fmt(r.revenue)} DT</td>
                          <td className="px-4 py-3 text-right font-semibold text-green-600">{fmt(r.net)} DT</td>
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
    </div>
  )
}
