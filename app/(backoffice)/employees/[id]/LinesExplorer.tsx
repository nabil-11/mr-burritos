'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Download, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { type AccountLine, type LineKind, LINE_META, METHOD_LABEL, monthLabel } from '@/lib/payroll'
import { CancelEntryButton } from '../EntryActions'

/**
 * Toutes les lignes du compte d'un employé — avances, salaires payés,
 * paiements, primes, retenues — à filtrer par genre et par période, avec les
 * totaux de ce qui est affiché et un export CSV pour le comptable.
 */

const money = (n: number) => `${(Number(n) || 0).toFixed(2)} DT`
const TZ = 'Africa/Tunis'
const dateFr = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ })
const timeFr = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: TZ })

const KINDS: LineKind[] = ['avance', 'salaire', 'paiement', 'prime', 'retenue']
const KIND_PLURAL: Record<LineKind, string> = {
  avance: 'Avances',
  salaire: 'Salaires payés en caisse',
  paiement: 'Paiements hors caisse',
  prime: 'Primes',
  retenue: 'Retenues',
}

const round2 = (n: number) => Math.round(n * 100) / 100
/** « octobre 2026 » → « Octobre 2026 » — un <option> ne prend pas text-transform. */
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export default function LinesExplorer({
  employeeId,
  employeeName,
  lines,
  initialKind,
}: {
  employeeId: string
  employeeName: string
  lines: AccountLine[]
  initialKind?: LineKind
}) {
  const [kind, setKind] = useState<LineKind | 'all'>(initialKind ?? 'all')
  const [period, setPeriod] = useState('all')
  const [query, setQuery] = useState('')
  const [showCancelled, setShowCancelled] = useState(false)

  // Les périodes qui ont des lignes : années, puis mois, du plus récent au plus ancien.
  const { years, months } = useMemo(() => {
    const ms = [...new Set(lines.map((l) => l.month))].sort().reverse()
    return { months: ms, years: [...new Set(ms.map((m) => m.slice(0, 4)))] }
  }, [lines])

  const inPeriod = useMemo(
    () =>
      lines.filter((l) => {
        if (period === 'all') return true
        return period.length === 4 ? l.month.startsWith(period) : l.month === period
      }),
    [lines, period]
  )

  // Les totaux suivent la période, pas le genre : cliquer une carte filtre sans la faire disparaître.
  const totals = useMemo(() => {
    const t = Object.fromEntries(KINDS.map((k) => [k, { amount: 0, count: 0 }])) as Record<LineKind, { amount: number; count: number }>
    for (const l of inPeriod) {
      if (l.cancelled) continue
      t[l.kind].amount = round2(t[l.kind].amount + l.amount)
      t[l.kind].count++
    }
    return t
  }, [inPeriod])
  const paid = round2(totals.avance.amount + totals.salaire.amount + totals.paiement.amount)

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return inPeriod.filter((l) => {
      if (!showCancelled && l.cancelled) return false
      if (kind !== 'all' && l.kind !== kind) return false
      if (!q) return true
      return [l.note, l.by, l.recetteNumber, l.method ? METHOD_LABEL[l.method] : '', LINE_META[l.kind].label]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(q))
    })
  }, [inPeriod, kind, query, showCancelled])

  const shownTotal = round2(shown.filter((l) => !l.cancelled).reduce((s, l) => s + LINE_META[l.kind].sign * l.amount, 0))

  // Groupées par mois : c'est ainsi qu'on relit une paie.
  const groups = useMemo(() => {
    const map = new Map<string, AccountLine[]>()
    for (const l of shown) map.set(l.month, [...(map.get(l.month) ?? []), l])
    return [...map.entries()]
  }, [shown])

  const exportCsv = () => {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const header = ['Date', 'Heure', 'Mois', 'Type', 'Montant', 'Sens', 'Moyen', 'Recette', 'Note', 'Par', 'Statut']
    const rows = shown.map((l) => [
      new Date(l.at).toLocaleDateString('fr-FR', { timeZone: TZ }),
      timeFr(l.at),
      l.month,
      LINE_META[l.kind].label,
      l.amount.toFixed(2).replace('.', ','),
      LINE_META[l.kind].sign > 0 ? '+' : '-',
      l.source === 'caisse' ? 'Caisse' : l.method ? METHOD_LABEL[l.method] : '',
      l.recetteNumber ?? '',
      l.note,
      l.by,
      l.cancelled ? 'Annulée' : '',
    ])
    // BOM + point-virgule : Excel en français l'ouvre tel quel.
    const csv = '﻿' + [header, ...rows].map((r) => r.map(esc).join(';')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${employeeName.replace(/[^\p{L}\p{N}]+/gu, '-')}-${period === 'all' ? 'tout' : period}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      {/* ── Totaux de la période, cliquables ──────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
        <button
          type="button"
          onClick={() => setKind('all')}
          aria-pressed={kind === 'all'}
          className={`rounded-xl border p-3 text-left transition-colors ${kind === 'all' ? 'border-[#F5A800] bg-[#F5A800]/10' : 'bg-card hover:bg-muted/50'}`}
        >
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Total versé</p>
          <p className="mt-1 text-lg font-black tabular-nums">{money(paid)}</p>
          <p className="text-[11px] text-muted-foreground">avances + salaires + paiements</p>
        </button>
        {KINDS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(kind === k ? 'all' : k)}
            aria-pressed={kind === k}
            className={`rounded-xl border p-3 text-left transition-colors ${kind === k ? 'border-[#F5A800] bg-[#F5A800]/10' : 'bg-card hover:bg-muted/50'}`}
          >
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{KIND_PLURAL[k]}</p>
            <p className={`mt-1 text-lg font-black tabular-nums ${LINE_META[k].tone}`}>{money(totals[k].amount)}</p>
            <p className="text-[11px] text-muted-foreground">
              {totals[k].count} ligne{totals[k].count > 1 ? 's' : ''}
            </p>
          </button>
        ))}
      </div>

      {/* ── Filtres ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Période"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm dark:bg-input/30"
        >
          <option value="all">Toute la période</option>
          <optgroup label="Années">
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </optgroup>
          <optgroup label="Mois">
            {months.map((m) => (
              <option key={m} value={m}>
                {capitalize(monthLabel(m))}
              </option>
            ))}
          </optgroup>
        </select>
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Rechercher"
            placeholder="Note, recette, caissier…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-8 w-56 pl-8"
          />
        </div>
        <label className="inline-flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} className="h-4 w-4 accent-[#F5A800]" />
          Afficher les annulées
        </label>
        <button
          type="button"
          onClick={exportCsv}
          disabled={shown.length === 0}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
        >
          <Download size={14} /> Exporter CSV
        </button>
      </div>

      {/* ── Les lignes, par mois ──────────────────────────────────── */}
      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="px-4 py-3 border-b flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-semibold text-sm">
            {kind === 'all' ? 'Tous les mouvements' : KIND_PLURAL[kind]}{' '}
            <span className="font-normal text-muted-foreground">({shown.length})</span>
          </p>
          {kind !== 'all' && (
            <p className="text-sm text-muted-foreground">
              Total : <span className={`font-bold ${LINE_META[kind].tone}`}>{money(Math.abs(shownTotal))}</span>
            </p>
          )}
        </div>
        {shown.length === 0 ? (
          <p className="text-center text-muted-foreground py-10 text-sm">Aucun mouvement pour ces filtres</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-160">
              <thead className="bg-muted/50 border-b">
                <tr>
                  {['Date', 'Type', 'Moyen / recette', 'Note', 'Par', 'Montant', ''].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              {groups.map(([month, items]) => {
                const live = items.filter((l) => !l.cancelled)
                const out = round2(live.filter((l) => LINE_META[l.kind].sign < 0).reduce((s, l) => s + l.amount, 0))
                const inn = round2(live.filter((l) => LINE_META[l.kind].sign > 0).reduce((s, l) => s + l.amount, 0))
                return (
                  <tbody key={month} className="divide-y border-b last:border-b-0">
                    <tr className="bg-muted/30">
                      <td colSpan={7} className="px-4 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Link href={`/employees/${employeeId}?month=${month}`} className="font-semibold capitalize hover:text-[#F5A800]">
                            {monthLabel(month)}
                          </Link>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {out > 0 && <>versé {money(out)}</>}
                            {out > 0 && inn > 0 && ' · '}
                            {inn > 0 && <>primes {money(inn)}</>}
                          </span>
                        </div>
                      </td>
                    </tr>
                    {items.map((l) => {
                      const meta = LINE_META[l.kind]
                      return (
                        <tr key={l.id} className={l.cancelled ? 'text-muted-foreground' : 'hover:bg-muted/50'}>
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            <span className="capitalize">{dateFr(l.at)}</span>
                            <span className="text-xs text-muted-foreground"> · {timeFr(l.at)}</span>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${meta.badge} ${l.cancelled ? 'opacity-50' : ''}`}>
                              {meta.label}
                            </span>
                            {l.cancelled && <span className="ml-1.5 text-[11px] font-semibold">Annulée</span>}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            {l.source === 'caisse' && l.recetteId ? (
                              <Link href={`/recettes/${l.recetteId}`} className="font-medium hover:text-[#F5A800]">
                                {l.recetteNumber}
                              </Link>
                            ) : l.method ? (
                              METHOD_LABEL[l.method]
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground">{l.note || '—'}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{l.by || '—'}</td>
                          <td className={`px-4 py-2.5 font-bold tabular-nums whitespace-nowrap ${l.cancelled ? 'line-through' : meta.tone}`}>
                            {meta.sign > 0 ? '+' : '−'} {money(l.amount)}
                          </td>
                          <td className="px-4 py-2.5 text-right w-16">
                            {l.source === 'manuel' && !l.cancelled && (
                              <CancelEntryButton employeeId={employeeId} entryId={l.id} label={`${meta.label} ${money(l.amount)}`} />
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                )
              })}
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
