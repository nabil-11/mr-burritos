/**
 * Mr. Burritos — vérification des routes équipe du manager
 * Lance avec : npm run check:team
 *
 * Aucune base, aucun serveur : lib/managerTeam et lib/payroll sont purs
 * (employeeAccount n'est importé que pour ses types). Échoue (code 1) au
 * premier écart.
 */

import assert from 'node:assert/strict'
import type { EmployeeOverview, EmployeeView } from '../lib/employeeAccount'
import { type AccountLine, type AccountSetup, buildStatement, rowFor } from '../lib/payroll'
import { detailOf, lifetimeOf, resolveMonth, teamOf } from '../lib/managerTeam'

const THIS = '2026-11'
const SECRETS = ['0600112233', 'CIN-998877', '12 rue du Secret', 'note privee', 'oid-recette-SECRET']
const FORBIDDEN_KEYS = ['phone', 'cin', 'address', 'notes', 'openingBalance', 'recetteId', '_id']

let n = 0
const ok = (label: string) => console.log(`ok  ${label}`)

const view = (name: string, over: Partial<EmployeeView> = {}): EmployeeView => ({
  _id: `e${++n}`,
  name,
  poste: 'Cuisinier',
  phone: SECRETS[0],
  cin: SECRETS[1],
  address: SECRETS[2],
  hireDate: '2025-01-10T00:00:00.000Z',
  salary: 1000,
  trackFrom: '2026-09',
  openingBalance: 123.45,
  notes: SECRETS[3],
  isActive: true,
  leftAt: null,
  ...over,
})

const setupOf = (e: EmployeeView, untilMonth: string | null = null): AccountSetup => ({
  salaries: [{ from: e.trackFrom, amount: e.salary }],
  trackFrom: e.trackFrom,
  openingBalance: e.openingBalance,
  untilMonth,
})

const line = (over: Partial<AccountLine> & Pick<AccountLine, 'kind' | 'amount' | 'at'>): AccountLine => ({
  id: `l${++n}`,
  month: over.at.slice(0, 7),
  note: '',
  by: 'Manager',
  source: 'manuel',
  ...over,
})

const account = (e: EmployeeView, lines: AccountLine[], untilMonth: string | null = null) => {
  const rows = buildStatement(setupOf(e, untilMonth), lines, THIS)
  return { employee: e, rows, lines, balance: rows.at(-1)?.closing ?? 0 }
}
const overviewOf = (a: ReturnType<typeof account>, month: string): EmployeeOverview => ({
  employee: a.employee,
  month: rowFor(a.rows, month),
  balance: a.balance,
})

/** Every key and every value, at every depth. */
function walk(v: unknown, visit: (key: string | null, value: unknown) => void, key: string | null = null) {
  visit(key, v)
  if (Array.isArray(v)) v.forEach((x) => walk(x, visit))
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, visit, k)
}
function assertNoPii(body: unknown, label: string) {
  walk(body, (key, value) => {
    if (key) assert.ok(!FORBIDDEN_KEYS.includes(key), `${label}: forbidden key "${key}"`)
    if (typeof value === 'string') for (const s of SECRETS) assert.ok(!value.includes(s), `${label}: leaked "${s}"`)
  })
}
const r2 = (x: number) => Math.round(x * 100) / 100

// ── Fixture: four employees, one overpaid, one departed, one cancelled line ──
const zoe = view('zoé', { salary: 1000 })
const abel = view('Abel', { salary: 800 })
const ines = view('Inès', { salary: 600, openingBalance: 0 })
const gone = view('Aaron', { salary: 900, isActive: false, leftAt: '2026-10-05T10:00:00.000Z' })

const zoeLines = [
  line({ kind: 'avance', amount: 200, at: '2026-11-02T09:00:00.000Z', source: 'caisse', recetteId: SECRETS[4], recetteNumber: 'R-0042', note: 'avance' }),
  line({ kind: 'avance', amount: 50, at: '2026-11-02T09:30:00.000Z', source: 'caisse', recetteId: SECRETS[4], recetteNumber: 'R-0042', cancelled: true }),
  line({ kind: 'prime', amount: 30, at: '2026-11-01T08:00:00.000Z' }),
  line({ kind: 'retenue', amount: 10, at: '2026-11-03T08:00:00.000Z' }),
  line({ kind: 'paiement', amount: 100, at: '2026-11-03T07:00:00.000Z', method: 'virement' }),
  line({ kind: 'salaire', amount: 700, at: '2026-10-02T09:00:00.000Z', source: 'caisse', recetteId: SECRETS[4], recetteNumber: 'R-0030' }),
]
const abelLines = [
  line({ kind: 'avance', amount: 3000, at: '2026-11-01T10:00:00.000Z', source: 'caisse', recetteId: SECRETS[4], recetteNumber: 'R-0041' }),
]
const goneLines = [line({ kind: 'paiement', amount: 100, at: '2026-10-06T10:00:00.000Z' })]

const accounts = [
  account(zoe, zoeLines),
  account(abel, abelLines),
  account(ines, []),
  account(gone, goneLines, '2026-10'), // his salary stops after October
]

// ── Month: validation, default, clamping ─────────────────────────────────────
assert.equal(resolveMonth(null, THIS), THIS)
assert.equal(resolveMonth(undefined, THIS), THIS)
assert.equal(resolveMonth('2026-10', THIS), '2026-10')
assert.equal(resolveMonth(THIS, THIS), THIS)
assert.equal(resolveMonth('2026-12', THIS), THIS)
assert.equal(resolveMonth('2031-01', THIS), THIS)
for (const bad of ['', '2026', '2026-1', '2026-13', '2026-00', '26-10', '2026-10-01', 'octobre', ' 2026-10', '2026-10 ', '2026/10'])
  assert.equal(resolveMonth(bad, THIS), null, `"${bad}" must be rejected`)
ok('month: default, clamped when future, bad formats rejected')

// ── Team list ────────────────────────────────────────────────────────────────
const team = teamOf(accounts.map((a) => overviewOf(a, THIS)).reverse(), THIS, THIS)
assert.equal(team.month, THIS)
assert.equal(team.thisMonth, THIS)
assert.deepEqual(
  team.employees.map((m) => m.name),
  ['Abel', 'Inès', 'zoé', 'Aaron'],
  'active first, then by name (accents and case ignored), inactive last'
)
ok('sort: active first, then by name')

const zoeM = team.employees.find((m) => m.name === 'zoé')!.month
assert.equal(zoeM.avances, 200, 'cancelled advance (50) is not counted')
assert.equal(zoeM.lines, 4, 'month.lines counts live lines only')
assert.equal(zoeM.primes, 30)
assert.equal(zoeM.retenues, 10)
assert.equal(zoeM.paiements, 100)
const abelM = team.employees.find((m) => m.name === 'Abel')!
assert.ok(abelM.month.closing < 0, 'Abel is overpaid: negative closing')
assert.ok(abelM.balance < 0)

const closings = team.employees.map((m) => m.month.closing)
const positive = closings.reduce((s, c) => s + Math.max(0, c), 0)
assert.ok(Math.abs(closings.reduce((s, c) => s + c, 0) - positive) > 1, 'fixture: a negative closing makes the two sums differ')
assert.equal(team.totals.remaining, r2(positive))
assert.equal(team.totals.salary, r2(team.employees.reduce((s, m) => s + m.month.salary, 0)))
assert.equal(team.totals.avances, r2(team.employees.reduce((s, m) => s + m.month.avances, 0)))
assert.equal(team.totals.paiements, r2(team.employees.reduce((s, m) => s + m.month.paiements, 0)))
assert.equal(team.totals.salary, 1000 + 800 + 600, 'the departed employee earns nothing in November')
assert.equal(team.totals.avances, 200 + 3000)
assert.equal(team.totals.paiements, 100)
ok('totals: salary, avances, paiements; remaining ignores negative closings')

const goneM = team.employees.find((m) => m.name === 'Aaron')!
assert.equal(goneM.isActive, false)
assert.equal(goneM.leftAt, '2026-10-05T10:00:00.000Z')
assert.equal(team.employees.find((m) => m.name === 'Inès')!.leftAt, null)
ok('inactive employee: isActive false, leftAt kept')

const oct = teamOf(accounts.map((a) => overviewOf(a, '2026-10')), '2026-10', THIS)
assert.equal(oct.month, '2026-10')
assert.equal(oct.thisMonth, THIS)
const before = teamOf(accounts.map((a) => overviewOf(a, '2020-01')), '2020-01', THIS)
assert.equal(before.totals.salary, 0)
assert.equal(before.totals.remaining, 0)
ok('other months: thisMonth stays the current one, pre-tracking month is empty')

assertNoPii(team, 'team')
assertNoPii(oct, 'team/oct')
assert.deepEqual(Object.keys(team).sort(), ['employees', 'month', 'thisMonth', 'totals'])
assert.deepEqual(Object.keys(team.employees[0]).sort(), ['balance', 'id', 'isActive', 'leftAt', 'month', 'name', 'poste'])
assert.deepEqual(Object.keys(team.totals).sort(), ['avances', 'paiements', 'remaining', 'salary'])
ok('team: no PII at any depth, exact key set')

// ── Detail ───────────────────────────────────────────────────────────────────
const d = detailOf(accounts[0], THIS, THIS)
assert.deepEqual(Object.keys(d).sort(), ['balance', 'employee', 'firstMonth', 'lifetime', 'lines', 'month', 'statement', 'thisMonth'])
assert.deepEqual(Object.keys(d.employee).sort(), ['hireDate', 'id', 'isActive', 'leftAt', 'name', 'poste', 'salary', 'trackFrom'])
assert.deepEqual(Object.keys(d.statement).sort(), ['avances', 'closing', 'lines', 'opening', 'paiements', 'primes', 'retenues', 'salary'])
assert.deepEqual(Object.keys(d.lifetime).sort(), ['avances', 'due', 'paiements'])
assert.deepEqual(
  Object.keys(d.lines[0]).sort(),
  ['amount', 'at', 'by', 'cancelled', 'id', 'kind', 'method', 'note', 'recetteNumber', 'source']
)
assert.equal(d.firstMonth, '2026-09')
assert.equal(d.employee.trackFrom, '2026-09')
assert.equal(d.employee.hireDate, '2025-01-10T00:00:00.000Z')
ok('detail: exact key set')

assert.equal(d.lines.length, 5, 'five November lines, the October salary is not among them')
assert.deepEqual(d.lines.map((l) => l.at), [...d.lines.map((l) => l.at)].sort().reverse(), 'newest first')
const cancelled = d.lines.filter((l) => l.cancelled)
assert.equal(cancelled.length, 1)
assert.equal(cancelled[0].amount, 50)
assert.equal(cancelled[0].kind, 'avance')
assert.equal(d.lines.filter((l) => !l.cancelled).length, d.statement.lines, 'statement.lines = live lines')
assert.equal(d.statement.avances, 200, 'cancelled line is excluded from the statement')
assert.equal(d.lines.find((l) => l.kind === 'paiement')!.method, 'virement')
assert.equal(d.lines.find((l) => l.kind === 'prime')!.method, null)
assert.equal(d.lines.find((l) => l.kind === 'avance' && !l.cancelled)!.recetteNumber, 'R-0042')
assert.equal(d.lines.find((l) => l.kind === 'prime')!.recetteNumber, null)
ok('lines: month only, newest first, cancelled listed but out of totals, recetteNumber only')

// Lifetime is the back-office sumRows: due = salaires + primes - retenues.
const sums = { salary: 0, primes: 0, retenues: 0, avances: 0, paiements: 0 }
for (const r of accounts[0].rows) for (const k of Object.keys(sums) as (keyof typeof sums)[]) sums[k] += r[k]
assert.deepEqual(d.lifetime, {
  due: r2(sums.salary + sums.primes - sums.retenues),
  avances: r2(sums.avances),
  paiements: r2(sums.paiements),
})
assert.deepEqual(d.lifetime, { due: 3020, avances: 200, paiements: 800 }) // 3 x 1000 + 30 - 10 ; 700 + 100
assert.equal(lifetimeOf([]).due, 0)
ok('lifetime: equals the back-office sums (cancelled excluded)')

assert.equal(d.balance, accounts[0].balance)
assert.equal(d.statement.closing, rowFor(accounts[0].rows, THIS).closing)
const dNeg = detailOf(accounts[1], THIS, THIS)
assert.ok(dNeg.statement.closing < 0 && dNeg.balance < 0, 'negative closing is passed through, not clamped')
ok('balance and negative closing pass through')

const dOct = detailOf(accounts[0], '2026-10', THIS)
assert.equal(dOct.month, '2026-10')
assert.equal(dOct.thisMonth, THIS)
assert.deepEqual(dOct.lines.map((l) => l.kind), ['salaire'])
assert.equal(dOct.lines[0].source, 'caisse')
const dEmpty = detailOf(accounts[2], '2020-01', THIS)
assert.deepEqual(dEmpty.lines, [])
assert.equal(dEmpty.statement.lines, 0)
assert.equal(dEmpty.statement.salary, 0)
const dGone = detailOf(accounts[3], THIS, THIS)
assert.equal(dGone.employee.isActive, false)
assert.equal(dGone.employee.leftAt, '2026-10-05T10:00:00.000Z')
assert.equal(dGone.statement.salary, 0)
ok('detail: other month, empty month, departed employee')

for (const [i, a] of accounts.entries()) {
  assertNoPii(detailOf(a, THIS, THIS), `detail#${i}`)
  assertNoPii(detailOf(a, '2026-10', THIS), `detail#${i}/oct`)
}
ok('detail: no PII at any depth, no recette id')

console.log('\ncheck:team passed')
