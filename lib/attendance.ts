import { MAX_SHIFTS_PER_DAY, PlanningError, cleanShifts, shiftMinutes, type PlanningCell, type Shift } from './planning'
import { DEFAULT_TIME_ZONE, addDays, dayOf, startOfDay } from './reportTime'

/**
 * Le pointage du personnel — qui est venu un jour de service, à quelles heures,
 * et ce que cela change par rapport au planning.
 *
 * Pur : ni Mongo ni serveur ni horloge propre (`now` est passé). La route, la
 * couche base (lib/attendanceData) et scripts/check-attendance lisent tous les
 * mêmes règles. Toutes les durées sont des minutes entières, jamais des heures.
 *
 * Le planning (PlanningDay, Employee.schedule) n'est jamais écrit d'ici : on
 * ne le lit que pour en prendre une photo (`snapshotOf`).
 */

// ── Constantes ───────────────────────────────────────────────────────────────

/** Une modification sur 20 seulement reste dans l'historique d'une ligne. */
export const HISTORY_CAP = 20
/** Lignes au plus dans une validation. */
export const MAX_ROWS = 100
export const NOTE_MAX = 200
/** Un gérant écrit jusqu'au début du jour de service + 3 jours (Tunis). */
export const WINDOW_DAYS = 3
/** Une synthèse porte sur 92 jours au plus, bornes comprises. */
export const SUMMARY_MAX_DAYS = 92

export class AttendanceError extends Error {
  status: number
  /** Raison lisible par la machine : `window_closed`, `missing_rows`... Le message est pour les gens. */
  code: string
  /** Données jointes à l'erreur (les `employeeIds` d'un `missing_rows`). */
  extra: Record<string, unknown>
  constructor(code: string, message: string, status = 400, extra: Record<string, unknown> = {}) {
    super(message)
    this.status = status
    this.code = code
    this.extra = extra
  }
}

// ── Types ────────────────────────────────────────────────────────────────────

export type PlannedStatus = 'travail' | 'repos' | 'conge' | 'absence' | 'none'
export type AttendanceStatus = 'present' | 'absent'
export type Justification = 'justifiee' | 'non_justifiee'

/** Ce que le planning disait ce jour-là. Ni la note du planning, ni le motif d'une maladie. */
export interface PlannedSnapshot {
  status: PlannedStatus
  shifts: Shift[]
  source: 'semaine' | 'exception' | 'none'
}

/** Les quatre champs que le gérant saisit — et les seuls que l'historique garde. */
export interface Entry {
  status: AttendanceStatus
  justification: Justification | null
  shifts: Shift[]
  note: string
}

export interface Figures {
  unplanned: boolean
  lateMinutes: number
  earlyMinutes: number
  extraMinutes: number
  workedMinutes: number
}

export interface HistoryEntry {
  at: Date
  by: string
  before: Entry | null
  after: Entry
}

/** Qui a créé la ligne, épinglé hors de l'historique : le plafond de 20 ne le fait jamais sortir. */
export interface CreatedEntry {
  at: Date
  by: string
  after: Entry
}

export interface StoredAttendance extends Entry, Figures {
  employeeId: string
  date: string
  planned: PlannedSnapshot
  updatedBy: string
  updatedAt: Date | null
  history: HistoryEntry[]
  historyDropped: number
  created: CreatedEntry | null
}

// ── Les dates ────────────────────────────────────────────────────────────────

/** Un jour AAAA-MM-JJ du vrai calendrier (le 30 février n'en est pas un). */
export const isRealDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && addDays(v, 0) === v

/** Les jours que couvre A1 : avant-hier, hier, aujourd'hui. */
export const statusDates = (today: string) => [addDays(today, -2), addDays(today, -1), today]

/** Les jours que l'alerte surveille : avant-hier et hier, pas aujourd'hui. */
export const alertDates = (today: string) => [addDays(today, -2), addDays(today, -1)]

// ── Minutes et créneaux ──────────────────────────────────────────────────────

const DAY_MIN = 24 * 60
const HALF_DAY = DAY_MIN / 2

/** « 18:30 » -> 1110. */
export const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))

/** Un écart d'horloge ramené dans [-12 h, +12 h) : 23:55 -> 00:00 fait +5 min, pas -1435. */
export const wrapDelta = (d: number) => ((((d + HALF_DAY) % DAY_MIN) + DAY_MIN) % DAY_MIN) - HALF_DAY

/** Les créneaux dans l'ordre de leur début. */
export const sortShifts = (shifts: Shift[]): Shift[] =>
  shifts.map(({ from, to }) => ({ from, to })).sort((a, b) => toMinutes(a.from) - toMinutes(b.from))

const totalMinutes = (shifts: Shift[]) => shifts.reduce((sum, s) => sum + shiftMinutes(s), 0)

/** Les minutes prévues par une photo du planning : zéro si ce n'est pas un jour de travail. */
export const plannedMinutesOf = (p: PlannedSnapshot) => (p.status === 'travail' ? totalMinutes(p.shifts) : 0)

/**
 * Ce que le planning disait, en photo : statut, créneaux, provenance. La
 * maladie devient `absence` (le motif médical ne se copie jamais) et la note du
 * planning n'est pas recopiée.
 */
export function snapshotOf(cell: PlanningCell): PlannedSnapshot {
  const status: PlannedStatus = cell.status === 'maladie' ? 'absence' : cell.status
  return {
    status,
    shifts: status === 'travail' ? sortShifts(cell.shifts) : [],
    source: cell.source,
  }
}

/**
 * Apparie chaque créneau réel au créneau prévu qu'il recouvre le plus. La frise
 * est circulaire : le créneau réel se pose à 0 ou +24 h, là où il
 * recouvre le plus, pour qu'un 00:30-03:00 réel retrouve un 23:00-03:00 prévu
 * (comme `figures()` de l'app). Sans recouvrement (0 minute), pas
 * d'appariement. À recouvrement égal, le début le plus proche gagne (écart
 * circulaire). Un prévu sert au plus une fois. Rend des couples [indice prévu, indice réel].
 */
function pairShifts(plan: Shift[], real: Shift[]): [number, number][] {
  const span = (s: Shift): [number, number] => [toMinutes(s.from), toMinutes(s.from) + shiftMinutes(s)]
  const cands: { j: number; i: number; ov: number; dist: number }[] = []
  plan.forEach((p, j) => {
    const [ps, pe] = span(p)
    real.forEach((r, i) => {
      const [rs, re] = span(r)
      const ov = Math.max(0, ...[0, DAY_MIN].map((o) => Math.min(pe, re + o) - Math.max(ps, rs + o)))
      if (ov > 0) cands.push({ j, i, ov, dist: Math.abs(wrapDelta(rs - ps)) })
    })
  })
  cands.sort((a, b) => b.ov - a.ov || a.dist - b.dist || a.j - b.j || a.i - b.i)
  const usedPlan = new Set<number>()
  const usedReal = new Set<number>()
  const out: [number, number][] = []
  for (const c of cands) {
    if (usedPlan.has(c.j) || usedReal.has(c.i)) continue
    usedPlan.add(c.j)
    usedReal.add(c.i)
    out.push([c.j, c.i])
  }
  return out
}

/**
 * Retards, départs anticipés et heures en plus d'un jour de présence.
 *
 * Chaque créneau réel est apparié au créneau prévu qu'il recouvre le plus (voir
 * `pairShifts`), un prévu au plus une fois.
 * Pour un couple, début et fin se comparent sur l'horloge de 24 h (écart ramené
 * dans [-12 h, +12 h)) : arriver plus tard est un retard, plus tôt des heures en
 * plus ; finir plus tôt est un départ anticipé, plus tard des heures en plus.
 * Un créneau réel sans prévu compte en entier en heures en plus, un prévu sans
 * réel en entier en départ anticipé. Absent : tout à zéro. Présent un jour qui
 * n'est pas planifié `travail` : `unplanned`, tout est en heures en plus.
 *
 * Pour un jour dont tous les créneaux sont appariés :
 * travaillé = prévu - retard - départ anticipé + heures en plus.
 */
export function figuresOf(status: AttendanceStatus, planned: PlannedSnapshot, shifts: Shift[]): Figures {
  const zero: Figures = { unplanned: false, lateMinutes: 0, earlyMinutes: 0, extraMinutes: 0, workedMinutes: 0 }
  if (status === 'absent') return zero

  const real = sortShifts(shifts)
  const worked = totalMinutes(real)
  if (planned.status !== 'travail') return { ...zero, unplanned: true, extraMinutes: worked, workedMinutes: worked }

  const plan = sortShifts(planned.shifts)
  let late = 0
  let early = 0
  let extra = 0
  const pairs = pairShifts(plan, real)
  const planUsed = new Set(pairs.map(([j]) => j))
  const realUsed = new Set(pairs.map(([, i]) => i))
  for (const [j, i] of pairs) {
    const p = plan[j]
    const r = real[i]
    const start = wrapDelta(toMinutes(r.from) - toMinutes(p.from))
    const end = wrapDelta(toMinutes(r.to) - toMinutes(p.to))
    late += Math.max(0, start)
    extra += Math.max(0, -start)
    early += Math.max(0, -end)
    extra += Math.max(0, end)
  }
  real.forEach((r, i) => {
    if (!realUsed.has(i)) extra += shiftMinutes(r)
  })
  plan.forEach((p, j) => {
    if (!planUsed.has(j)) early += shiftMinutes(p)
  })
  return { unplanned: false, lateMinutes: late, earlyMinutes: early, extraMinutes: extra, workedMinutes: worked }
}

/** Deux créneaux (triés) se chevauchent-ils ? Un créneau qui en touche un autre n'est pas en conflit. */
function overlap(sorted: Shift[]): boolean {
  for (let i = 1; i < sorted.length; i++) {
    if (toMinutes(sorted[i].from) < toMinutes(sorted[i - 1].from) + shiftMinutes(sorted[i - 1])) return true
  }
  return false
}

/**
 * Les créneaux réels saisis : 2 au plus, HH:mm, une durée, sans chevauchement.
 * `invalid_shifts` ou `shifts_overlap` sinon. Rendus dans l'ordre du jour.
 */
export function cleanRealShifts(input: unknown): Shift[] {
  let shifts: Shift[]
  try {
    shifts = cleanShifts(input)
  } catch (e) {
    if (e instanceof PlanningError) throw new AttendanceError('invalid_shifts', e.message)
    throw e
  }
  if (shifts.length > MAX_SHIFTS_PER_DAY) throw new AttendanceError('invalid_shifts', 'Deux créneaux par jour au plus')
  const sorted = sortShifts(shifts)
  if (overlap(sorted)) throw new AttendanceError('shifts_overlap', 'Les créneaux se chevauchent')
  return sorted
}

// ── La fenêtre de saisie ─────────────────────────────────────────────────────

export interface EditWindow {
  /** Le jour est après aujourd'hui (Tunis) : personne n'y écrit. */
  future: boolean
  /** Début du jour de service + 3 jours, Tunis : le dernier instant d'un gérant est juste avant. */
  editableUntil: Date
  canEdit: boolean
}

/**
 * Qui peut écrire un jour, avec l'horloge du serveur : un gérant avant
 * `startOfDay(D + 3)` (48 h après la fin du jour de service), un admin toujours.
 * Un jour futur est refusé pour tous ; aujourd'hui est permis.
 */
export function editWindow(date: string, now: Date, role: string, tz = DEFAULT_TIME_ZONE): EditWindow {
  const future = date > dayOf(now, tz)
  const editableUntil = startOfDay(addDays(date, WINDOW_DAYS), tz)
  const open = role === 'admin' || now.getTime() < editableUntil.getTime()
  return { future, editableUntil, canEdit: !future && open }
}

/** `future_day` (400) ou `window_closed` (403) si on n'a pas le droit d'écrire ce jour. */
export function assertWritable(date: string, now: Date, role: string) {
  const w = editWindow(date, now, role)
  if (w.future) throw new AttendanceError('future_day', 'Ce jour n’a pas encore eu lieu')
  if (!w.canEdit) throw new AttendanceError('window_closed', 'Ce pointage n’est plus modifiable par un gérant', 403)
}

// ── Le corps d'une validation ────────────────────────────────────────────────

export interface RowInput {
  employeeId: string
  status: AttendanceStatus
  asPlanned: boolean
  justification: Justification | null
  /** Les créneaux réels saisis ; vides : ceux du planning (`asPlanned`, ou rien de saisi). */
  shifts: Shift[]
  note: string
}

const HEX_ID = /^[a-f0-9]{24}$/i
const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

/** Le jour d'un corps : AAAA-MM-JJ réel, sinon 400 bad_request. */
export function cleanDate(raw: unknown): string {
  if (!isRealDay(raw)) throw new AttendanceError('bad_request', 'date invalide : AAAA-MM-JJ')
  return raw
}

/**
 * Les lignes d'un corps, réduites à ce que le serveur accepte : l'employé, le
 * statut, `asPlanned`, la justification, les créneaux et la note. Tout le reste
 * (minutes, `unplanned`, auteur, historique, photo du planning) est ignoré sans
 * même être lu.
 */
export function cleanRows(raw: unknown): RowInput[] {
  if (!Array.isArray(raw)) throw new AttendanceError('bad_request', 'rows : une liste est attendue')
  if (raw.length > MAX_ROWS) throw new AttendanceError('bad_request', `${MAX_ROWS} lignes au plus`)
  const seen = new Set<string>()
  return raw.map((item) => {
    if (!isObject(item)) throw new AttendanceError('bad_request', 'ligne invalide')
    if (typeof item.employeeId !== 'string' || !item.employeeId) throw new AttendanceError('bad_request', 'employeeId requis')
    if (!HEX_ID.test(item.employeeId)) throw new AttendanceError('not_found', 'Employé introuvable', 404)
    const employeeId = item.employeeId.toLowerCase()
    if (seen.has(employeeId)) throw new AttendanceError('bad_request', 'Un employé ne peut figurer qu’une fois')
    seen.add(employeeId)

    if (item.status !== 'present' && item.status !== 'absent') throw new AttendanceError('bad_request', 'status : present ou absent')
    const status: AttendanceStatus = item.status

    let justification: Justification | null = null
    if (item.justification !== undefined && item.justification !== null) {
      if (item.justification !== 'justifiee' && item.justification !== 'non_justifiee') {
        throw new AttendanceError('bad_request', 'justification : justifiee ou non_justifiee')
      }
      justification = item.justification
    }

    let note = ''
    if (item.note !== undefined && item.note !== null) {
      if (typeof item.note !== 'string') throw new AttendanceError('bad_request', 'note invalide')
      note = item.note.trim()
      if (note.length > NOTE_MAX) throw new AttendanceError('bad_request', `Note : ${NOTE_MAX} caractères au plus`)
    }

    const asPlanned = item.asPlanned === true
    // Les créneaux ne servent qu'à un présent qui les saisit ; pour un absent ou
    // un « comme prévu » ils sont ignorés, pas contrôlés.
    const shifts = status === 'present' && !asPlanned ? cleanRealShifts(item.shifts) : []
    return { employeeId, status, asPlanned, justification, shifts, note }
  })
}

// ── Le plan d'écriture ───────────────────────────────────────────────────────

export const entryOf = (e: Entry): Entry => ({
  status: e.status,
  justification: e.justification,
  shifts: sortShifts(e.shifts),
  note: e.note,
})

export function sameEntry(a: Entry, b: Entry): boolean {
  if (a.status !== b.status || a.justification !== b.justification || a.note !== b.note) return false
  const x = sortShifts(a.shifts)
  const y = sortShifts(b.shifts)
  return x.length === y.length && x.every((s, i) => s.from === y[i].from && s.to === y[i].to)
}

/** Ce que l'écriture d'une ligne fait sur la base, sans rien de Mongo dedans. */
export interface RowOp {
  employeeId: string
  /** `insert` : la ligne n'existait pas. `update` : une saisie a changé. `refresh` : rien n'a changé, mais le jour n'est pas validé et le planning peut avoir bougé. */
  kind: 'insert' | 'update' | 'refresh'
  changed: boolean
  /** Les champs à poser. `planned` y est seulement tant que le jour n'est pas validé (ou pour une ligne neuve). */
  set: Entry & Figures & { planned?: PlannedSnapshot; updatedAt?: Date; updatedBy?: string }
  /** À ajouter à l'historique, seulement si une saisie a changé. */
  entry: HistoryEntry | null
  /** Combien de lignes d'historique ce push fait sortir (`$slice`), à ajouter à `historyDropped`. */
  droppedInc: number
  /** `updatedAt` de la ligne lue : l'écriture n'a lieu que si la base le porte encore (null pour une insertion). */
  prevUpdatedAt: Date | null
  /** À l'insertion : qui crée la ligne, épinglé hors de l'historique. */
  created: CreatedEntry | null
}

export interface PlanInput {
  date: string
  /** Le marqueur du jour existe déjà, avant cette écriture. */
  validated: boolean
  now: Date
  /** L'e-mail du compte, relu en base. */
  by: string
  rows: RowInput[]
  /** Ce que le planning dit aujourd'hui pour chaque employé des lignes. */
  live: Map<string, PlanningCell>
  /** Les employés planifiés `travail` ce jour-là, dans le planning d'aujourd'hui. */
  required: string[]
  existing: Map<string, StoredAttendance>
  /** Faux pour relire une seule ligne après un conflit : les autres ne sont pas à refaire. Vrai par défaut. */
  checkMissing?: boolean
}

/** L'historique après un ajout : les 20 dernières entrées, et combien sont sorties en tout. */
export function pushHistory(history: HistoryEntry[], dropped: number, entry: HistoryEntry, cap = HISTORY_CAP) {
  const all = [...history, entry]
  const out = Math.max(0, all.length - cap)
  return { history: all.slice(out), historyDropped: dropped + out }
}

/**
 * Le plan d'une écriture de jour : pour chaque ligne, ce qu'il faut poser. Les
 * minutes sont recalculées ici, jamais lues du corps.
 *
 * - Première validation (`validated` faux) : une ligne par employé planifié
 *   `travail`, sinon `missing_rows`. Chaque écriture rafraîchit la photo du
 *   planning.
 * - Jour validé : la photo d'une ligne existante est figée (on recalcule contre
 *   elle) ; on peut n'envoyer que les lignes qui changent ; une ligne neuve
 *   prend la photo du planning d'aujourd'hui.
 * - Une ligne identique à l'existante n'ajoute rien à l'historique.
 */
export function planWrite(input: PlanInput): { ops: RowOp[]; changed: number } {
  const { validated, now, by, rows, live, required, existing } = input

  if (!validated && input.checkMissing !== false) {
    const sent = new Set(rows.map((r) => r.employeeId))
    const missing = required.filter((id) => !sent.has(id))
    if (missing.length) throw new AttendanceError('missing_rows', 'Il manque des employés planifiés ce jour-là', 400, { employeeIds: missing })
  }

  const ops: RowOp[] = []
  for (const row of rows) {
    const before = existing.get(row.employeeId) ?? null
    const frozen = validated && before !== null
    const planned = frozen ? before.planned : snapshotOf(live.get(row.employeeId) ?? { status: 'none', shifts: [], hours: 0, source: 'none', note: '' })

    if (row.status === 'absent' && planned.status !== 'travail') {
      throw new AttendanceError('absent_not_planned', 'Absent un jour où il n’était pas planifié')
    }
    const shifts = row.status === 'absent' ? [] : row.shifts.length ? row.shifts : planned.status === 'travail' ? planned.shifts : []
    if (row.status === 'present' && shifts.length === 0) {
      throw new AttendanceError('shifts_required', 'Les horaires réels sont requis ce jour-là')
    }

    const after: Entry = entryOf({
      status: row.status,
      justification: row.status === 'absent' ? (row.justification ?? 'non_justifiee') : null,
      shifts,
      note: row.note,
    })
    const figures = figuresOf(after.status, planned, after.shifts)
    const changed = before === null || !sameEntry(before, after)

    if (!changed && frozen) continue

    const entry: HistoryEntry | null = changed ? { at: now, by, before: before ? entryOf(before) : null, after } : null
    ops.push({
      employeeId: row.employeeId,
      kind: before === null ? 'insert' : changed ? 'update' : 'refresh',
      changed,
      set: {
        ...after,
        ...figures,
        ...(frozen ? {} : { planned }),
        ...(changed ? { updatedAt: now, updatedBy: by } : {}),
      },
      entry,
      droppedInc: changed && before ? Math.max(0, before.history.length + 1 - HISTORY_CAP) : 0,
      prevUpdatedAt: before ? before.updatedAt : null,
      created: before === null ? { at: now, by, after } : null,
    })
  }
  return { ops, changed: ops.filter((o) => o.changed).length }
}

/** Le marqueur du jour après une tentative : le premier qui valide reste celui qu'on lit. */
export function markerOutcome(
  before: { validatedBy: string; validatedAt: Date } | null,
  attempt: { by: string; at: Date }
): { validatedBy: string; validatedAt: Date; alreadyValidated: boolean } {
  return before
    ? { validatedBy: before.validatedBy, validatedAt: before.validatedAt, alreadyValidated: true }
    : { validatedBy: attempt.by, validatedAt: attempt.at, alreadyValidated: false }
}

// ── La synthèse ──────────────────────────────────────────────────────────────

/** De `from` à `to` (AAAA-MM-JJ), 92 jours au plus bornes comprises : `bad_request` ou `range_too_long`. */
export function parseSummaryRange(from: unknown, to: unknown): { from: string; to: string } {
  if (!isRealDay(from) || !isRealDay(to) || from > to) throw new AttendanceError('bad_request', 'from et to : AAAA-MM-JJ, from avant to')
  const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000 + 1
  if (days > SUMMARY_MAX_DAYS) throw new AttendanceError('range_too_long', `${SUMMARY_MAX_DAYS} jours au plus`)
  return { from, to }
}

export interface SummaryRecord {
  employeeId: string
  date: string
  status: AttendanceStatus
  justification: Justification | null
  plannedMinutes: number
  workedMinutes: number
  lateMinutes: number
  earlyMinutes: number
  extraMinutes: number
  unplanned: boolean
}

export type SummaryDay = Omit<SummaryRecord, 'employeeId'>

export interface SummaryEmployee {
  employeeId: string
  name: string
  active: boolean
  /** Les jours de la période (jusqu'à aujourd'hui) où il est planifié `travail` dans le planning actuel. */
  plannedDates: string[]
}

export interface SummaryTotals {
  plannedMinutes: number
  workedMinutes: number
  daysPresent: number
  lateCount: number
  lateMinutes: number
  earlyMinutes: number
  extraMinutes: number
  absentJustified: number
  absentUnjustified: number
  validatedDays: number
  unvalidatedDays: number
}

export interface SummaryLine extends SummaryTotals {
  employeeId: string
  name: string
  active: boolean
  days?: SummaryDay[]
}

const emptyTotals = (): SummaryTotals => ({
  plannedMinutes: 0,
  workedMinutes: 0,
  daysPresent: 0,
  lateCount: 0,
  lateMinutes: 0,
  earlyMinutes: 0,
  extraMinutes: 0,
  absentJustified: 0,
  absentUnjustified: 0,
  validatedDays: 0,
  unvalidatedDays: 0,
})

/**
 * La synthèse d'une période : les jours validés seulement comptent dans les
 * minutes. `validatedDays` : jours validés où l'employé a une ligne ;
 * `unvalidatedDays` : jours non validés où le planning le met au travail — de
 * quoi dire « ces heures sont incomplètes ». `totals` additionne les employés.
 */
export function summarize(input: {
  validatedDates: Set<string>
  records: SummaryRecord[]
  employees: SummaryEmployee[]
  withDays: boolean
}): { employees: SummaryLine[]; totals: SummaryTotals } {
  const totals = emptyTotals()
  const lines: SummaryLine[] = input.employees.map((e) => {
    const line: SummaryLine = { employeeId: e.employeeId, name: e.name, active: e.active, ...emptyTotals() }
    const mine = input.records.filter((r) => r.employeeId === e.employeeId && input.validatedDates.has(r.date)).sort((a, b) => a.date.localeCompare(b.date))
    for (const r of mine) {
      line.validatedDays++
      line.plannedMinutes += r.plannedMinutes
      line.workedMinutes += r.workedMinutes
      if (r.status === 'present') {
        line.daysPresent++
        if (r.lateMinutes > 0) line.lateCount++
        line.lateMinutes += r.lateMinutes
        line.earlyMinutes += r.earlyMinutes
        line.extraMinutes += r.extraMinutes
      } else if (r.justification === 'justifiee') line.absentJustified++
      else line.absentUnjustified++
    }
    line.unvalidatedDays = e.plannedDates.filter((d) => !input.validatedDates.has(d)).length
    if (input.withDays) {
      line.days = mine.map((r) => ({
        date: r.date,
        status: r.status,
        justification: r.justification,
        plannedMinutes: r.plannedMinutes,
        workedMinutes: r.workedMinutes,
        lateMinutes: r.lateMinutes,
        earlyMinutes: r.earlyMinutes,
        extraMinutes: r.extraMinutes,
        unplanned: r.unplanned,
      }))
    }
    for (const k of Object.keys(totals) as (keyof SummaryTotals)[]) totals[k] += line[k]
    return line
  })
  return { employees: lines, totals }
}
