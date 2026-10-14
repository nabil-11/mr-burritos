import { addDays, isDay } from '@/lib/reportTime'

/**
 * Les filtres de la liste des recettes, tels qu'ils vivent dans l'URL.
 *
 * L'URL est la seule source de vérité : une vue filtrée se partage, se met en
 * favori, survit au rafraîchissement — et la page serveur n'a qu'à la lire.
 * Ce fichier ne touche ni Mongo ni le navigateur : la page et la barre de
 * filtres l'importent toutes les deux.
 *
 * Une recette appartient au jour de son ouverture, à l'heure du restaurant —
 * la même règle que le rapport des recettes : un service ouvert à 18 h et
 * clôturé à 1 h du matin reste celui de la veille.
 */

export const PERIODS = ['today', 'yesterday', '7d', '30d', 'month', 'lastMonth', 'year', 'all', 'custom'] as const
export type Period = (typeof PERIODS)[number]

export const PERIOD_LABELS: Record<Period, string> = {
  today: "Aujourd'hui",
  yesterday: 'Hier',
  '7d': '7 jours',
  '30d': '30 jours',
  month: 'Ce mois',
  lastMonth: 'Mois dernier',
  year: 'Cette année',
  all: 'Tout',
  custom: 'Personnalisé',
}

/** Ce que la liste montre quand personne n'a rien choisi : le mois qui vient de passer. */
export const DEFAULT_PERIOD: Period = '30d'

export const STATUSES = ['all', 'open', 'closed'] as const
export type StatusFilter = (typeof STATUSES)[number]
export const STATUS_LABELS: Record<StatusFilter, string> = { all: 'Toutes', open: 'Ouvertes', closed: 'Clôturées' }

/** L'écart de caisse : la question qu'on pose à une liste de recettes après celle du chiffre. */
export const GAPS = ['all', 'balanced', 'short', 'over', 'uncounted', 'issue'] as const
export type GapFilter = (typeof GAPS)[number]
export const GAP_LABELS: Record<GapFilter, string> = {
  all: 'Tous les écarts',
  issue: 'À vérifier (écart ou non compté)',
  balanced: 'Caisse juste',
  short: 'Manquant',
  over: 'Excédent',
  uncounted: 'Non comptée',
}

export const SORTS = ['recent', 'oldest', 'revenue', 'gap'] as const
export type SortKey = (typeof SORTS)[number]
export const SORT_LABELS: Record<SortKey, string> = {
  recent: 'Plus récentes',
  oldest: 'Plus anciennes',
  revenue: "Chiffre d'affaires",
  gap: 'Plus gros écart',
}

export interface RecetteFilters {
  period: Period
  /** Bornes incluses, en jours du restaurant. Absentes pour « Tout ». */
  from?: string
  to?: string
  status: StatusFilter
  gap: GapFilter
  cashier: string
  q: string
  sort: SortKey
}

type Params = Record<string, string | string[] | undefined>

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''
const pick = <T extends string>(list: readonly T[], v: string, fallback: T): T =>
  (list as readonly string[]).includes(v) ? (v as T) : fallback

/** Les bornes d'une période nommée, autour d'aujourd'hui (YYYY-MM-DD, à l'heure du restaurant). */
export function periodRange(period: Period, today: string): { from?: string; to?: string } {
  const [y, m] = today.split('-')
  switch (period) {
    case 'today':
      return { from: today, to: today }
    case 'yesterday':
      return { from: addDays(today, -1), to: addDays(today, -1) }
    case '7d':
      return { from: addDays(today, -6), to: today }
    case '30d':
      return { from: addDays(today, -29), to: today }
    case 'month':
      return { from: `${y}-${m}-01`, to: today }
    case 'lastMonth': {
      const lastDay = addDays(`${y}-${m}-01`, -1)
      return { from: `${lastDay.slice(0, 7)}-01`, to: lastDay }
    }
    case 'year':
      return { from: `${y}-01-01`, to: today }
    default:
      return {}
  }
}

/** Les paramètres d'URL, nettoyés : rien d'inconnu ne passe, rien ne manque. */
export function parseFilters(sp: Params, today: string): RecetteFilters {
  const fromParam = one(sp.from)
  const toParam = one(sp.to)
  // Des dates dans l'URL valent « Personnalisé », même sans le dire.
  const hasDates = isDay(fromParam) || isDay(toParam)
  const period = hasDates ? 'custom' : pick(PERIODS, one(sp.period), DEFAULT_PERIOD)

  let from: string | undefined
  let to: string | undefined
  if (period === 'custom') {
    from = isDay(fromParam) ? fromParam : isDay(toParam) ? toParam : today
    to = isDay(toParam) ? toParam : today
    if (from > to) [from, to] = [to, from]
  } else {
    ;({ from, to } = periodRange(period, today))
  }

  return {
    period,
    from,
    to,
    status: pick(STATUSES, one(sp.status), 'all'),
    gap: pick(GAPS, one(sp.gap), 'all'),
    cashier: one(sp.cashier).slice(0, 80),
    q: one(sp.q).trim().slice(0, 40),
    sort: pick(SORTS, one(sp.sort), 'recent'),
  }
}

/** L'inverse : l'URL d'une vue, sans les valeurs par défaut — une URL courte se partage mieux. */
export function filtersToQuery(f: RecetteFilters): string {
  const p = new URLSearchParams()
  if (f.period === 'custom') {
    if (f.from) p.set('from', f.from)
    if (f.to) p.set('to', f.to)
  } else if (f.period !== DEFAULT_PERIOD) {
    p.set('period', f.period)
  }
  if (f.status !== 'all') p.set('status', f.status)
  if (f.gap !== 'all') p.set('gap', f.gap)
  if (f.cashier) p.set('cashier', f.cashier)
  if (f.q) p.set('q', f.q)
  if (f.sort !== 'recent') p.set('sort', f.sort)
  const s = p.toString()
  return s ? `?${s}` : ''
}

/** Les filtres autres que la période sont-ils au repos ? */
export const isRefined = (f: RecetteFilters) =>
  f.status !== 'all' || f.gap !== 'all' || f.cashier !== '' || f.q !== '' || f.sort !== 'recent'

const frDay = (day: string) => {
  const [y, m, d] = day.split('-')
  return `${d}/${m}/${y}`
}

/** « du 15/09/2026 au 14/10/2026 », « le 14/10/2026 », ou « depuis le début ». */
export function periodText(f: Pick<RecetteFilters, 'from' | 'to'>): string {
  if (!f.from || !f.to) return 'depuis le début'
  return f.from === f.to ? `le ${frDay(f.from)}` : `du ${frDay(f.from)} au ${frDay(f.to)}`
}

/** Tout ce qui restreint la liste, en une phrase — pour l'en-tête des exports. */
export function filtersText(f: RecetteFilters): string {
  const parts = [periodText(f)]
  if (f.status !== 'all') parts.push(STATUS_LABELS[f.status].toLowerCase())
  if (f.gap !== 'all') parts.push(GAP_LABELS[f.gap].toLowerCase())
  if (f.cashier) parts.push(`caissier : ${f.cashier}`)
  if (f.q) parts.push(`n° contenant « ${f.q} »`)
  return parts.join(' · ')
}
