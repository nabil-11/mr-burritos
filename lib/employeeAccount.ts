import mongoose from 'mongoose'
import { connectDB } from './mongodb'
import { Recette } from './models/Recette'
import { Employee } from './models/Employee'
import { EmployeeEntry } from './models/EmployeeEntry'
import {
  type AccountLine,
  type AccountSetup,
  type MonthRow,
  buildStatement,
  currentMonth,
  monthOf,
  rowFor,
} from './payroll'

/**
 * Le compte des employés, lu là où ses lignes vivent.
 *
 * Ce que le tiroir a versé — avances, salaire payé en caisse — est un
 * mouvement de recette rattaché à l'employé : c'est ce qui fait tomber le
 * tiroir juste, et l'annuler se fait sur la recette. Le reste — primes,
 * retenues, paiements hors caisse — est dans EmployeeEntry. Le calcul, lui,
 * est dans lib/payroll.
 */

export interface EmployeeView {
  _id: string
  name: string
  poste: string
  phone: string
  cin: string
  address: string
  hireDate: string | null
  salary: number
  trackFrom: string
  openingBalance: number
  notes: string
  isActive: boolean
  leftAt: string | null
}

type EmployeeLean = {
  _id: unknown
  name: string
  poste?: string
  phone?: string
  cin?: string
  address?: string
  hireDate?: Date | null
  salary?: number
  salaries?: { from: string; amount: number }[]
  trackFrom?: string | null
  openingBalance?: number
  notes?: string
  isActive?: boolean
  leftAt?: Date | null
  createdAt?: Date
}

export function viewOf(e: EmployeeLean): EmployeeView {
  return {
    _id: String(e._id),
    name: e.name,
    poste: e.poste ?? '',
    phone: e.phone ?? '',
    cin: e.cin ?? '',
    address: e.address ?? '',
    hireDate: e.hireDate ? new Date(e.hireDate).toISOString() : null,
    salary: Number(e.salary) || 0,
    trackFrom: setupOf(e).trackFrom,
    openingBalance: Number(e.openingBalance) || 0,
    notes: e.notes ?? '',
    isActive: e.isActive !== false,
    leftAt: e.leftAt ? new Date(e.leftAt).toISOString() : null,
  }
}

/**
 * Le barème d'un employé. Une fiche créée avant le barème n'a qu'un salaire
 * et une date de création : le suivi commence alors au mois de sa création.
 */
export function setupOf(e: EmployeeLean): AccountSetup {
  const trackFrom = e.trackFrom || monthOf(e.createdAt ?? new Date())
  const salaries = e.salaries?.length ? e.salaries : [{ from: trackFrom, amount: Number(e.salary) || 0 }]
  return {
    salaries,
    trackFrom,
    openingBalance: Number(e.openingBalance) || 0,
    untilMonth: e.isActive === false && e.leftAt ? monthOf(e.leftAt) : null,
  }
}

/** Toutes les lignes, annulées comprises, groupées par employé. */
async function loadLines(employeeId?: string): Promise<Map<string, AccountLine[]>> {
  await connectDB()
  const oid = employeeId ? new mongoose.Types.ObjectId(employeeId) : null

  const [cash, entries] = await Promise.all([
    Recette.aggregate([
      { $match: { 'mouvements.employee.id': oid ?? { $ne: null } } },
      { $unwind: '$mouvements' },
      { $match: { 'mouvements.employee.id': oid ?? { $ne: null } } },
      {
        $project: {
          _id: 0,
          recetteId: '$_id',
          recetteNumber: '$number',
          movementId: '$mouvements._id',
          at: '$mouvements.createdAt',
          amount: '$mouvements.amount',
          note: '$mouvements.note',
          by: '$mouvements.createdBy.name',
          employeeId: '$mouvements.employee.id',
          reason: '$mouvements.employee.reason',
          cancelledAt: '$mouvements.cancelledAt',
        },
      },
    ]) as Promise<
      {
        recetteId: unknown
        recetteNumber: string
        movementId: unknown
        at: Date
        amount: number
        note?: string
        by?: string
        employeeId: unknown
        reason?: string
        cancelledAt?: Date | null
      }[]
    >,
    EmployeeEntry.find(oid ? { employee: oid } : {}).lean() as Promise<
      {
        _id: unknown
        employee: unknown
        kind: 'prime' | 'retenue' | 'paiement'
        amount: number
        date: Date
        method?: string | null
        note?: string
        createdBy?: { name?: string }
        cancelledAt?: Date | null
      }[]
    >,
  ])

  const byEmployee = new Map<string, AccountLine[]>()
  const push = (id: string, line: AccountLine) => byEmployee.set(id, [...(byEmployee.get(id) ?? []), line])

  for (const c of cash) {
    push(String(c.employeeId), {
      id: String(c.movementId),
      kind: c.reason === 'salaire' ? 'salaire' : 'avance',
      amount: Number(c.amount) || 0,
      at: new Date(c.at).toISOString(),
      month: monthOf(c.at),
      note: c.note ?? '',
      by: c.by ?? '',
      source: 'caisse',
      recetteId: String(c.recetteId),
      recetteNumber: c.recetteNumber,
      cancelled: Boolean(c.cancelledAt),
    })
  }
  for (const e of entries) {
    push(String(e.employee), {
      id: String(e._id),
      kind: e.kind,
      amount: Number(e.amount) || 0,
      at: new Date(e.date).toISOString(),
      month: monthOf(e.date),
      note: e.note ?? '',
      by: e.createdBy?.name ?? '',
      source: 'manuel',
      method: e.method ?? null,
      cancelled: Boolean(e.cancelledAt),
    })
  }
  for (const lines of byEmployee.values()) lines.sort((a, b) => b.at.localeCompare(a.at))
  return byEmployee
}

export interface EmployeeAccount {
  employee: EmployeeView
  rows: MonthRow[]
  lines: AccountLine[]
  /** Ce qui lui est dû aujourd'hui. */
  balance: number
}

export async function accountOf(employeeId: string): Promise<EmployeeAccount | null> {
  if (!mongoose.isValidObjectId(employeeId)) return null
  await connectDB()
  const [doc, lines] = await Promise.all([
    Employee.findById(employeeId).lean() as Promise<EmployeeLean | null>,
    loadLines(employeeId),
  ])
  if (!doc) return null
  const all = lines.get(employeeId) ?? []
  const rows = buildStatement(setupOf(doc), all, currentMonth())
  return { employee: viewOf(doc), rows, lines: all, balance: rows.at(-1)?.closing ?? 0 }
}

export interface EmployeeOverview {
  employee: EmployeeView
  /** Le mois demandé. */
  month: MonthRow
  balance: number
}

/** Tous les employés : le mois demandé et le solde du jour. Actifs d'abord, puis par nom. */
export async function overview(month: string, opts: { activeOnly?: boolean } = {}): Promise<EmployeeOverview[]> {
  await connectDB()
  const [docs, lines] = await Promise.all([
    Employee.find(opts.activeOnly ? { isActive: true } : {})
      .sort({ isActive: -1, name: 1 })
      .lean() as Promise<EmployeeLean[]>,
    loadLines(),
  ])
  const now = currentMonth()
  return docs.map((doc) => {
    const rows = buildStatement(setupOf(doc), lines.get(String(doc._id)) ?? [], now)
    return { employee: viewOf(doc), month: rowFor(rows, month), balance: rows.at(-1)?.closing ?? 0 }
  })
}

/** Vrai dès qu'une ligne, même annulée, le concerne : il ne peut plus être supprimé. */
export async function hasHistory(employeeId: string): Promise<boolean> {
  if (!mongoose.isValidObjectId(employeeId)) return false
  await connectDB()
  const oid = new mongoose.Types.ObjectId(employeeId)
  const [cash, entry] = await Promise.all([
    Recette.exists({ 'mouvements.employee.id': oid }),
    EmployeeEntry.exists({ employee: oid }),
  ])
  return Boolean(cash || entry)
}
