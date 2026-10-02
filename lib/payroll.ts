import { DEFAULT_TIME_ZONE, dayOf } from './reportTime'

/**
 * Le compte courant d'un employé — ce que le restaurant lui doit, mois par mois.
 *
 * Chaque mois suivi :
 *
 *     report du mois précédent
 *   + salaire du mois          (son barème, tant qu'il est en poste)
 *   + primes
 *   − retenues
 *   − avances                  (sorties du tiroir en cours de mois)
 *   − paiements                (salaire payé en caisse, virement, chèque…)
 *   = reste à payer            → report du mois suivant
 *
 * Un compte courant plutôt qu'une fiche de paie par mois, parce qu'un salaire
 * se paie rarement dans le mois qu'il rémunère : celui de septembre sort du
 * tiroir le 2 octobre. Ici il n'y a rien à rattacher à la main — le paiement
 * du 2 octobre solde le report de septembre, et le compte tombe juste. Un
 * reste négatif veut dire que l'employé a reçu plus que dû : il passe aussi au
 * mois suivant, et se déduit du salaire à venir.
 *
 * Ce fichier ne connaît ni Mongo ni le serveur : les écrans s'en servent aussi.
 */

// ── Mois ───────────────────────────────────────────────────────

const MONTH = /^\d{4}-\d{2}$/
export const isMonth = (s: unknown): s is string => typeof s === 'string' && MONTH.test(s)

/** Le mois d'un instant, à l'heure du restaurant : « 2026-10 ». */
export const monthOf = (at: Date | string | number, tz = DEFAULT_TIME_ZONE) => dayOf(at, tz).slice(0, 7)
export const currentMonth = (tz = DEFAULT_TIME_ZONE) => monthOf(new Date(), tz)

export function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7)
}

export function monthLabel(month: string, style: 'long' | 'short' = 'long'): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('fr-FR', {
    month: style,
    year: 'numeric',
    timeZone: 'UTC',
  })
}

// ── Les lignes du compte ───────────────────────────────────────

export type LineKind = 'avance' | 'salaire' | 'prime' | 'retenue' | 'paiement'

export const LINE_META: Record<LineKind, { label: string; sign: 1 | -1; badge: string; tone: string }> = {
  avance: {
    label: 'Avance',
    sign: -1,
    badge: 'bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300',
    tone: 'text-orange-700 dark:text-orange-400',
  },
  salaire: {
    label: 'Salaire payé (caisse)',
    sign: -1,
    badge: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300',
    tone: 'text-sky-700 dark:text-sky-400',
  },
  paiement: {
    label: 'Paiement hors caisse',
    sign: -1,
    badge: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300',
    tone: 'text-sky-700 dark:text-sky-400',
  },
  prime: {
    label: 'Prime',
    sign: 1,
    badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
    tone: 'text-emerald-700 dark:text-emerald-400',
  },
  retenue: {
    label: 'Retenue',
    sign: -1,
    badge: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300',
    tone: 'text-red-700 dark:text-red-400',
  },
}

export const METHOD_LABEL: Record<string, string> = {
  especes: 'Espèces (hors caisse)',
  virement: 'Virement',
  cheque: 'Chèque',
}

/** Une ligne du compte, d'où qu'elle vienne. */
export interface AccountLine {
  id: string
  kind: LineKind
  amount: number
  /** ISO. */
  at: string
  month: string
  note: string
  by: string
  /** 'caisse' : un mouvement de recette, annulable seulement depuis la recette. */
  source: 'caisse' | 'manuel'
  recetteId?: string
  recetteNumber?: string
  method?: string | null
  /** Annulée : affichée barrée, hors du compte. */
  cancelled?: boolean
}

/** Ce qu'il faut de la fiche pour tenir le compte. */
export interface AccountSetup {
  salaries: { from: string; amount: number }[]
  /** Premier mois suivi. */
  trackFrom: string
  openingBalance: number
  /** Dernier mois où le salaire court ; null s'il est toujours en poste. */
  untilMonth: string | null
}

export interface MonthRow {
  month: string
  opening: number
  salary: number
  primes: number
  retenues: number
  avances: number
  paiements: number
  /** Reste à payer en fin de mois — positif : dû à l'employé. */
  closing: number
  lines: number
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** Le salaire qui court pour un mois : le dernier du barème qui a commencé avant lui. */
export function salaryFor(setup: AccountSetup, month: string): number {
  if (month < setup.trackFrom) return 0
  if (setup.untilMonth && month > setup.untilMonth) return 0
  const scale = [...setup.salaries].sort((a, b) => a.from.localeCompare(b.from))
  // Le premier salaire du barème vaut aussi pour les mois suivis avant lui —
  // un début de suivi avancé après coup ne doit pas compter des mois à zéro.
  let amount = scale[0]?.amount ?? 0
  for (const s of scale) if (s.from <= month) amount = s.amount
  return amount
}

/**
 * Le compte, mois par mois, du premier mois suivi jusqu'à `upTo`. Une ligne
 * antérieure au suivi (une avance saisie avant d'inscrire l'employé) ouvre le
 * compte plus tôt plutôt que de disparaître.
 */
export function buildStatement(setup: AccountSetup, lines: AccountLine[], upTo: string): MonthRow[] {
  const live = lines.filter((l) => !l.cancelled)
  const first = live.reduce((m, l) => (l.month < m ? l.month : m), setup.trackFrom)
  const last = live.reduce((m, l) => (l.month > m ? l.month : m), upTo)

  const byMonth = new Map<string, AccountLine[]>()
  for (const l of live) byMonth.set(l.month, [...(byMonth.get(l.month) ?? []), l])

  const rows: MonthRow[] = []
  let balance = round2(setup.openingBalance || 0)
  for (let month = first; month <= last && rows.length < 600; month = shiftMonth(month, 1)) {
    const row: MonthRow = {
      month,
      opening: balance,
      salary: salaryFor(setup, month),
      primes: 0,
      retenues: 0,
      avances: 0,
      paiements: 0,
      closing: 0,
      lines: 0,
    }
    for (const l of byMonth.get(month) ?? []) {
      row.lines++
      if (l.kind === 'prime') row.primes += l.amount
      else if (l.kind === 'retenue') row.retenues += l.amount
      else if (l.kind === 'avance') row.avances += l.amount
      else row.paiements += l.amount
    }
    row.primes = round2(row.primes)
    row.retenues = round2(row.retenues)
    row.avances = round2(row.avances)
    row.paiements = round2(row.paiements)
    row.closing = round2(row.opening + row.salary + row.primes - row.retenues - row.avances - row.paiements)
    balance = row.closing
    rows.push(row)
  }
  return rows
}

/** La ligne d'un mois, ou un mois vide qui reporte le solde quand il n'est pas dans le compte. */
export function rowFor(rows: MonthRow[], month: string): MonthRow {
  const found = rows.find((r) => r.month === month)
  if (found) return found
  // Avant le premier mois suivi : rien. Après le dernier : le solde, reporté.
  const before = rows.filter((r) => r.month < month).at(-1)
  const balance = before?.closing ?? 0
  return { month, opening: balance, salary: 0, primes: 0, retenues: 0, avances: 0, paiements: 0, closing: balance, lines: 0 }
}

// ── Retrouver un employé dans un libellé ───────────────────────

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const FILLER = new Set(['avance', 'avances', 'salaire', 'a', 'pour', 'de', 'dt', 'le', 'la'])

/**
 * L'employé que désigne un libellé tapé à la main — « houssin », « avance
 * Houssine 20 » — s'il n'y en a qu'un. Sert à proposer le rattachement, jamais
 * à le faire en silence : « Sami » peut aussi être un fournisseur.
 */
export function matchEmployee<T extends { name: string }>(label: string, employees: T[]): T | null {
  const words = norm(label)
    .split(' ')
    .filter((w) => w.length >= 3 && !FILLER.has(w))
  if (words.length === 0) return null
  const hits = employees.filter((e) => {
    const parts = norm(e.name).split(' ')
    return words.some((w) => parts.some((p) => p.startsWith(w) || (w.length >= 4 && w.startsWith(p) && p.length >= 3)))
  })
  return hits.length === 1 ? hits[0] : null
}
