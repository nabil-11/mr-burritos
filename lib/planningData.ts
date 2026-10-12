import { connectDB } from './mongodb'
import { Employee } from './models/Employee'
import { PlanningDay } from './models/PlanningDay'
import mongoose from 'mongoose'
import {
  MAX_COPY_WEEKS,
  PlanningError,
  buildPlanning,
  copyOp,
  isPlanningMonth,
  mondayOf,
  monthPairs,
  nextMonth,
  weekPairs,
  type Planning,
  type PlanningException,
  type WeekSlot,
} from './planning'
import { DEFAULT_TIME_ZONE, addDays, dayOf, isDay } from './reportTime'

/** Un planning se lit à la semaine ou au mois ; au-delà, ce n'est plus un planning. */
const MAX_DAYS = 62

/** Qui peut modifier le planning : ceux qui décident des horaires. */
export const canEditPlanning = (role: unknown) => role === 'admin' || role === 'manager'

/**
 * La période demandée, remise d'aplomb : sans dates, la semaine en cours, du
 * lundi au dimanche.
 */
export function planningRange(from?: string | null, to?: string | null) {
  const today = dayOf(new Date(), DEFAULT_TIME_ZONE)
  let start = isDay(from) ? from : mondayOf(today)
  let end = isDay(to) ? to : addDays(start, 6)
  if (start > end) [start, end] = [end, start]
  if (end > addDays(start, MAX_DAYS - 1)) end = addDays(start, MAX_DAYS - 1)
  return { from: start, to: end, today }
}

/** Le planning d'une période : les employés actifs, leur semaine type et les exceptions. */
export async function loadPlanning(from?: string | null, to?: string | null, canEdit = false): Promise<Planning> {
  const range = planningRange(from, to)
  await connectDB()
  const [employees, exceptions] = await Promise.all([
    Employee.find({ isActive: true }).sort({ name: 1 }).select('name poste schedule').lean() as Promise<
      { _id: unknown; name: string; poste?: string; schedule?: WeekSlot[] }[]
    >,
    PlanningDay.find({ date: { $gte: range.from, $lte: range.to } }).select('employee date kind shifts note').lean() as Promise<
      ({ employee: unknown; date: string } & PlanningException)[]
    >,
  ])
  const byKey = new Map<string, PlanningException>()
  for (const x of exceptions) byKey.set(`${String(x.employee)}:${x.date}`, { kind: x.kind, shifts: x.shifts, note: x.note })
  return buildPlanning(
    employees.map((e) => ({ _id: String(e._id), name: e.name, poste: e.poste, schedule: e.schedule })),
    byKey,
    { ...range, canEdit }
  )
}

export type CopyRequest =
  /** Un jour d'un employé, recopié sur d'autres jours. */
  | { mode: 'day'; employeeId: string; from: string; to: string[] }
  /** Une semaine (son lundi) recopiée sur les suivantes ; tous les employés, ou un seul. */
  | { mode: 'week'; from: string; weeks: number; employeeId?: string }
  /** Un mois recopié sur un autre — le suivant par défaut. */
  | { mode: 'month'; from: string; to?: string; employeeId?: string }

/** Lit ce qu'on demande de dupliquer, et refuse ce qui n'a pas de sens. */
export function cleanCopy(body: Record<string, unknown>): CopyRequest {
  const employeeId = body.employeeId ? String(body.employeeId) : undefined
  if (employeeId && !mongoose.isValidObjectId(employeeId)) throw new PlanningError('Employé introuvable', 404)

  if (body.mode === 'day') {
    if (!employeeId) throw new PlanningError('Employé introuvable', 404)
    if (!isDay(body.from as string)) throw new PlanningError('Jour invalide')
    const to = Array.isArray(body.to) ? [...new Set(body.to.map(String))] : []
    if (to.length === 0 || to.length > MAX_DAYS || !to.every((d) => isDay(d))) throw new PlanningError('Jours de destination invalides')
    return { mode: 'day', employeeId, from: body.from as string, to: to.filter((d) => d !== body.from) }
  }
  if (body.mode === 'week') {
    if (!isDay(body.from as string)) throw new PlanningError('Semaine invalide')
    const weeks = Math.floor(Number(body.weeks ?? 1))
    if (!(weeks >= 1 && weeks <= MAX_COPY_WEEKS)) throw new PlanningError(`De 1 à ${MAX_COPY_WEEKS} semaines`)
    return { mode: 'week', from: mondayOf(body.from as string), weeks, employeeId }
  }
  if (body.mode === 'month') {
    if (!isPlanningMonth(body.from)) throw new PlanningError('Mois invalide')
    const to = body.to == null || body.to === '' ? nextMonth(body.from) : body.to
    if (!isPlanningMonth(to) || to === body.from) throw new PlanningError('Mois de destination invalide')
    return { mode: 'month', from: body.from, to, employeeId }
  }
  throw new PlanningError('Que faut-il dupliquer : un jour, une semaine ou un mois ?')
}

/**
 * Duplique un jour, une semaine ou un mois — voir `copyOp` dans lib/planning
 * pour ce que « dupliquer » veut dire. Tout ce qui se trouvait sur les jours
 * d'arrivée est remplacé. Rend le nombre de jours écrits.
 */
export async function copyPlanning(request: CopyRequest, editor: string): Promise<{ days: number; employees: number }> {
  const pairs =
    request.mode === 'day'
      ? request.to.map((target) => ({ source: request.from, target }))
      : request.mode === 'week'
        ? weekPairs(request.from, request.weeks)
        : monthPairs(request.from, request.to ?? nextMonth(request.from))
  if (pairs.length === 0) return { days: 0, employees: 0 }

  await connectDB()
  const employees = (await Employee.find(request.employeeId ? { _id: request.employeeId } : { isActive: true })
    .select('schedule')
    .lean()) as { _id: unknown; schedule?: WeekSlot[] }[]
  if (employees.length === 0) throw new PlanningError('Employé introuvable', 404)

  const sources = [...new Set(pairs.map((p) => p.source))]
  const found = (await PlanningDay.find({
    employee: { $in: employees.map((e) => e._id) },
    date: { $in: sources },
  })
    .select('employee date kind shifts note')
    .lean()) as ({ employee: unknown; date: string } & PlanningException)[]
  const exceptions = new Map(found.map((x) => [`${String(x.employee)}:${x.date}`, x]))

  const writes = employees.flatMap((e) =>
    pairs.map(({ source, target }) => {
      const op = copyOp(e.schedule, exceptions.get(`${String(e._id)}:${source}`), source, target)
      const filter = { employee: e._id, date: target }
      return op.op === 'clear'
        ? { deleteOne: { filter } }
        : {
            updateOne: {
              filter,
              update: { $set: { kind: op.kind, shifts: op.shifts, note: op.note, updatedBy: { name: editor } } },
              upsert: true,
            },
          }
    })
  )
  await PlanningDay.bulkWrite(writes, { ordered: false })
  return { days: pairs.length, employees: employees.length }
}
