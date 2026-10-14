'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { CalendarRange, Loader2, Search, X } from 'lucide-react'
import {
  DEFAULT_PERIOD,
  periodRange,
  GAPS,
  GAP_LABELS,
  PERIODS,
  PERIOD_LABELS,
  SORTS,
  SORT_LABELS,
  STATUSES,
  STATUS_LABELS,
  filtersToQuery,
  isRefined,
  periodText,
  type Period,
  type RecetteFilters,
} from './filters'

/**
 * La barre de filtres de la liste des recettes.
 *
 * Elle n'a pas d'état à elle : chaque choix réécrit l'URL, et la page serveur
 * relit la base. La transition garde l'ancienne liste à l'écran le temps que
 * la nouvelle arrive — pas d'écran blanc, juste un indicateur.
 *
 * La page la remonte à chaque changement d'URL (`key`), ce qui remet les
 * champs locaux — recherche, dates personnalisées — en accord avec l'URL.
 */
export default function RecettesFilters({
  filters,
  cashiers,
  today,
}: {
  filters: RecetteFilters
  cashiers: string[]
  today: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [pending, startTransition] = useTransition()
  const [showCustom, setShowCustom] = useState(filters.period === 'custom')
  // « Tout » n'a pas de bornes : on propose alors les 30 derniers jours, à ajuster.
  const [from, setFrom] = useState(filters.from ?? periodRange('30d', today).from ?? today)
  const [to, setTo] = useState(filters.to ?? today)
  const [q, setQ] = useState(filters.q)

  const go = (next: Partial<RecetteFilters>) => {
    const merged = { ...filters, ...next }
    startTransition(() => router.push(`${pathname}${filtersToQuery(merged)}`, { scroll: false }))
  }

  const choosePeriod = (period: Period) => {
    if (period === 'custom') {
      setShowCustom(true)
      return
    }
    setShowCustom(false)
    go({ period, from: undefined, to: undefined })
  }

  const customValid = Boolean(from && to && from <= to)
  const touched = filters.period !== DEFAULT_PERIOD || isRefined(filters)

  return (
    <div className="mb-4 rounded-xl border bg-card p-3 space-y-3">
      {/* ── Période ───────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-1.5">
        {PERIODS.map((p) => {
          const selected = p === 'custom' ? showCustom || filters.period === 'custom' : filters.period === p && !showCustom
          return (
            <button
              key={p}
              type="button"
              onClick={() => choosePeriod(p)}
              aria-pressed={selected}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                selected
                  ? 'bg-[#F5A800] border-[#F5A800] text-black'
                  : 'bg-card border-border text-muted-foreground hover:border-[#F5A800]/50 hover:text-foreground'
              }`}
            >
              {p === 'custom' && <CalendarRange size={13} />}
              {PERIOD_LABELS[p]}
            </button>
          )
        })}
        <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          {pending && <Loader2 size={13} className="animate-spin" />}
          {pending ? 'Chargement…' : `Recettes ouvertes ${periodText(filters)}`}
        </span>
      </div>

      {showCustom && (
        <form
          className="flex flex-wrap items-end gap-2 rounded-lg bg-muted/40 p-2.5"
          onSubmit={(e) => {
            e.preventDefault()
            if (customValid) go({ period: 'custom', from, to })
          }}
        >
          <label className="text-xs font-medium text-muted-foreground">
            Du
            <input
              type="date"
              value={from}
              max={today}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1 block rounded-lg border bg-background px-2.5 py-1.5 text-sm text-foreground"
            />
          </label>
          <label className="text-xs font-medium text-muted-foreground">
            Au
            <input
              type="date"
              value={to}
              max={today}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1 block rounded-lg border bg-background px-2.5 py-1.5 text-sm text-foreground"
            />
          </label>
          <button
            type="submit"
            disabled={!customValid || pending}
            className="rounded-lg bg-[#1A1A1A] px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-[#F5A800] hover:text-black transition-colors disabled:opacity-40"
          >
            Appliquer
          </button>
          {from && to && from > to && (
            <p className="w-full text-xs text-red-600 dark:text-red-400">La date de début doit précéder la date de fin.</p>
          )}
        </form>
      )}

      {/* ── Affiner ───────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <form
          className="relative"
          onSubmit={(e) => {
            e.preventDefault()
            go({ q: q.trim() })
          }}
        >
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="N° de recette…"
            aria-label="Rechercher un numéro de recette"
            title="Numéro ou partie du numéro (ex. 202610), puis Entrée"
            className="w-48 rounded-lg border bg-background py-1.5 pl-8 pr-7 text-sm"
          />
          {q && (
            <button
              type="button"
              onClick={() => {
                setQ('')
                if (filters.q) go({ q: '' })
              }}
              aria-label="Effacer la recherche"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
            >
              <X size={13} />
            </button>
          )}
        </form>

        <div className="inline-flex rounded-lg border overflow-hidden text-xs font-semibold" role="group" aria-label="Statut">
          {STATUSES.map((s, i) => (
            <button
              key={s}
              type="button"
              onClick={() => go({ status: s })}
              aria-pressed={filters.status === s}
              className={`px-3 py-1.5 transition-colors ${i > 0 ? 'border-l' : ''} ${
                filters.status === s ? 'bg-foreground text-background' : 'bg-background text-muted-foreground hover:text-foreground'
              }`}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        <Select
          label="Écart de caisse"
          value={filters.gap}
          onChange={(gap) => go({ gap: gap as RecetteFilters['gap'] })}
          options={GAPS.map((g) => [g, GAP_LABELS[g]])}
          active={filters.gap !== 'all'}
        />

        {(cashiers.length > 0 || filters.cashier) && (
          <Select
            label="Caissier"
            value={filters.cashier}
            onChange={(cashier) => go({ cashier })}
            options={[
              ['', 'Tous les caissiers'],
              ...[...new Set([...cashiers, ...(filters.cashier ? [filters.cashier] : [])])].map((c) => [c, c] as [string, string]),
            ]}
            active={filters.cashier !== ''}
          />
        )}

        <Select
          label="Trier par"
          value={filters.sort}
          onChange={(sort) => go({ sort: sort as RecetteFilters['sort'] })}
          options={SORTS.map((s) => [s, `Tri : ${SORT_LABELS[s]}`])}
          active={false}
        />

        {touched && (
          <Link
            href={pathname}
            scroll={false}
            className="ml-auto inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X size={13} /> Réinitialiser
          </Link>
        )}
      </div>
    </div>
  )
}

function Select({
  label,
  value,
  onChange,
  options,
  active,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: [string, string][]
  active: boolean
}) {
  return (
    <select
      aria-label={label}
      title={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold cursor-pointer ${
        active ? 'border-[#F5A800] bg-[#F5A800]/10 text-foreground' : 'bg-background text-muted-foreground'
      }`}
    >
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  )
}
