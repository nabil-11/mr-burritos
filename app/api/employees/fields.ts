import { NextResponse } from 'next/server'
import { isMonth } from '@/lib/payroll'
import { isDay, startOfDay, DEFAULT_TIME_ZONE } from '@/lib/reportTime'

export class EmployeeInputError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

/** « 12,5 » comme 12.5 ; vide vaut 0. */
export function amountOf(v: unknown, { allowNegative = false } = {}): number {
  const raw = String(v ?? '').replace(',', '.').trim()
  const n = raw === '' ? 0 : Number(raw)
  if (!Number.isFinite(n) || (!allowNegative && n < 0) || Math.abs(n) > 1_000_000) {
    throw new EmployeeInputError('Montant invalide')
  }
  return Math.round(n * 100) / 100
}

export interface EmployeeFields {
  name?: string
  poste?: string
  phone?: string
  cin?: string
  address?: string
  hireDate?: Date | null
  salary?: number
  /** Mois à partir duquel `salary` s'applique ; le mois en cours par défaut. */
  salaryFrom?: string
  trackFrom?: string
  openingBalance?: number
  notes?: string
  isActive?: boolean
}

/** The fields a request may set, and nothing else. `creating` makes the name mandatory. */
export function employeeFields(body: Record<string, unknown>, creating: boolean): EmployeeFields {
  const out: EmployeeFields = {}
  if ('name' in body || creating) {
    const name = text(body.name, 60)
    if (!name) throw new EmployeeInputError('Indiquez un nom')
    out.name = name
  }
  if ('poste' in body) out.poste = text(body.poste, 40)
  if ('phone' in body) out.phone = text(body.phone, 30)
  if ('cin' in body) out.cin = text(body.cin, 20)
  if ('address' in body) out.address = text(body.address, 120)
  if ('notes' in body) out.notes = text(body.notes, 500)
  if ('hireDate' in body) {
    const d = text(body.hireDate, 10)
    if (d && !isDay(d)) throw new EmployeeInputError("Date d'embauche invalide")
    out.hireDate = d ? startOfDay(d, DEFAULT_TIME_ZONE) : null
  }
  if ('salary' in body) out.salary = amountOf(body.salary)
  if ('salaryFrom' in body && body.salaryFrom) {
    if (!isMonth(body.salaryFrom)) throw new EmployeeInputError('Mois du salaire invalide')
    out.salaryFrom = body.salaryFrom
  }
  if ('trackFrom' in body && body.trackFrom) {
    if (!isMonth(body.trackFrom)) throw new EmployeeInputError('Début du suivi invalide')
    out.trackFrom = body.trackFrom
  }
  if ('openingBalance' in body) out.openingBalance = amountOf(body.openingBalance, { allowNegative: true })
  if ('isActive' in body) out.isActive = Boolean(body.isActive)
  return out
}

export function employeeError(e: unknown) {
  if (e instanceof EmployeeInputError) return NextResponse.json({ error: e.message }, { status: e.status })
  if ((e as { code?: number })?.code === 11000) {
    return NextResponse.json({ error: 'Un employé porte déjà ce nom' }, { status: 409 })
  }
  const msg = e instanceof Error ? e.message : 'Erreur serveur'
  return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 })
}
