import {
  editWindow,
  plannedMinutesOf,
  sortShifts,
  snapshotOf,
  type CreatedEntry,
  type Entry,
  type HistoryEntry,
  type PlannedSnapshot,
  type PlannedStatus,
  type StoredAttendance,
  type SummaryLine,
  type SummaryTotals,
} from './attendance'
import {
  attendanceDeadlineAt,
  attendanceDeadlinePassed,
  type AttendanceDeadline,
} from './attendanceDeadline'
import type { PlanningCell, Shift } from './planning'

/**
 * Le pointage vu par l'app du gérant — pur, ni Mongo ni serveur.
 *
 * Une liste blanche : chaque champ rendu est nommé ici. Un document `Attendance`
 * ou un employé ne part jamais tel quel, parce qu'ils portent (ou porteront)
 * d'autres champs — téléphone, CIN, note du planning, motif d'une maladie,
 * identifiants. `storedOf` lit un document en ne retenant que ce qui est connu,
 * et les `*Body` ne construisent que les champs du contrat.
 */

const str = (v: unknown) => (typeof v === 'string' ? v : '')
const int = (v: unknown) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.round(Number(v)) : 0)
const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString() : null)
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

const PLANNED_STATUSES: PlannedStatus[] = ['travail', 'repos', 'conge', 'absence', 'none']

function shiftsFrom(raw: unknown): Shift[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(isObj).map((s) => ({ from: str(s.from), to: str(s.to) }))
}

function entryFrom(raw: unknown): Entry | null {
  if (!isObj(raw) || (raw.status !== 'present' && raw.status !== 'absent')) return null
  const justification = raw.justification === 'justifiee' || raw.justification === 'non_justifiee' ? raw.justification : null
  return { status: raw.status, justification, shifts: shiftsFrom(raw.shifts), note: str(raw.note) }
}

function plannedFrom(raw: unknown): PlannedSnapshot {
  const p = isObj(raw) ? raw : {}
  const status = PLANNED_STATUSES.includes(p.status as PlannedStatus) ? (p.status as PlannedStatus) : 'none'
  const source = p.source === 'semaine' || p.source === 'exception' ? p.source : 'none'
  return { status, shifts: shiftsFrom(p.shifts), source }
}

/** Un document `Attendance` (lean) en ligne connue, ou null s'il n'en est pas une. */
export function storedOf(raw: unknown): StoredAttendance | null {
  if (!isObj(raw)) return null
  const entry = entryFrom(raw)
  if (!entry) return null
  const history: HistoryEntry[] = []
  for (const h of Array.isArray(raw.history) ? raw.history : []) {
    if (!isObj(h)) continue
    const after = entryFrom(h.after)
    if (!after) continue
    history.push({ at: new Date(h.at as Date), by: str(h.by), before: entryFrom(h.before), after })
  }
  // Épinglé à la création. Une ligne plus ancienne sans ce champ : sa première entrée, si elle y est encore.
  let created: CreatedEntry | null = null
  if (isObj(raw.created)) {
    const after = entryFrom(raw.created.after)
    if (after) created = { at: new Date(raw.created.at as Date), by: str(raw.created.by), after }
  } else if (history.length && history[0].before === null && int(raw.historyDropped) === 0) {
    created = { at: history[0].at, by: history[0].by, after: history[0].after }
  }
  const by = isObj(raw.updatedBy) ? str(raw.updatedBy.name) : ''
  return {
    employeeId: String(raw.employee),
    date: str(raw.date),
    ...entry,
    unplanned: raw.unplanned === true,
    lateMinutes: int(raw.lateMinutes),
    earlyMinutes: int(raw.earlyMinutes),
    extraMinutes: int(raw.extraMinutes),
    workedMinutes: int(raw.workedMinutes),
    planned: plannedFrom(raw.planned),
    updatedBy: by,
    updatedAt: raw.updatedAt ? new Date(raw.updatedAt as Date) : null,
    history,
    historyDropped: int(raw.historyDropped),
    created,
  }
}

// ── A2 : un jour ─────────────────────────────────────────────────────────────

export interface Person {
  name: string
  poste: string
  active: boolean
}

export interface RosterEntry extends Person {
  employeeId: string
  /** Ce que le planning d'aujourd'hui dit de lui ce jour-là. */
  cell: PlanningCell
}

export interface Marker {
  validatedBy: string
  validatedAt: Date
}

const shiftOut = (shifts: Shift[]) => sortShifts(shifts).map(({ from, to }) => ({ from, to }))

const entryOut = (e: Entry) => ({
  status: e.status,
  justification: e.justification,
  shifts: shiftOut(e.shifts),
  note: e.note,
})

const plannedOut = (p: PlannedSnapshot) => ({ status: p.status, shifts: shiftOut(p.shifts), source: p.source })

function rowOf(employeeId: string, person: Person, planned: PlannedSnapshot, rec: StoredAttendance | null) {
  return {
    employeeId,
    name: person.name,
    poste: person.poste,
    active: person.active,
    planned: plannedOut(planned),
    plannedMinutes: plannedMinutesOf(planned),
    recorded: rec !== null,
    status: rec ? rec.status : null,
    justification: rec ? rec.justification : null,
    shifts: rec ? shiftOut(rec.shifts) : [],
    unplanned: rec ? rec.unplanned : false,
    lateMinutes: rec ? rec.lateMinutes : 0,
    earlyMinutes: rec ? rec.earlyMinutes : 0,
    extraMinutes: rec ? rec.extraMinutes : 0,
    workedMinutes: rec ? rec.workedMinutes : 0,
    note: rec ? rec.note : '',
    updatedBy: rec ? rec.updatedBy : null,
    updatedAt: rec ? iso(rec.updatedAt) : null,
    history: rec
      ? rec.history.map((h) => ({
          at: iso(h.at),
          by: h.by,
          before: h.before ? entryOut(h.before) : null,
          after: entryOut(h.after),
        }))
      : [],
    created: rec && rec.created ? { at: iso(rec.created.at), by: rec.created.by, after: entryOut(rec.created.after) } : null,
    historyDropped: rec ? rec.historyDropped : 0,
  }
}

export type AttendanceRow = ReturnType<typeof rowOf>

export interface DayInput {
  date: string
  now: Date
  role: string
  /** Le marqueur du jour, s'il est validé. */
  marker: Marker | null
  /** Les employés du jour (actifs, et partis ce jour-là ou après) avec le planning d'aujourd'hui. */
  roster: RosterEntry[]
  records: StoredAttendance[]
  /** Les employés ayant une ligne mais absents de `roster` (partis depuis, ou désactivés). */
  people: Map<string, Person>
}

/**
 * Le corps de A2. Les lignes sont les employés planifiés `travail` ce jour-là
 * plus tous ceux qui ont déjà une ligne ; un employé qui a une ligne est lu dans
 * sa photo, un autre dans le planning du moment. `others` : les actifs qui ne
 * sont pas dans les lignes. Les totaux ne comptent que les lignes saisies,
 * sauf `plannedMinutes` qui compte toutes les lignes.
 */
export function dayBody(input: DayInput) {
  const { date, now, role, marker, roster, records, people } = input
  const win = editWindow(date, now, role)
  const byId = new Map(records.map((r) => [r.employeeId, r]))
  const rosterById = new Map(roster.map((r) => [r.employeeId, r]))

  const ids = new Set<string>(records.map((r) => r.employeeId))
  for (const r of roster) if (r.cell.status === 'travail') ids.add(r.employeeId)

  const rows: AttendanceRow[] = []
  for (const id of ids) {
    const rec = byId.get(id) ?? null
    const live = rosterById.get(id)
    const person = live ?? people.get(id)
    if (!person) continue
    const planned = rec ? rec.planned : snapshotOf((live as RosterEntry).cell)
    rows.push(rowOf(id, { name: person.name, poste: person.poste, active: person.active }, planned, rec))
  }
  rows.sort((a, b) => a.name.localeCompare(b.name, 'fr') || a.employeeId.localeCompare(b.employeeId))

  const others = roster
    .filter((r) => r.active && !ids.has(r.employeeId))
    .map((r) => ({ employeeId: r.employeeId, name: r.name, poste: r.poste, plannedStatus: snapshotOf(r.cell).status }))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'))

  const totals = {
    plannedMinutes: 0,
    workedMinutes: 0,
    lateCount: 0,
    lateMinutes: 0,
    earlyMinutes: 0,
    extraMinutes: 0,
    absentJustified: 0,
    absentUnjustified: 0,
  }
  for (const r of rows) {
    totals.plannedMinutes += r.plannedMinutes
    if (!r.recorded) continue
    totals.workedMinutes += r.workedMinutes
    if (r.lateMinutes > 0) totals.lateCount++
    totals.lateMinutes += r.lateMinutes
    totals.earlyMinutes += r.earlyMinutes
    totals.extraMinutes += r.extraMinutes
    if (r.status === 'absent') {
      if (r.justification === 'justifiee') totals.absentJustified++
      else totals.absentUnjustified++
    }
  }

  return {
    date,
    validated: marker !== null,
    validatedBy: marker ? marker.validatedBy : null,
    validatedAt: marker ? iso(marker.validatedAt) : null,
    canEdit: win.canEdit,
    editableUntil: win.editableUntil.toISOString(),
    rows,
    others,
    totals,
  }
}

// ── A1 : l'état des derniers jours ───────────────────────────────────────────

export function statusBody(input: {
  tz: string
  now: Date
  role: string
  deadline: AttendanceDeadline
  days: { date: string; plannedCount: number; marker: Marker | null }[]
}) {
  const { tz, now, role, deadline, days } = input
  return {
    tz,
    deadline: { afterDays: deadline.afterDays, time: deadline.time },
    days: days.map((d) => {
      const at = attendanceDeadlineAt(d.date, deadline, tz)
      return {
        date: d.date,
        plannedCount: d.plannedCount,
        validated: d.marker !== null,
        validatedBy: d.marker ? d.marker.validatedBy : null,
        validatedAt: d.marker ? iso(d.marker.validatedAt) : null,
        deadlineAt: at.toISOString(),
        deadlinePassed: attendanceDeadlinePassed(at, now),
        editableUntil: editWindow(d.date, now, role, tz).editableUntil.toISOString(),
      }
    }),
  }
}

// ── A4 : la synthèse ─────────────────────────────────────────────────────────

const totalsOut = (t: SummaryTotals): SummaryTotals => ({
  plannedMinutes: t.plannedMinutes,
  workedMinutes: t.workedMinutes,
  daysPresent: t.daysPresent,
  lateCount: t.lateCount,
  lateMinutes: t.lateMinutes,
  earlyMinutes: t.earlyMinutes,
  extraMinutes: t.extraMinutes,
  absentJustified: t.absentJustified,
  absentUnjustified: t.absentUnjustified,
  validatedDays: t.validatedDays,
  unvalidatedDays: t.unvalidatedDays,
})

export function summaryBody(from: string, to: string, summary: { employees: SummaryLine[]; totals: SummaryTotals }) {
  return {
    from,
    to,
    employees: summary.employees.map((e) => ({
      employeeId: e.employeeId,
      name: e.name,
      active: e.active,
      ...totalsOut(e),
      ...(e.days
        ? {
            days: e.days.map((d) => ({
              date: d.date,
              status: d.status,
              justification: d.justification,
              plannedMinutes: d.plannedMinutes,
              workedMinutes: d.workedMinutes,
              lateMinutes: d.lateMinutes,
              earlyMinutes: d.earlyMinutes,
              extraMinutes: d.extraMinutes,
              unplanned: d.unplanned,
            })),
          }
        : {}),
    })),
    totals: totalsOut(summary.totals),
  }
}
