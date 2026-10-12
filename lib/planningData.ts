import { connectDB } from './mongodb'
import { Employee } from './models/Employee'
import { PlanningDay } from './models/PlanningDay'
import { buildPlanning, mondayOf, type Planning, type PlanningException, type WeekSlot } from './planning'
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
