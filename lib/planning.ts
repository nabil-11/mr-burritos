import { addDays } from './reportTime'

/**
 * Le planning du personnel — qui travaille quel jour, et à quelles heures.
 *
 * Deux couches, parce qu'un restaurant vit ainsi :
 *
 *   1. la **semaine type** de chaque employé (`Employee.schedule`) : « du mardi
 *      au dimanche, 11 h – 16 h puis 18 h – 23 h, repos le lundi ». Saisie une
 *      fois, elle se répète toutes les semaines — personne ne ressaisit son
 *      planning le dimanche soir.
 *   2. les **exceptions**, jour par jour (`PlanningDay`) : un congé, un arrêt
 *      maladie, une absence, un repos décalé, des horaires changés ce jour-là,
 *      ou un jour travaillé alors qu'il est normalement de repos.
 *
 * Un jour se lit toujours de la même façon : l'exception si elle existe, sinon
 * la semaine type. Supprimer l'exception rend le jour à la semaine type — on
 * ne « corrige » jamais la semaine type pour un cas particulier.
 *
 * Ce fichier ne connaît ni Mongo ni le serveur : la route, la page du
 * back-office et la caisse lisent toutes le même résultat.
 */

export class PlanningError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

/** Ce qu'un jour peut être. `travail` porte des horaires ; les autres, non. */
export const DAY_KINDS = ['travail', 'repos', 'conge', 'maladie', 'absence'] as const
export type DayKind = (typeof DAY_KINDS)[number]

export const DAY_KIND_LABELS: Record<DayKind, string> = {
  travail: 'Travail',
  repos: 'Repos',
  conge: 'Congé',
  maladie: 'Maladie',
  absence: 'Absence',
}

export const isDayKind = (v: unknown): v is DayKind => (DAY_KINDS as readonly string[]).includes(String(v))

/** Lundi d'abord : la semaine d'un restaurant commence le lundi, comme son planning. */
export const WEEKDAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'] as const

export interface Shift {
  /** « 11:00 » */
  from: string
  /** « 16:00 » — avant `from` quand le service finit après minuit. */
  to: string
}

/** Un créneau de la semaine type. `day` : 0 = lundi … 6 = dimanche. */
export interface WeekSlot extends Shift {
  day: number
}

/** Deux services par jour : le midi et le soir. Au-delà, c'est une faute de frappe. */
export const MAX_SHIFTS_PER_DAY = 2

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/
const isTime = (v: unknown): v is string => typeof v === 'string' && TIME.test(v)

const minutesOf = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))

/** La durée d'un créneau. 18:00 → 01:00 passe minuit : sept heures, pas moins dix-sept. */
export function shiftMinutes(s: Shift): number {
  const d = minutesOf(s.to) - minutesOf(s.from)
  return d > 0 ? d : d + 24 * 60
}

const hoursOf = (shifts: Shift[]) => Math.round((shifts.reduce((sum, s) => sum + shiftMinutes(s), 0) / 60) * 100) / 100

/** Valide des créneaux saisis et les range dans l'ordre de la journée. */
export function cleanShifts(input: unknown): Shift[] {
  if (input == null) return []
  if (!Array.isArray(input)) throw new PlanningError('Horaires invalides')
  if (input.length > MAX_SHIFTS_PER_DAY) throw new PlanningError('Deux créneaux par jour au plus')
  const shifts = input.map((raw) => {
    const s = (raw ?? {}) as Record<string, unknown>
    if (!isTime(s.from) || !isTime(s.to)) throw new PlanningError('Heure invalide — attendu HH:MM')
    if (s.from === s.to) throw new PlanningError('Un créneau doit avoir une durée')
    return { from: s.from, to: s.to }
  })
  return shifts.sort((a, b) => a.from.localeCompare(b.from))
}

/** Valide une semaine type : des créneaux, chacun sur un jour de 0 (lundi) à 6. */
export function cleanSchedule(input: unknown): WeekSlot[] {
  if (!Array.isArray(input)) throw new PlanningError('Semaine type invalide')
  const byDay = new Map<number, unknown[]>()
  for (const raw of input) {
    const day = Number((raw as Record<string, unknown> | null)?.day)
    if (!Number.isInteger(day) || day < 0 || day > 6) throw new PlanningError('Jour invalide')
    byDay.set(day, [...(byDay.get(day) ?? []), raw])
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a - b)
    .flatMap(([day, slots]) => cleanShifts(slots).map((s) => ({ day, ...s })))
}

/** 0 = lundi … 6 = dimanche, pour un jour AAAA-MM-JJ. */
export const weekdayOf = (day: string) => (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7

/** Le lundi de la semaine qui contient ce jour. */
export const mondayOf = (day: string) => addDays(day, -weekdayOf(day))

export interface PlanningException {
  kind: DayKind
  shifts?: Shift[] | null
  note?: string | null
}

export interface PlanningCell {
  /**
   * `none` : cet employé n'a aucune semaine type et rien n'a été noté ce jour —
   * « non planifié », ce qui n'est pas la même chose qu'un repos.
   */
  status: DayKind | 'none'
  shifts: Shift[]
  hours: number
  /** D'où vient la réponse : la semaine type, ou une exception posée ce jour-là. */
  source: 'semaine' | 'exception' | 'none'
  note: string
}

/** Ce qu'un employé fait un jour donné : l'exception d'abord, la semaine type sinon. */
export function resolveCell(
  schedule: WeekSlot[] | null | undefined,
  exception: PlanningException | null | undefined,
  day: string
): PlanningCell {
  const weekday = weekdayOf(day)
  const usual = (schedule ?? []).filter((s) => s.day === weekday).map(({ from, to }) => ({ from, to }))

  if (exception) {
    const note = exception.note ?? ''
    if (exception.kind !== 'travail') {
      return { status: exception.kind, shifts: [], hours: 0, source: 'exception', note }
    }
    // « Travaille ce jour-là » sans horaires saisis reprend ceux de la semaine
    // type quand il y en a : c'est le cas du repos annulé, pas des horaires changés.
    const given = (exception.shifts ?? []).map(({ from, to }) => ({ from, to }))
    const shifts = given.length ? given : usual
    return { status: 'travail', shifts, hours: hoursOf(shifts), source: 'exception', note }
  }

  if (!schedule?.length) return { status: 'none', shifts: [], hours: 0, source: 'none', note: '' }
  if (!usual.length) return { status: 'repos', shifts: [], hours: 0, source: 'semaine', note: '' }
  return { status: 'travail', shifts: usual, hours: hoursOf(usual), source: 'semaine', note: '' }
}

export interface PlanningEmployee {
  _id: string
  name: string
  poste: string
  schedule: WeekSlot[]
  /** Un jour → ce qu'il y fait. Toutes les dates de la période y sont. */
  cells: Record<string, PlanningCell>
  /** Sur la période : heures prévues et jours travaillés. */
  hours: number
  daysWorked: number
}

export interface PlanningDaySummary {
  date: string
  /** 0 = lundi … 6 = dimanche. */
  weekday: number
  /** Combien travaillent ce jour-là. */
  working: number
  /** Combien manquent à l'appel : congé, maladie, absence — pas les repos prévus. */
  away: number
}

export interface Planning {
  from: string
  to: string
  /** Le jour d'aujourd'hui à l'heure du restaurant — la caisse n'a pas à deviner le fuseau. */
  today: string
  days: PlanningDaySummary[]
  employees: PlanningEmployee[]
  /** Vrai si l'appelant peut modifier le planning (gérant, admin). */
  canEdit: boolean
}

export function buildPlanning(
  employees: { _id: string; name: string; poste?: string; schedule?: WeekSlot[] | null }[],
  /** Clé `${employeeId}:${date}`. */
  exceptions: Map<string, PlanningException>,
  opts: { from: string; to: string; today: string; canEdit: boolean }
): Planning {
  const dates: string[] = []
  for (let d = opts.from; d <= opts.to && dates.length < 100; d = addDays(d, 1)) dates.push(d)

  const rows = employees.map((e) => {
    const schedule = (e.schedule ?? []).map(({ day, from, to }) => ({ day, from, to }))
    const cells: Record<string, PlanningCell> = {}
    let minutes = 0
    let daysWorked = 0
    for (const date of dates) {
      const cell = resolveCell(schedule, exceptions.get(`${e._id}:${date}`), date)
      cells[date] = cell
      if (cell.status === 'travail') {
        daysWorked++
        minutes += cell.hours * 60
      }
    }
    return { _id: e._id, name: e.name, poste: e.poste ?? '', schedule, cells, hours: Math.round((minutes / 60) * 100) / 100, daysWorked }
  })

  const days = dates.map((date) => ({
    date,
    weekday: weekdayOf(date),
    working: rows.filter((r) => r.cells[date].status === 'travail').length,
    away: rows.filter((r) => ['conge', 'maladie', 'absence'].includes(r.cells[date].status)).length,
  }))

  return { from: opts.from, to: opts.to, today: opts.today, days, employees: rows, canEdit: opts.canEdit }
}
