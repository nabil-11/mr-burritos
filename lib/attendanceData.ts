import mongoose from 'mongoose'
import { connectDB } from './mongodb'
import { Attendance } from './models/Attendance'
import { AttendanceDay } from './models/AttendanceDay'
import { Employee } from './models/Employee'
import {
  AttendanceError,
  HISTORY_CAP,
  assertWritable,
  cleanDate,
  cleanRows,
  markerOutcome,
  planWrite,
  plannedMinutesOf,
  summarize,
  type RowInput,
  type RowOp,
  type SummaryEmployee,
  type SummaryRecord,
} from './attendance'
import { attendanceDeadlineAt, readAttendanceDeadlineSetting } from './attendanceDeadline'
import {
  dayBody,
  statusBody,
  storedOf,
  summaryBody,
  type Marker,
  type Person,
  type RosterEntry,
} from './managerAttendance'
import { resolveCell, type PlanningCell } from './planning'
import { readPlanningInputs, resolveDayCells } from './planningData'
import { DEFAULT_TIME_ZONE, dayOf, daysBetween } from './reportTime'

/**
 * Le pointage et la base. Les règles sont dans lib/attendance (pures) ; les
 * formes rendues dans lib/managerAttendance ; ici seulement lire et écrire.
 *
 * Le planning (PlanningDay, Employee.schedule) n'est lu que : aucune écriture.
 */

export interface Actor {
  _id: unknown
  role: string
  /** L'e-mail du compte, relu en base : l'auteur de l'écriture. */
  email: string
}

type MarkerDoc = { validatedBy?: { name?: string } | null; validatedAt?: Date } | null

const markerOf = (doc: MarkerDoc): Marker | null =>
  doc ? { validatedBy: doc.validatedBy?.name ?? '', validatedAt: doc.validatedAt ? new Date(doc.validatedAt) : new Date(0) } : null

const rosterOf = (cells: Awaited<ReturnType<typeof resolveDayCells>>): RosterEntry[] =>
  cells.map((c) => ({ employeeId: c.employeeId, name: c.name, poste: c.poste, active: c.active, cell: c.cell }))

/** A2 : un jour, tel que le lit le gérant. */
export async function loadDay(date: string, now: Date, role: string) {
  await connectDB()
  const [cells, markerDoc, docs] = await Promise.all([
    resolveDayCells(date, { includeLeft: true }),
    AttendanceDay.findOne({ date }).select('validatedBy validatedAt').lean() as Promise<MarkerDoc>,
    Attendance.find({ date }).lean(),
  ])
  const roster = rosterOf(cells)
  const records = docs.map(storedOf).filter((r): r is NonNullable<typeof r> => r !== null)
  const known = new Set(roster.map((r) => r.employeeId))
  const outside = records.map((r) => r.employeeId).filter((id) => !known.has(id))
  const people = new Map<string, Person>()
  if (outside.length) {
    const found = (await Employee.find({ _id: { $in: outside } })
      .select('name poste isActive')
      .lean()) as { _id: unknown; name: string; poste?: string; isActive?: boolean }[]
    for (const e of found) people.set(String(e._id), { name: e.name, poste: e.poste ?? '', active: e.isActive !== false })
  }
  return dayBody({ date, now, role, marker: markerOf(markerDoc), roster, records, people })
}

/**
 * Les jours donnés avec leur marqueur et combien d'employés y sont planifiés
 * `travail`. Un jour validé se compte dans sa photo, un autre dans le planning
 * d'aujourd'hui.
 */
export async function loadStatusDays(dates: string[]) {
  await connectDB()
  const marks = (await AttendanceDay.find({ date: { $in: dates } })
    .select('date validatedBy validatedAt')
    .lean()) as ({ date: string } & NonNullable<MarkerDoc>)[]
  const byDate = new Map(marks.map((m) => [m.date, markerOf(m)]))
  return Promise.all(
    dates.map(async (date) => {
      const marker = byDate.get(date) ?? null
      const plannedCount = marker
        ? await Attendance.countDocuments({ date, 'planned.status': 'travail' })
        : (await resolveDayCells(date, { includeLeft: true })).filter((c) => c.cell.status === 'travail').length
      return { date, plannedCount, marker }
    })
  )
}

/** A1 */
export async function loadStatus(now: Date, role: string, dates: string[]) {
  const [deadline, days] = await Promise.all([readAttendanceDeadlineSetting(), loadStatusDays(dates)])
  return statusBody({ tz: DEFAULT_TIME_ZONE, now, role, deadline, days })
}

/** Les jours que l'alerte surveille, avec ce qu'elle lit : planifiés, validé ?, échéance. */
export async function loadAlertDays(dates: string[]) {
  const [deadline, days] = await Promise.all([readAttendanceDeadlineSetting(), loadStatusDays(dates)])
  return days.map((d) => ({
    date: d.date,
    plannedCount: d.plannedCount,
    validated: d.marker !== null,
    deadlineAt: attendanceDeadlineAt(d.date, deadline),
    deadlineAfterDays: deadline.afterDays,
    deadlineTime: deadline.time,
  }))
}

// ── A3 : l'écriture ──────────────────────────────────────────────────────────

/** Combien de fois une ligne se relit et se replanifie après un conflit, avant `conflict` (409). */
export const ROW_RETRIES = 3

const isDuplicate = (e: unknown) => (e as { code?: number })?.code === 11000

/**
 * Écrit une ligne, optimiste. Une insertion s'appuie sur l'index unique
 * {employee, date} ; une mise à jour ne passe que si `updatedAt` est encore celui
 * que le plan a lu. Faux : un autre a écrit entre-temps, il faut relire.
 */
async function writeRow(op: RowOp, date: string, who: Actor, now: Date): Promise<boolean> {
  const { updatedBy, ...rest } = op.set
  const by = updatedBy !== undefined ? { user: who._id, name: updatedBy } : undefined
  if (op.kind === 'insert') {
    try {
      await Attendance.create({
        employee: op.employeeId,
        date,
        ...rest,
        ...(by ? { updatedBy: by } : {}),
        createdAt: now,
        history: op.entry ? [op.entry] : [],
        historyDropped: 0,
        created: op.created,
      })
      return true
    } catch (e) {
      if (isDuplicate(e)) return false
      throw e
    }
  }
  const $set: Record<string, unknown> = { ...rest }
  if (by) $set.updatedBy = by
  const update: Record<string, unknown> = { $set }
  if (op.entry) update.$push = { history: { $each: [op.entry], $slice: -HISTORY_CAP } }
  if (op.droppedInc > 0) update.$inc = { historyDropped: op.droppedInc }
  const res = await Attendance.updateOne({ employee: op.employeeId, date, updatedAt: op.prevUpdatedAt }, update)
  return res.matchedCount > 0
}

interface RowContext {
  date: string
  who: Actor
  now: Date
  rows: Map<string, RowInput>
  live: Map<string, PlanningCell>
}

/**
 * Une ligne jusqu'au bout : on l'écrit, et si un autre a écrit avant nous on la
 * relit et on la replanifie (au plus ROW_RETRIES fois, puis 409 `conflict`). Le
 * perdant d'une course sur un même corps relit la ligne du gagnant, la trouve
 * identique et ne change rien. Rend si cette ligne a changé.
 */
async function commitRow(first: RowOp, ctx: RowContext): Promise<boolean> {
  const { date, who, now } = ctx
  let op: RowOp | null = first
  for (let retry = 0; op !== null; retry++) {
    if (await writeRow(op, date, who, now)) return op.changed
    if (retry >= ROW_RETRIES) break
    const id: string = op.employeeId
    const [doc, marker] = await Promise.all([Attendance.findOne({ employee: id, date }).lean(), AttendanceDay.exists({ date })])
    const rec = storedOf(doc)
    op =
      planWrite({
        date,
        validated: marker !== null,
        now,
        by: who.email,
        rows: [ctx.rows.get(id) as RowInput],
        live: ctx.live,
        required: [],
        existing: new Map(rec ? [[id, rec]] : []),
        checkMissing: false,
      }).ops[0] ?? null
    if (op === null) return false
  }
  throw new AttendanceError('conflict', 'Ce pointage vient d’être modifié par quelqu’un d’autre, réessayez', 409)
}

/**
 * A3 : la validation du jour. Rien du corps n'est cru hors liste blanche (voir
 * `cleanRows`) ; la fenêtre se lit sur l'horloge du serveur ; l'auteur est l'e-mail
 * du compte. Les lignes s'écrivent d'abord, le marqueur ensuite : une panne au
 * milieu laisse un jour non validé qu'on peut renvoyer, jamais un jour validé
 * incomplet.
 */
export async function validateDay(body: Record<string, unknown>, who: Actor, now: Date) {
  const date = cleanDate(body.date)
  assertWritable(date, now, who.role)
  const rows = cleanRows(body.rows)

  await connectDB()
  // L'index unique {employee, date} fait foi pour les insertions concurrentes : il doit exister.
  await Attendance.init()
  const [cells, markerDoc] = await Promise.all([
    resolveDayCells(date, { includeLeft: true }),
    AttendanceDay.findOne({ date }).select('validatedBy validatedAt').lean() as Promise<MarkerDoc>,
  ])
  const inRoster = new Map(cells.map((c) => [c.employeeId, c.cell]))

  // Hors de l'effectif du jour : inconnu (404), ou parti avant ce jour (400).
  const outside = rows.map((r) => r.employeeId).filter((id) => !inRoster.has(id))
  if (outside.length) {
    const found = await Employee.find({ _id: { $in: outside } }).select('_id').lean()
    if (found.length < outside.length) throw new AttendanceError('not_found', 'Employé introuvable', 404)
    throw new AttendanceError('bad_request', 'Cet employé n’était plus là ce jour-là')
  }

  const docs = await Attendance.find({ date, employee: { $in: rows.map((r) => r.employeeId) } }).lean()
  const existing = new Map(
    docs.map(storedOf).filter((r): r is NonNullable<typeof r> => r !== null).map((r) => [r.employeeId, r])
  )

  const validated = markerDoc !== null
  const { ops } = planWrite({
    date,
    validated,
    now,
    by: who.email,
    rows,
    live: inRoster,
    required: cells.filter((c) => c.cell.status === 'travail').map((c) => c.employeeId),
    existing,
  })
  // Chaque ligne s'écrit seule et optimiste ; `changed` compte ce qui a vraiment changé après les éventuels conflits.
  const ctx: RowContext = { date, who, now, rows: new Map(rows.map((r) => [r.employeeId, r])), live: inRoster }
  const wrote = await Promise.all(ops.map((op) => commitRow(op, ctx)))

  let before = markerOf(markerDoc)
  if (!validated) {
    try {
      // `returnDocument: 'before'` : null veut dire que ce passage a créé le marqueur.
      const prior = (await AttendanceDay.findOneAndUpdate(
        { date },
        { $setOnInsert: { date, validatedBy: { user: who._id, name: who.email }, validatedAt: now } },
        { upsert: true, returnDocument: 'before' }
      ).lean()) as MarkerDoc
      before = markerOf(prior)
    } catch (e) {
      // Deux validations au même instant : l'autre a gagné l'index unique.
      if ((e as { code?: number })?.code !== 11000) throw e
      before = markerOf((await AttendanceDay.findOne({ date }).lean()) as MarkerDoc)
    }
  }
  const outcome = markerOutcome(before, { by: who.email, at: now })

  return {
    ok: true,
    date,
    validatedBy: outcome.validatedBy,
    validatedAt: outcome.validatedAt.toISOString(),
    alreadyValidated: outcome.alreadyValidated,
    changed: wrote.filter(Boolean).length,
    day: await loadDay(date, now, who.role),
  }
}

// ── A4 : la synthèse ─────────────────────────────────────────────────────────

export async function loadSummary(from: string, to: string, today: string, employeeId: string | null) {
  await connectDB()
  if (employeeId !== null && !mongoose.isValidObjectId(employeeId)) throw new AttendanceError('not_found', 'Employé introuvable', 404)
  const range = { $gte: from, $lte: to }
  const [marks, docs, inputs] = await Promise.all([
    AttendanceDay.find({ date: range }).select('date').lean() as Promise<{ date: string }[]>,
    Attendance.find({ date: range, ...(employeeId ? { employee: employeeId } : {}) }).lean(),
    readPlanningInputs({ from, to }, employeeId ? { employeeIds: [employeeId] } : { includeLeft: true }),
  ])
  if (employeeId && inputs.employees.length === 0) throw new AttendanceError('not_found', 'Employé introuvable', 404)

  const validatedDates = new Set(marks.map((m) => m.date))
  const stored = docs.map(storedOf).filter((r): r is NonNullable<typeof r> => r !== null)
  const records: SummaryRecord[] = stored.map((r) => ({
    employeeId: r.employeeId,
    date: r.date,
    status: r.status,
    justification: r.justification,
    plannedMinutes: plannedMinutesOf(r.planned),
    workedMinutes: r.workedMinutes,
    lateMinutes: r.lateMinutes,
    earlyMinutes: r.earlyMinutes,
    extraMinutes: r.extraMinutes,
    unplanned: r.unplanned,
  }))

  // Les jours passés où le planning met l'employé au travail : ceux qui ne sont
  // pas validés disent que ses heures sont incomplètes.
  const days = daysBetween(from, to).filter((d) => d <= today)
  const employees: SummaryEmployee[] = inputs.employees.map((e) => {
    const leftDay = e.leftAt ? dayOf(e.leftAt, DEFAULT_TIME_ZONE) : null
    const plannedDates = days.filter(
      (d) => (e.isActive || leftDay === null || d <= leftDay) && resolveCell(e.schedule, inputs.exceptions.get(`${e._id}:${d}`), d).status === 'travail'
    )
    return { employeeId: e._id, name: e.name, active: e.isActive, plannedDates }
  })

  // Une ligne d'un employé qui n'est plus dans l'effectif (désactivé sans date de départ) compte quand même.
  const listed = new Set(employees.map((e) => e.employeeId))
  const strays = [...new Set(records.map((r) => r.employeeId))].filter((id) => !listed.has(id))
  if (strays.length) {
    const found = (await Employee.find({ _id: { $in: strays } })
      .select('name isActive')
      .lean()) as { _id: unknown; name: string; isActive?: boolean }[]
    for (const e of found) employees.push({ employeeId: String(e._id), name: e.name, active: e.isActive !== false, plannedDates: [] })
  }
  employees.sort((a, b) => a.name.localeCompare(b.name, 'fr'))

  return summaryBody(from, to, summarize({ validatedDates, records, employees, withDays: employeeId !== null }))
}
