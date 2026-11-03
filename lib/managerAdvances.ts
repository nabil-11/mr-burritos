import type { EmployeeAccount, EmployeeLines, EmployeeView } from './employeeAccount'
import type { AccountLine } from './payroll'
import { DEFAULT_TIME_ZONE, addDays, dayOf } from './reportTime'

/**
 * L'historique des avances vu par le manager — pur, ni Mongo ni serveur.
 *
 * Une avance est une ligne de kind `avance` du compte (un mouvement de recette
 * rattaché à l'employé, hors salaire) : on lit donc les mêmes lignes que le
 * compte, et les totaux tombent sur ceux du back-office. Liste blanche : le
 * numéro de la recette, jamais son id ; ni téléphone, CIN, adresse, notes.
 * Une avance annulée reste listée, `cancelled: true`, hors de tous les totaux.
 */

const round2 = (n: number) => Math.round(n * 100) / 100

// ── La période ─────────────────────────────────────────────────

const DAY = /^\d{4}-\d{2}-\d{2}$/
/** YYYY-MM-DD d'un vrai jour du calendrier (le 30 février n'en est pas un). */
const validDay = (s: unknown): s is string => typeof s === 'string' && DAY.test(s) && addDays(s, 0) === s
const daysApart = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)

export const MAX_RANGE_DAYS = 366

/**
 * La période d'une requête, en jours de Africa/Tunis. Rien : le mois courant,
 * du 1er à son dernier jour. Seul `from` : jusqu'à la fin de son mois. Seul
 * `to` : depuis le début de son mois. Null (400) : jour mal formé, `from`
 * après `to`, ou plus de 366 jours d'écart.
 */
export function resolveRange(
  from: string | null | undefined,
  to: string | null | undefined,
  today: string
): { from: string; to: string } | null {
  if (from != null && !validDay(from)) return null
  if (to != null && !validDay(to)) return null
  const monthStart = (d: string) => `${d.slice(0, 7)}-01`
  const monthEnd = (d: string) => addDays(monthStart(addDays(monthStart(d), 32)), -1)
  const start = from ?? monthStart(to ?? today)
  const end = to ?? monthEnd(from ?? today)
  if (start > end || daysApart(start, end) > MAX_RANGE_DAYS) return null
  return { from: start, to: end }
}

// ── Les lignes ─────────────────────────────────────────────────

export interface AdvanceLine {
  id: string
  amount: number
  at: string
  note: string
  by: string
  recetteNumber: string | null
  cancelled: boolean
}

const advanceOf = (l: AccountLine): AdvanceLine => ({
  id: l.id,
  amount: l.amount,
  at: l.at,
  note: l.note ?? '',
  by: l.by ?? '',
  recetteNumber: l.source === 'caisse' ? (l.recetteNumber ?? null) : null,
  cancelled: Boolean(l.cancelled),
})

/** Du plus récent au plus ancien ; l'id départage deux lignes de même instant. */
const newestFirst = (a: { at: string; id: string }, b: { at: string; id: string }) =>
  b.at.localeCompare(a.at) || b.id.localeCompare(a.id)

/** Les avances seulement : ni le salaire payé en caisse, ni les écritures manuelles. */
const advancesOnly = (lines: AccountLine[]) => lines.filter((l) => l.kind === 'avance')

// ── Un employé ─────────────────────────────────────────────────

export interface AdvanceHistoryResponse {
  employee: { id: string; name: string; poste: string; isActive: boolean }
  totals: { count: number; amount: number }
  months: { month: string; count: number; amount: number }[]
  lines: AdvanceLine[]
}

export function advanceHistoryOf(
  account: Pick<EmployeeAccount, 'lines'> & { employee: EmployeeView }
): AdvanceHistoryResponse {
  const e = account.employee
  const all = advancesOnly(account.lines).sort(newestFirst)
  const live = all.filter((l) => !l.cancelled)
  const byMonth = new Map<string, { count: number; amount: number }>()
  for (const l of live) {
    const m = byMonth.get(l.month) ?? { count: 0, amount: 0 }
    byMonth.set(l.month, { count: m.count + 1, amount: m.amount + l.amount })
  }
  return {
    employee: { id: String(e._id), name: e.name, poste: e.poste ?? '', isActive: e.isActive !== false },
    totals: { count: live.length, amount: round2(live.reduce((s, l) => s + l.amount, 0)) },
    months: [...byMonth.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([month, m]) => ({ month, count: m.count, amount: round2(m.amount) })),
    lines: all.map(advanceOf),
  }
}

// ── Toute l'équipe, sur une période ────────────────────────────

export interface AdvancesRangeResponse {
  from: string
  to: string
  totals: { count: number; amount: number }
  byEmployee: { id: string; name: string; count: number; amount: number }[]
  lines: (AdvanceLine & { employeeId: string; employeeName: string })[]
}

/** Les avances de chaque employé dont le jour (Africa/Tunis) tombe dans [from, to]. */
export function advancesInRange(list: EmployeeLines[], range: { from: string; to: string }): AdvancesRangeResponse {
  const lines = list
    .flatMap((x) =>
      advancesOnly(x.lines)
        .filter((l) => {
          const day = dayOf(l.at, DEFAULT_TIME_ZONE)
          return day >= range.from && day <= range.to
        })
        .map((l) => ({ ...advanceOf(l), employeeId: String(x.employee._id), employeeName: x.employee.name }))
    )
    .sort(newestFirst)

  const per = new Map<string, { id: string; name: string; count: number; amount: number }>()
  for (const l of lines) {
    if (l.cancelled) continue
    const p = per.get(l.employeeId) ?? { id: l.employeeId, name: l.employeeName, count: 0, amount: 0 }
    p.count++
    p.amount += l.amount
    per.set(l.employeeId, p)
  }
  const byEmployee = [...per.values()]
    .map((p) => ({ ...p, amount: round2(p.amount) }))
    .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }) || a.id.localeCompare(b.id))
  return {
    from: range.from,
    to: range.to,
    totals: {
      count: byEmployee.reduce((s, p) => s + p.count, 0),
      amount: round2(byEmployee.reduce((s, p) => s + p.amount, 0)),
    },
    byEmployee,
    lines,
  }
}
