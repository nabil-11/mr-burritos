import { connectDB } from './mongodb'
import { Employee } from './models/Employee'
import { PlanningDay } from './models/PlanningDay'
import mongoose from 'mongoose'
import {
  MAX_COPY_WEEKS,
  PlanningError,
  buildPlanning,
  copyOp,
  cleanShifts,
  isDayKind,
  isPlanningMonth,
  mondayOf,
  monthPairs,
  nextMonth,
  resolveCell,
  weekPairs,
  type Planning,
  type PlanningCell,
  type PlanningException,
  type WeekSlot,
} from './planning'
import { DEFAULT_TIME_ZONE, addDays, dayOf, isDay, startOfDay } from './reportTime'

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

/** Un employé tel que le planning le lit, avec son départ s'il est parti. */
export interface PlanningEmployeeRow {
  _id: string
  name: string
  poste: string
  schedule: WeekSlot[]
  isActive: boolean
  leftAt: Date | null
}

/**
 * Ce que lisent le planning et le pointage : les employés (par nom) et les
 * exceptions de la période, sous la clé `${employeeId}:${date}`.
 *
 * Sans `employeeIds` : les employés actifs, et avec `includeLeft` ceux qui sont
 * partis le jour `from` ou après (`leftAt` >= début du jour). Avec
 * `employeeIds` : ces employés-là et eux seuls, actifs ou non — c'est l'appelant
 * qui sait pourquoi il les veut.
 */
export async function readPlanningInputs(
  range: { from: string; to: string },
  opts: { employeeIds?: string[]; includeLeft?: boolean } = {}
): Promise<{ employees: PlanningEmployeeRow[]; exceptions: Map<string, PlanningException> }> {
  await connectDB()
  const filter = opts.employeeIds
    ? { _id: { $in: opts.employeeIds } }
    : opts.includeLeft
      ? { $or: [{ isActive: true }, { leftAt: { $gte: startOfDay(range.from, DEFAULT_TIME_ZONE) } }] }
      : { isActive: true }
  const [employees, exceptions] = await Promise.all([
    Employee.find(filter).sort({ name: 1 }).select('name poste schedule isActive leftAt').lean() as Promise<
      { _id: unknown; name: string; poste?: string; schedule?: WeekSlot[]; isActive?: boolean; leftAt?: Date | null }[]
    >,
    PlanningDay.find({ date: { $gte: range.from, $lte: range.to } }).select('employee date kind shifts note').lean() as Promise<
      ({ employee: unknown; date: string } & PlanningException)[]
    >,
  ])
  const byKey = new Map<string, PlanningException>()
  for (const x of exceptions) byKey.set(`${String(x.employee)}:${x.date}`, { kind: x.kind, shifts: x.shifts, note: x.note })
  return {
    employees: employees.map((e) => ({
      _id: String(e._id),
      name: e.name,
      poste: e.poste ?? '',
      schedule: e.schedule ?? [],
      isActive: e.isActive !== false,
      leftAt: e.leftAt ?? null,
    })),
    exceptions: byKey,
  }
}

/** Le planning d'une période : les employés actifs, leur semaine type et les exceptions. */
export async function loadPlanning(from?: string | null, to?: string | null, canEdit = false): Promise<Planning> {
  const range = planningRange(from, to)
  const { employees, exceptions } = await readPlanningInputs(range)
  return buildPlanning(
    employees.map((e) => ({ _id: e._id, name: e.name, poste: e.poste, schedule: e.schedule })),
    exceptions,
    { ...range, canEdit }
  )
}

/** Un employé et ce qu'il fait un jour donné. */
export interface DayCell {
  employeeId: string
  name: string
  poste: string
  active: boolean
  /** Le jour (Tunis) où il est parti, ou null. */
  leftDay: string | null
  cell: PlanningCell
}

/**
 * Ce que chaque employé fait un jour précis (exception d'abord, semaine type
 * sinon — `resolveCell`), par nom. Voir `readPlanningInputs` pour qui est
 * inclus.
 */
export async function resolveDayCells(
  date: string,
  opts: { employeeIds?: string[]; includeLeft: boolean }
): Promise<DayCell[]> {
  const { employees, exceptions } = await readPlanningInputs({ from: date, to: date }, opts)
  return employees.map((e) => ({
    employeeId: e._id,
    name: e.name,
    poste: e.poste,
    active: e.isActive,
    leftDay: e.leftAt ? dayOf(e.leftAt, DEFAULT_TIME_ZONE) : null,
    cell: resolveCell(e.schedule, exceptions.get(`${e._id}:${date}`), date),
  }))
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
  if (employeeId && !mongoose.isValidObjectId(employeeId)) throw new PlanningError('Employé introuvable', 404, 'not_found')

  if (body.mode === 'day') {
    if (!employeeId) throw new PlanningError('Employé introuvable', 404, 'not_found')
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
  if (employees.length === 0) throw new PlanningError('Employé introuvable', 404, 'not_found')

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

/** L'id d'un employé existant (actif ou non), ou le refus 404. */
export async function employeeIdOf(raw: unknown): Promise<string> {
  const id = String(raw ?? '')
  if (!mongoose.isValidObjectId(id)) throw new PlanningError('Employé introuvable', 404, 'not_found')
  await connectDB()
  if (!(await Employee.exists({ _id: id }))) throw new PlanningError('Employé introuvable', 404, 'not_found')
  return id
}

/**
 * Ce qu'un employé fait un jour précis — le corps de PUT /api/planning et de
 * PUT /api/manager/planning/day.
 *
 * Body : { employeeId, date, kind, shifts?, note? }. `kind` 'semaine' retire
 * l'exception : le jour revient à la semaine type. 'travail' sans `shifts`
 * reprend les horaires de la semaine type.
 *
 * `minDate` : le premier jour qu'on a le droit de toucher. Le back-office n'en
 * donne pas ; l'app du gérant donne le lundi de cette semaine (refus
 * `past_week`) — on ne réécrit pas le passé depuis un téléphone.
 */
export async function setPlanningDay(
  body: Record<string, unknown>,
  editor: string,
  // `maxDate` : le dernier jour permis (plus loin : bad_request). `activeOnly` :
  // un employé parti n'a plus de planning à écrire (bad_request).
  opts: { minDate?: string; maxDate?: string; activeOnly?: boolean } = {}
) {
  const employeeId = await employeeIdOf(body.employeeId)
  if (!isDay(body.date as string)) throw new PlanningError('Jour invalide')
  const date = body.date as string
  if (opts.minDate && date < opts.minDate) {
    throw new PlanningError('Ce jour est dans une semaine passée', 400, 'past_week')
  }
  if (opts.maxDate && date > opts.maxDate) throw new PlanningError('Ce jour est trop loin : un an au plus', 400, 'bad_request')
  if (opts.activeOnly && !(await Employee.exists({ _id: employeeId, isActive: true }))) {
    throw new PlanningError("Cet employé n'est plus actif", 400, 'bad_request')
  }

  if (body.kind === 'semaine') {
    await PlanningDay.deleteOne({ employee: employeeId, date })
    return
  }
  if (!isDayKind(body.kind)) throw new PlanningError('Type de jour invalide')
  const shifts = body.kind === 'travail' ? cleanShifts(body.shifts) : []
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 200) : ''
  await PlanningDay.findOneAndUpdate(
    { employee: employeeId, date },
    { $set: { kind: body.kind, shifts, note, updatedBy: { name: editor } } },
    { upsert: true, runValidators: true }
  )
}
