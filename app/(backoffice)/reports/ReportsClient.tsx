'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { AlertTriangle, Download, RefreshCw } from 'lucide-react'
import { ORDER_SOURCE_ICONS, ORDER_SOURCE_LABELS, type OrderSource } from '@/lib/orderSource'
import { MOVEMENT_LIST, MOVEMENT_META } from '@/lib/movementKinds'
// Types seulement : le calcul vit côté serveur, rien de Mongo n'arrive ici.
import type { RecetteReport, ReportRecetteRow } from '@/lib/recetteReport'

/**
 * Le rapport des recettes : une période, la somme exacte de ses sessions de
 * caisse. Chaque total se retrouve ligne à ligne dans le tableau des recettes,
 * et chaque ligne renvoie à la page de sa recette.
 */

type Preset = 'today' | 'yesterday' | 'week' | 'month' | 'thisMonth' | 'lastMonth' | 'custom'

function dayString(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const todayStr = () => dayString(new Date())

function getDateRange(preset: Preset, customFrom?: string, customTo?: string): { from: string; to: string } {
  const now = new Date()
  const today = todayStr()
  const back = (n: number) => {
    const d = new Date(now)
    d.setDate(d.getDate() - n)
    return dayString(d)
  }
  if (preset === 'today') return { from: today, to: today }
  if (preset === 'yesterday') return { from: back(1), to: back(1) }
  if (preset === 'week') return { from: back(6), to: today }
  if (preset === 'month') return { from: back(29), to: today }
  if (preset === 'thisMonth') return { from: dayString(new Date(now.getFullYear(), now.getMonth(), 1)), to: today }
  if (preset === 'lastMonth') {
    return {
      from: dayString(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      to: dayString(new Date(now.getFullYear(), now.getMonth(), 0)),
    }
  }
  return { from: customFrom || today, to: customTo || today }
}

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'today', label: "Aujourd'hui" },
  { key: 'yesterday', label: 'Hier' },
  { key: 'week', label: '7 derniers jours' },
  { key: 'month', label: '30 derniers jours' },
  { key: 'thisMonth', label: 'Ce mois-ci' },
  { key: 'lastMonth', label: 'Mois dernier' },
  { key: 'custom', label: 'Personnalisé' },
]

const SOURCE_ROWS: { key: OrderSource | 'unknown'; label: string }[] = [
  { key: 'website', label: `${ORDER_SOURCE_ICONS.website} ${ORDER_SOURCE_LABELS.website}` },
  { key: 'counter', label: `${ORDER_SOURCE_ICONS.counter} ${ORDER_SOURCE_LABELS.counter}` },
  { key: 'kiosk', label: `${ORDER_SOURCE_ICONS.kiosk} ${ORDER_SOURCE_LABELS.kiosk}` },
  { key: 'unknown', label: '❔ Origine inconnue' },
]

const money = (n: number) => `${(n || 0).toFixed(2)} DT`
const signed = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(2)} DT`
const dateFr = (d: string | null) => (d ? new Date(d).toLocaleDateString('fr-FR') : '')
const timeFr = (d: string | null) =>
  d ? new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''
const dayFr = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' })
const duration = (min: number | null) =>
  min === null ? '—' : `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`

/** Vert si juste, ambre si excédent, rouge si manquant. */
const gapTone = (gap: number | null) =>
  gap === null
    ? 'text-muted-foreground'
    : Math.abs(gap) < 0.005
      ? 'text-green-600 dark:text-green-400'
      : gap > 0
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-red-600 dark:text-red-400'

export default function ReportsClient() {
  const [preset, setPreset] = useState<Preset>('today')
  const [customFrom, setCustomFrom] = useState(todayStr())
  const [customTo, setCustomTo] = useState(todayStr())
  const [range, setRange] = useState(() => getDateRange('today'))
  const [data, setData] = useState<RecetteReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchReport = useCallback(async (r: { from: string; to: string }) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/reports?from=${r.from}&to=${r.to}`, { cache: 'no-store' })
      const body = await res.json()
      if (!res.ok) throw new Error(body?.error || 'Erreur serveur')
      setData(body as RecetteReport)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur serveur')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (preset === 'custom') return
    const r = getDateRange(preset)
    setRange(r)
    fetchReport(r)
  }, [preset, fetchReport])

  const handleCustomSubmit = () => {
    if (customFrom && customTo && customFrom <= customTo) {
      const r = { from: customFrom, to: customTo }
      setRange(r)
      fetchReport(r)
    }
  }

  return (
    <div className="space-y-5">
      {/* ── Période ───────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
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
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => fetchReport(range)}
              disabled={loading}
              title="Actualiser"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border border-border hover:bg-muted disabled:opacity-40"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Actualiser</span>
            </button>
            <button
              onClick={() => data && exportCsv(data)}
              disabled={!data || data.recettes.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold bg-[#1A1A1A] text-white hover:bg-[#F5A800] hover:text-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download size={14} /> CSV
            </button>
          </div>
        </div>
        {preset === 'custom' && (
          <div className="flex flex-wrap items-end gap-3 pt-3 border-t border-border">
            <DateInput label="Du" value={customFrom} max={customTo} onChange={setCustomFrom} />
            <DateInput label="Au" value={customTo} min={customFrom} max={todayStr()} onChange={setCustomTo} />
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

      {loading && !data && (
        <div className="text-center py-20 text-muted-foreground text-sm">Chargement du rapport…</div>
      )}
      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/5 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          Impossible de charger le rapport : {error}
        </div>
      )}

      {data && <Report data={data} loading={loading} />}
    </div>
  )
}

function Report({ data, loading }: { data: RecetteReport; loading: boolean }) {
  const s = data.summary
  const c = data.caisse
  const multiDay = data.period.days > 1

  if (s.sessions === 0) {
    return (
      <div className={`space-y-4 ${loading ? 'opacity-60' : ''}`}>
        <PeriodLine data={data} />
        <Alerts data={data} />
        <div className="rounded-xl border bg-card py-16 text-center text-sm text-muted-foreground">
          Aucune recette ouverte sur cette période.
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-5 transition-opacity ${loading ? 'opacity-60' : ''}`}>
      <PeriodLine data={data} />
      <Alerts data={data} />

      {/* ── Chiffres clés ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi
          label="Chiffre d'affaires"
          value={money(s.revenue)}
          hint={s.commission > 0 ? `Net ${money(s.net)} après commissions` : `${s.orders} commandes`}
          tone="text-[#F5A800]"
        />
        <Kpi
          label="Encaissé"
          value={money(s.collected)}
          hint="Espèces, TPE, plateformes réglées"
          tone="text-emerald-600 dark:text-emerald-400"
        />
        <Kpi
          label="À recevoir"
          value={money(s.receivable)}
          hint={
            // Un versement pointé depuis la clôture fait baisser ce qui reste dû.
            Math.abs(data.platformsOutstandingNow - (s.platformDue - s.platformPaid)) >= 0.005
              ? `Encore dû aujourd'hui : ${money(data.platformsOutstandingNow + s.unsettled)}`
              : 'À la clôture des recettes'
          }
          tone={s.receivable > 0 ? 'text-amber-600 dark:text-amber-400' : undefined}
        />
        <Kpi
          label="Solde du service"
          value={money(s.solde)}
          hint={`Net − ${money(s.achats + s.depenses)} d'achats et dépenses`}
        />
        <Kpi
          label="Écart de caisse"
          value={c.counted > 0 ? signed(c.ecartNet) : '—'}
          hint={
            c.counted > 0
              ? `${c.counted}/${c.closed} comptée${c.counted > 1 ? 's' : ''} · ${c.manquants.count} manquant${c.manquants.count > 1 ? 's' : ''}`
              : 'Aucun tiroir compté'
          }
          tone={c.counted > 0 ? gapTone(c.ecartNet) : undefined}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Mini label="Recettes" value={String(s.sessions)} hint={s.open > 0 ? `dont ${s.open} ouverte` : 'toutes clôturées'} />
        <Mini label="Commandes" value={String(s.orders)} hint={s.inProgress > 0 ? `${s.inProgress} en cours` : undefined} />
        <Mini label="Panier moyen" value={money(s.avgTicket)} />
        <Mini label="Annulées" value={String(s.cancelled)} hint="hors de tous les totaux" />
      </div>

      <MoneyBar data={data} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CaisseCard data={data} />
        <MovementsCard data={data} />
      </div>

      {multiDay && <DaysTable data={data} />}

      <RecettesTable data={data} />

      {data.byCompany.length > 0 && <CompaniesTable data={data} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <BreakdownCard data={data} />
        <CashiersCard data={data} />
        <AmountsCard data={data} />
      </div>
    </div>
  )
}

// ── En-tête et alertes ─────────────────────────────────────────

function PeriodLine({ data }: { data: RecetteReport }) {
  const { from, to } = data.period
  return (
    <p className="text-xs text-muted-foreground">
      {from === to ? `Le ${dayFr(from)}` : `Du ${dayFr(from)} au ${dayFr(to)}`} · {data.summary.sessions} recette
      {data.summary.sessions > 1 ? 's' : ''} · une recette compte pour le jour de son ouverture · généré à{' '}
      {timeFr(data.generatedAt)}
    </p>
  )
}

function Alerts({ data }: { data: RecetteReport }) {
  const items: React.ReactNode[] = []
  if (data.summary.open > 0) {
    items.push(
      <>Une recette est encore <b>ouverte</b> : ses chiffres bougent jusqu&apos;à sa clôture.</>
    )
  }
  if (data.orphans.count > 0) {
    items.push(
      <>
        <b>{data.orphans.count} commande{data.orphans.count > 1 ? 's' : ''} hors recette</b> ({money(data.orphans.revenue)})
        — prises caisse fermée, elles ne figurent dans aucun tiroir ni dans ce rapport.
      </>
    )
  }
  if (data.caisse.uncounted > 0) {
    items.push(
      <>
        {data.caisse.uncounted} recette{data.caisse.uncounted > 1 ? 's' : ''} clôturée
        {data.caisse.uncounted > 1 ? 's' : ''} <b>sans comptage</b> des espèces : leur écart est inconnu.
      </>
    )
  }
  if (data.truncated) {
    items.push(<>Période trop chargée : seules les premières recettes ont été lues. Réduisez la période.</>)
  }
  if (items.length === 0) return null
  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 px-4 py-3 space-y-1.5">
      {items.map((item, i) => (
        <p key={i} className="flex items-start gap-2 text-sm text-foreground">
          <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>{item}</span>
        </p>
      ))}
    </div>
  )
}

// ── Où est l'argent ────────────────────────────────────────────

/**
 * Le chiffre d'affaires découpé en poches qui ne se recouvrent pas — la même
 * règle que la clôture (lib/platformSettlement). Les commissions sont ce qui
 * reste : la part du brut qu'aucune poche ne recevra jamais.
 */
function MoneyBar({ data }: { data: RecetteReport }) {
  const s = data.summary
  const platformLeft = Math.max(0, s.platformDue - s.platformPaid)
  const commission = Math.max(0, s.revenue - s.cashSales - s.cardSales - s.platformDue - s.unsettled)
  const segments = [
    { label: 'Espèces', hint: 'dans le tiroir', value: s.cashSales, color: 'bg-[#2a78d6] dark:bg-[#3987e5]' },
    { label: 'TPE', hint: 'en banque', value: s.cardSales, color: 'bg-[#eb6834] dark:bg-[#d95926]' },
    { label: 'Plateformes réglées', hint: 'versement pointé', value: s.platformPaid, color: 'bg-[#1baf7a] dark:bg-[#199e70]' },
    { label: 'Plateformes à recevoir', hint: 'à la clôture', value: platformLeft, color: 'bg-[#eda100] dark:bg-[#c98500]' },
    { label: 'Non renseigné', hint: 'règlement non noté', value: s.unsettled, color: 'bg-[#e87ba4] dark:bg-[#d55181]' },
    { label: 'Commissions', hint: 'gardées par les plateformes', value: commission, color: 'bg-muted-foreground/40' },
  ]
  const visible = segments.filter((seg) => seg.value > 0.004)
  const total = s.revenue || 1

  return (
    <Section title="Où est l'argent ?" subtitle={`${money(s.revenue)} de chiffre d'affaires, chaque commande dans une seule poche`}>
      <div className="px-4 pb-4 space-y-3">
        <div className="flex h-4 w-full gap-0.5 overflow-hidden rounded" role="img" aria-label="Répartition du chiffre d'affaires">
          {visible.map((seg, i) => (
            <div
              key={seg.label}
              title={`${seg.label} — ${money(seg.value)} (${((seg.value / total) * 100).toFixed(1)} %)`}
              className={`${seg.color} h-full ${i === 0 ? 'rounded-l' : ''} ${i === visible.length - 1 ? 'rounded-r' : ''}`}
              style={{ width: `${(seg.value / total) * 100}%` }}
            />
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-x-4 gap-y-2">
          {segments.map((seg) => (
            <div key={seg.label} className="text-xs">
              <p className="flex items-center gap-1.5 text-muted-foreground">
                <span className={`inline-block h-2.5 w-2.5 rounded-sm ${seg.color}`} />
                {seg.label}
              </p>
              <p className="font-bold text-sm tabular-nums text-foreground">{money(seg.value)}</p>
              <p className="text-[11px] text-muted-foreground">
                {((seg.value / total) * 100).toFixed(1)} % · {seg.hint}
              </p>
            </div>
          ))}
        </div>
      </div>
    </Section>
  )
}

// ── Caisse et mouvements ───────────────────────────────────────

function CaisseCard({ data }: { data: RecetteReport }) {
  const s = data.summary
  const c = data.caisse
  return (
    <Section title="Tiroir-caisse" subtitle="Ce que les espèces auraient dû devenir, et ce que les comptages ont trouvé">
      <dl className="divide-y">
        <Line label="Ventes en espèces" value={`+ ${money(s.cashSales)}`} />
        {s.apports > 0 && <Line label="Ajouts au fond" value={`+ ${money(s.apports)}`} />}
        {s.achats > 0 && <Line label="Achats" value={`− ${money(s.achats)}`} />}
        {s.depenses > 0 && <Line label="Dépenses" value={`− ${money(s.depenses)}`} />}
        {s.retraits > 0 && <Line label="Retraits" value={`− ${money(s.retraits)}`} />}
        <Line label="Espèces attendues (hors fonds d'ouverture)" value={money(s.cashExpected)} strong />
        <Line label="Tiroirs comptés" value={`${c.counted} / ${c.closed} clôturée${c.closed > 1 ? 's' : ''}`} />
        <Line label="Justes" value={String(c.balanced)} tone={c.balanced > 0 ? 'text-green-600 dark:text-green-400' : undefined} />
        <Line
          label="Manquants"
          value={c.manquants.count > 0 ? `${c.manquants.count} · − ${money(c.manquants.amount)}` : '0'}
          tone={c.manquants.count > 0 ? 'text-red-600 dark:text-red-400' : undefined}
        />
        <Line
          label="Excédents"
          value={c.excedents.count > 0 ? `${c.excedents.count} · + ${money(c.excedents.amount)}` : '0'}
          tone={c.excedents.count > 0 ? 'text-amber-600 dark:text-amber-400' : undefined}
        />
        <Line label="Écart net" value={c.counted > 0 ? signed(c.ecartNet) : '—'} tone={c.counted > 0 ? gapTone(c.ecartNet) : undefined} strong />
      </dl>
    </Section>
  )
}

function MovementsCard({ data }: { data: RecetteReport }) {
  const m = data.movements
  const any = MOVEMENT_LIST.some((k) => m.byKind[k.kind].count > 0)
  const max = Math.max(...m.top.map((l) => l.amount), 1)
  return (
    <Section title="Mouvements d'espèces" subtitle="Achats et dépenses coûtent ; ajouts et retraits déplacent seulement l'argent">
      {!any ? (
        <p className="px-4 pb-4 text-sm text-muted-foreground">Aucun mouvement sur la période.</p>
      ) : (
        <div className="px-4 pb-4 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {MOVEMENT_LIST.map((k) => (
              <div key={k.kind} className="rounded-lg border px-3 py-2">
                <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${k.badge}`}>{k.short}</span>
                <p className="mt-1 font-bold tabular-nums">{money(m.byKind[k.kind].amount)}</p>
                <p className="text-[11px] text-muted-foreground">
                  {m.byKind[k.kind].count} ligne{m.byKind[k.kind].count > 1 ? 's' : ''}
                </p>
              </div>
            ))}
          </div>
          {m.top.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Principaux postes</p>
              {m.top.map((l) => (
                <div key={`${l.kind}:${l.label}`} className="text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="truncate">
                      {l.label} <span className="text-xs text-muted-foreground">· {MOVEMENT_META[l.kind].short} ×{l.count}</span>
                    </span>
                    <span className={`font-semibold tabular-nums ${MOVEMENT_META[l.kind].amountTone}`}>{money(l.amount)}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-foreground/30" style={{ width: `${(l.amount / max) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
          {m.cancelled > 0 && (
            <p className="text-[11px] text-muted-foreground">
              {m.cancelled} ligne{m.cancelled > 1 ? 's' : ''} annulée{m.cancelled > 1 ? 's' : ''}, hors des totaux.
            </p>
          )}
        </div>
      )}
    </Section>
  )
}

// ── Par jour ───────────────────────────────────────────────────

function DaysTable({ data }: { data: RecetteReport }) {
  const max = Math.max(...data.byDay.map((d) => d.revenue), 1)
  const s = data.summary
  return (
    <Section title="Par jour" subtitle="Jour d'ouverture de chaque recette">
      <Table
        head={['Jour', 'Recettes', 'Commandes', "Chiffre d'affaires", 'Net', 'Encaissé', 'À recevoir', 'Sorties', 'Solde', 'Écart']}
        minWidth="min-w-225"
        foot={[
          'TOTAL',
          String(s.sessions),
          String(s.orders),
          money(s.revenue),
          money(s.net),
          money(s.collected),
          money(s.receivable),
          money(s.achats + s.depenses),
          money(s.solde),
          data.caisse.counted > 0 ? signed(data.caisse.ecartNet) : '—',
        ]}
      >
        {data.byDay.map((d) => (
          <tr key={d.day} className={`hover:bg-muted/50 ${d.sessions === 0 ? 'text-muted-foreground' : ''}`}>
            <Td className="font-semibold capitalize whitespace-nowrap">{dayFr(d.day)}</Td>
            <Td right>{d.sessions || '—'}</Td>
            <Td right>{d.orders || '—'}</Td>
            <Td right>
              <div className="flex items-center justify-end gap-2">
                <div className="hidden md:block w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-[#F5A800]" style={{ width: `${(d.revenue / max) * 100}%` }} />
                </div>
                <span className="font-semibold tabular-nums">{d.sessions ? money(d.revenue) : '—'}</span>
              </div>
            </Td>
            <Td right>{d.sessions ? money(d.net) : '—'}</Td>
            <Td right className="text-emerald-600 dark:text-emerald-400">{d.sessions ? money(d.collected) : '—'}</Td>
            <Td right className={d.receivable > 0 ? 'text-amber-600 dark:text-amber-400' : ''}>
              {d.receivable > 0 ? money(d.receivable) : '—'}
            </Td>
            <Td right>{d.sorties > 0 ? money(d.sorties) : '—'}</Td>
            <Td right>{d.sessions ? money(d.solde) : '—'}</Td>
            <Td right className={`font-semibold ${gapTone(d.ecart)}`}>{d.ecart === null ? '—' : signed(d.ecart)}</Td>
          </tr>
        ))}
      </Table>
    </Section>
  )
}

// ── Recette par recette ────────────────────────────────────────

function RecettesTable({ data }: { data: RecetteReport }) {
  const s = data.summary
  return (
    <Section title="Détail par recette" subtitle="Chaque ligne est exactement le ticket de clôture de la recette">
      <Table
        head={['N°', 'Ouverture', 'Clôture', 'Durée', 'Cmd', "Chiffre d'affaires", 'Espèces', 'TPE', 'Plateformes', 'À recevoir', 'Sorties', 'Attendu', 'Compté', 'Écart']}
        minWidth="min-w-300"
        left={3}
        foot={[
          'TOTAL',
          '',
          '',
          '',
          String(s.orders),
          money(s.revenue),
          money(s.cashSales),
          money(s.cardSales),
          money(s.platformDue),
          money(s.receivable),
          money(s.achats + s.depenses),
          '',
          '',
          data.caisse.counted > 0 ? signed(data.caisse.ecartNet) : '—',
        ]}
      >
        {data.recettes.map((r) => (
          <RecetteRow key={r._id} r={r} />
        ))}
      </Table>
    </Section>
  )
}

function RecetteRow({ r }: { r: ReportRecetteRow }) {
  return (
    <tr className="hover:bg-muted/50">
      <Td>
        <Link href={`/recettes/${r._id}`} className="font-bold hover:text-[#F5A800] whitespace-nowrap">
          {r.number}
        </Link>
        {r.status === 'open' && (
          <span className="ml-1.5 inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400">
            Ouverte
          </span>
        )}
      </Td>
      <Td className="whitespace-nowrap">
        <p>{dateFr(r.openedAt)} {timeFr(r.openedAt)}</p>
        {r.openedBy && <p className="text-[11px] text-muted-foreground">{r.openedBy}</p>}
      </Td>
      <Td className="whitespace-nowrap">
        {r.closedAt ? (
          <>
            <p>{dateFr(r.closedAt)} {timeFr(r.closedAt)}</p>
            {r.closedBy && <p className="text-[11px] text-muted-foreground">{r.closedBy}</p>}
          </>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </Td>
      <Td right className="text-muted-foreground">{duration(r.durationMin)}</Td>
      <Td right>
        {r.orders}
        {r.cancelled > 0 && <span className="block text-[11px] text-muted-foreground">{r.cancelled} ann.</span>}
      </Td>
      <Td right className="font-bold">{money(r.revenue)}</Td>
      <Td right>{money(r.cashSales)}</Td>
      <Td right>{money(r.cardSales)}</Td>
      <Td right>{r.platformDue > 0 ? money(r.platformDue) : '—'}</Td>
      <Td right className={r.receivable > 0 ? 'font-semibold text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}>
        {r.receivable > 0 ? money(r.receivable) : '—'}
      </Td>
      <Td right>{r.sorties > 0 ? money(r.sorties) : '—'}</Td>
      <Td right>{money(r.expected)}</Td>
      <Td right>{r.closingCash === null ? <span className="text-muted-foreground">non compté</span> : money(r.closingCash)}</Td>
      <Td right className={`font-semibold ${gapTone(r.ecart)}`}>{r.ecart === null ? '—' : signed(r.ecart)}</Td>
    </tr>
  )
}

// ── Plateformes ────────────────────────────────────────────────

function CompaniesTable({ data }: { data: RecetteReport }) {
  const rows = data.byCompany
  const sum = (pick: (c: (typeof rows)[number]) => number) => rows.reduce((acc, c) => acc + pick(c), 0)
  return (
    <Section
      title="Plateformes de livraison"
      subtitle="« À la clôture » est figé avec chaque recette ; « dû aujourd'hui » tient compte des versements pointés depuis"
    >
      <Table
        head={['Plateforme', 'Commandes', 'CA brut', 'Commission', 'Net', 'Payé en espèces', 'Dû à la clôture', "Dû aujourd'hui"]}
        minWidth="min-w-200"
        foot={[
          'TOTAL',
          String(sum((c) => c.count)),
          money(sum((c) => c.revenue)),
          `− ${money(sum((c) => c.commission))}`,
          money(sum((c) => c.net)),
          money(sum((c) => c.cash)),
          money(sum((c) => c.due - c.settled)),
          money(data.platformsOutstandingNow),
        ]}
      >
        {rows.map((c) => (
          <tr key={c.name} className="hover:bg-muted/50">
            <Td className="font-semibold">🛵 {c.name}</Td>
            <Td right>{c.count}</Td>
            <Td right className="font-semibold">{money(c.revenue)}</Td>
            <Td right className="text-red-600 dark:text-red-400">
              − {money(c.commission)}
              {c.rate !== null && <span className="text-[11px]"> ({c.rate}%)</span>}
            </Td>
            <Td right>{money(c.net)}</Td>
            <Td right className="text-muted-foreground">{c.cash > 0 ? money(c.cash) : '—'}</Td>
            <Td right>{money(c.due - c.settled)}</Td>
            <Td right className={`font-black ${c.outstandingNow > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
              {c.outstandingNow > 0 ? money(c.outstandingNow) : 'Réglé'}
            </Td>
          </tr>
        ))}
      </Table>
      <p className="px-4 py-2.5 border-t text-[11px] text-muted-foreground">
        Les versements se pointent dans{' '}
        <Link href="/platform-payouts" className="font-semibold text-blue-600 hover:underline">
          Règlements plateformes
        </Link>
        .
      </p>
    </Section>
  )
}

// ── Répartitions ───────────────────────────────────────────────

function BreakdownCard({ data }: { data: RecetteReport }) {
  const total = data.summary.revenue || 1
  const bar = (label: string, count: number, revenue: number) =>
    count > 0 && (
      <div key={label}>
        <div className="flex justify-between text-sm mb-1">
          <span className="text-muted-foreground">{label}</span>
          <span className="font-semibold tabular-nums">
            {count} · {money(revenue)}
          </span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-[#F5A800]" style={{ width: `${(revenue / total) * 100}%` }} />
        </div>
      </div>
    )
  return (
    <Section title="Répartition">
      <div className="px-4 pb-4 space-y-3">
        {bar('🛵 Livraison', data.byType.delivery.count, data.byType.delivery.revenue)}
        {bar('🥡 À emporter / sur place', data.byType.pickup.count, data.byType.pickup.revenue)}
        <div className="h-px bg-border" />
        {SOURCE_ROWS.map(({ key, label }) => bar(label, data.bySource[key]?.count ?? 0, data.bySource[key]?.revenue ?? 0))}
      </div>
    </Section>
  )
}

function CashiersCard({ data }: { data: RecetteReport }) {
  return (
    <Section title="Par caissier" subtitle="L'écart revient à qui a clôturé et compté">
      <dl className="divide-y">
        {data.byCashier.map((c) => (
          <div key={c.name} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
            <dt className="min-w-0">
              <p className="font-semibold truncate">{c.name}</p>
              <p className="text-[11px] text-muted-foreground">
                {c.sessions} recette{c.sessions > 1 ? 's' : ''} · {c.orders} cmd · {money(c.revenue)}
              </p>
            </dt>
            <dd className={`font-semibold tabular-nums ${c.counted > 0 ? gapTone(c.ecart) : 'text-muted-foreground'}`}>
              {c.counted > 0 ? signed(c.ecart) : 'non compté'}
            </dd>
          </div>
        ))}
      </dl>
    </Section>
  )
}

function AmountsCard({ data }: { data: RecetteReport }) {
  const s = data.summary
  return (
    <Section title="Montants">
      <dl className="divide-y">
        <Line label="Remises accordées" value={`− ${money(s.discounts)}`} />
        <Line label="Majorations" value={`+ ${money(s.surcharges)}`} />
        <Line label="Frais de livraison" value={money(s.deliveryFees)} />
        <Line label="Commissions plateformes" value={`− ${money(s.commission)}`} />
        <Line label="Net après commissions" value={money(s.net)} strong />
        <Line label="Achats et dépenses" value={`− ${money(s.achats + s.depenses)}`} />
        <Line label="Solde du service" value={money(s.solde)} strong />
      </dl>
    </Section>
  )
}

// ── Export ─────────────────────────────────────────────────────

/** Point-virgule et virgule décimale : ce qu'Excel attend en français. */
function exportCsv(data: RecetteReport) {
  const num = (n: number | null) => (n === null ? '' : n.toFixed(2).replace('.', ','))
  const cell = (v: string | number | null) => {
    const s = typeof v === 'number' ? num(v) : (v ?? '')
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const head = [
    'N°', 'Statut', 'Jour', 'Ouverture', 'Ouverte par', 'Clôture', 'Clôturée par', 'Commandes', 'Annulées',
    "Chiffre d'affaires", 'Commissions', 'Net', 'Espèces', 'TPE', 'Plateformes (net dû)', 'Encaissé', 'À recevoir',
    'Achats + dépenses', 'Ajouts au fond', 'Retraits', 'Solde', "Fond d'ouverture", 'Espèces attendues', 'Espèces comptées', 'Écart',
  ]
  const lines = data.recettes.map((r) => [
    r.number, r.status === 'open' ? 'Ouverte' : 'Clôturée', r.day,
    `${dateFr(r.openedAt)} ${timeFr(r.openedAt)}`, r.openedBy,
    r.closedAt ? `${dateFr(r.closedAt)} ${timeFr(r.closedAt)}` : '', r.closedBy,
    String(r.orders), String(r.cancelled), r.revenue, r.commission, r.net, r.cashSales, r.cardSales, r.platformDue,
    r.collected, r.receivable, r.sorties, r.apports, r.retraits, r.solde, r.openingFloat, r.expected, r.closingCash, r.ecart,
  ])
  const csv = '﻿' + [head, ...lines].map((row) => row.map(cell).join(';')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `recettes_${data.period.from}_${data.period.to}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Briques ────────────────────────────────────────────────────

function DateInput(props: { label: string; value: string; min?: string; max?: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{props.label}</label>
      <input
        type="date"
        value={props.value}
        min={props.min}
        max={props.max}
        onChange={(e) => props.onChange(e.target.value)}
        className="block border border-border bg-background rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5A800] focus:border-transparent"
      />
    </div>
  )
}

function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="bg-card rounded-xl border p-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-black tabular-nums ${tone ?? 'text-foreground'}`}>{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

function Mini({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-card rounded-xl border px-4 py-3 flex items-baseline justify-between gap-2">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
        {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      </div>
      <p className="text-lg font-black tabular-nums">{value}</p>
    </div>
  )
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="bg-card rounded-xl border overflow-hidden">
      <div className="px-4 pt-3 pb-2">
        <h2 className="font-semibold text-sm">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </section>
  )
}

function Line({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`${strong ? 'font-black' : 'font-semibold'} tabular-nums ${tone ?? 'text-foreground'}`}>{value}</dd>
    </div>
  )
}

function Table({
  head,
  foot,
  minWidth,
  left = 1,
  children,
}: {
  head: string[]
  foot?: string[]
  minWidth: string
  /** Combien de colonnes de tête sont du texte, alignées à gauche ; les autres sont des nombres. */
  left?: number
  children: React.ReactNode
}) {
  const align = (i: number) => (i < left ? 'text-left' : 'text-right')
  return (
    <div className="overflow-x-auto border-t">
      <table className={`w-full text-sm ${minWidth}`}>
        <thead className="bg-muted/50 border-b">
          <tr>
            {head.map((h, i) => (
              <th
                key={`${h}-${i}`}
                className={`px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap ${align(i)}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">{children}</tbody>
        {foot && (
          <tfoot className="border-t-2 bg-muted/50">
            <tr>
              {foot.map((f, i) => (
                <td key={i} className={`px-3 py-2.5 font-bold tabular-nums whitespace-nowrap ${align(i)}`}>
                  {f}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}

function Td({ children, right, className = '' }: { children: React.ReactNode; right?: boolean; className?: string }) {
  return <td className={`px-3 py-2.5 tabular-nums ${right ? 'text-right' : ''} ${className}`}>{children}</td>
}
