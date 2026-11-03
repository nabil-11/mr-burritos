import type { EmployeeAccount, EmployeeOverview, EmployeeView } from './employeeAccount'
import { type AccountLine, type LineKind, type MonthRow, isMonth, rowFor } from './payroll'

/**
 * L'équipe vue par le manager — pure, ni Mongo ni serveur.
 *
 * Une liste blanche : chaque champ rendu est nommé ici. Ni `viewOf` ni une
 * ligne du compte ne partent tels quels, parce qu'ils portent téléphone, CIN,
 * adresse, notes, id de recette et solde d'ouverture. Ajouter un champ à la
 * fiche ne le fait donc jamais sortir sans qu'on l'écrive ici.
 */

const round2 = (n: number) => Math.round(n * 100) / 100

// ── Le mois demandé ────────────────────────────────────────────

/** YYYY-MM avec un mois de 01 à 12 : `isMonth` ne vérifie que les chiffres. */
const validMonth = (s: unknown): s is string => isMonth(s) && Number(s.slice(5)) >= 1 && Number(s.slice(5)) <= 12

/**
 * Le mois d'une requête. Absent : le mois courant. Mal formé : null (400).
 * Futur : ramené au mois courant. `thisMonth` est celui de Africa/Tunis.
 */
export function resolveMonth(raw: string | null | undefined, thisMonth: string): string | null {
  if (raw === null || raw === undefined) return thisMonth
  if (!validMonth(raw)) return null
  return raw > thisMonth ? thisMonth : raw
}

// ── Les formes rendues ─────────────────────────────────────────

export interface TeamMonth {
  opening: number
  salary: number
  primes: number
  retenues: number
  avances: number
  paiements: number
  closing: number
  lines: number
}

const monthOf = (r: MonthRow): TeamMonth => ({
  opening: r.opening,
  salary: r.salary,
  primes: r.primes,
  retenues: r.retenues,
  avances: r.avances,
  paiements: r.paiements,
  closing: r.closing,
  lines: r.lines,
})

export interface TeamMember {
  id: string
  name: string
  poste: string
  isActive: boolean
  leftAt: string | null
  month: TeamMonth
  balance: number
}

export interface TeamResponse {
  month: string
  thisMonth: string
  totals: { salary: number; avances: number; paiements: number; remaining: number }
  employees: TeamMember[]
}

/** Actifs d'abord, puis par nom (accents et casse ignorés), l'id départage. */
const byTeamOrder = (a: TeamMember, b: TeamMember) =>
  Number(b.isActive) - Number(a.isActive) ||
  a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }) ||
  a.id.localeCompare(b.id)

export function teamOf(list: EmployeeOverview[], month: string, thisMonth: string): TeamResponse {
  const employees: TeamMember[] = list
    .map((o) => ({
      id: String(o.employee._id),
      name: o.employee.name,
      poste: o.employee.poste ?? '',
      isActive: o.employee.isActive !== false,
      leftAt: o.employee.leftAt ?? null,
      month: monthOf(o.month),
      balance: o.balance,
    }))
    .sort(byTeamOrder)

  const sum = (pick: (m: TeamMember) => number) => round2(employees.reduce((s, m) => s + pick(m), 0))
  return {
    month,
    thisMonth,
    // `remaining` : ce qui reste à payer, sans compter les soldes négatifs —
    // comme la page /employees du back-office.
    totals: {
      salary: sum((m) => m.month.salary),
      avances: sum((m) => m.month.avances),
      paiements: sum((m) => m.month.paiements),
      remaining: sum((m) => Math.max(0, m.month.closing)),
    },
    employees,
  }
}

export interface TeamLine {
  id: string
  kind: LineKind
  amount: number
  at: string
  note: string
  by: string
  source: 'caisse' | 'manuel'
  method: string | null
  recetteNumber: string | null
  cancelled: boolean
}

const lineOf = (l: AccountLine): TeamLine => ({
  id: l.id,
  kind: l.kind,
  amount: l.amount,
  at: l.at,
  note: l.note ?? '',
  by: l.by ?? '',
  source: l.source,
  method: l.method ?? null,
  // Le numéro seulement : jamais l'id de la recette.
  recetteNumber: l.source === 'caisse' ? (l.recetteNumber ?? null) : null,
  cancelled: Boolean(l.cancelled),
})

export interface TeamDetailResponse {
  month: string
  thisMonth: string
  firstMonth: string
  employee: {
    id: string
    name: string
    poste: string
    isActive: boolean
    hireDate: string | null
    leftAt: string | null
    salary: number
    trackFrom: string
  }
  balance: number
  statement: TeamMonth
  lifetime: { due: number; avances: number; paiements: number }
  lines: TeamLine[]
}

/**
 * Depuis le début du suivi — la même somme que la fiche du back-office
 * (`sumRows`) : dû = salaires + primes − retenues.
 */
export function lifetimeOf(rows: MonthRow[]) {
  let salary = 0
  let primes = 0
  let retenues = 0
  let avances = 0
  let paiements = 0
  for (const r of rows) {
    salary += r.salary
    primes += r.primes
    retenues += r.retenues
    avances += r.avances
    paiements += r.paiements
  }
  return { due: round2(salary + primes - retenues), avances: round2(avances), paiements: round2(paiements) }
}

export function detailOf(
  account: Pick<EmployeeAccount, 'rows' | 'lines' | 'balance'> & { employee: EmployeeView },
  month: string,
  thisMonth: string
): TeamDetailResponse {
  const e = account.employee
  const lines = account.lines
    .filter((l) => l.month === month)
    // Du plus récent au plus ancien ; l'id départage deux lignes de même instant.
    .sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id))
    .map(lineOf)

  return {
    month,
    thisMonth,
    firstMonth: account.rows[0]?.month ?? e.trackFrom,
    employee: {
      id: String(e._id),
      name: e.name,
      poste: e.poste ?? '',
      isActive: e.isActive !== false,
      hireDate: e.hireDate ?? null,
      leftAt: e.leftAt ?? null,
      salary: Number(e.salary) || 0,
      trackFrom: e.trackFrom,
    },
    balance: account.balance,
    statement: monthOf(rowFor(account.rows, month)),
    lifetime: lifetimeOf(account.rows),
    lines,
  }
}
