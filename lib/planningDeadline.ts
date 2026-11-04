import { mondayOf, WEEKDAYS } from './planning'
import { DEFAULT_TIME_ZONE, addDays, startOfDay } from './reportTime'

/**
 * L'échéance de validation du planning, et son calcul.
 *
 * Le gérant valide la semaine suivante avant une échéance hebdomadaire : par
 * défaut le jeudi 18:00, heure de Tunis. Le réglage vit dans `Configuration`,
 * clé `planning.validationDeadline`, valeur `{ weekday, time }` — `weekday` 0
 * est lundi, comme partout dans lib/planning.
 *
 * Pur, sauf `readDeadlineSetting` qui lit la base (import différé : les
 * scripts de vérification n'ont ni base ni MONGO_URL).
 */

export const DEADLINE_KEY = 'planning.validationDeadline'

export interface Deadline {
  /** 0 = lundi … 6 = dimanche. */
  weekday: number
  /** « 18:00 », heure de Tunis. */
  time: string
}

export const DEFAULT_DEADLINE: Deadline = { weekday: 3, time: '18:00' }

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

/**
 * Le réglage s'il est valide (objet, ou JSON en texte), sinon null. Pour
 * l'écriture : une valeur douteuse est refusée, pas remplacée par le défaut.
 */
export function strictDeadline(raw: unknown): Deadline | null {
  let value = raw
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch {
      return null
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const v = value as Record<string, unknown>
  const weekday = v.weekday
  if (typeof weekday !== 'number' || !Number.isInteger(weekday) || weekday < 0 || weekday > 6) return null
  if (typeof v.time !== 'string' || !TIME.test(v.time)) return null
  return { weekday, time: v.time }
}

/** Le réglage tel que lu en base ; absent ou invalide : le défaut. */
export const parseDeadline = (raw: unknown): Deadline => strictDeadline(raw) ?? { ...DEFAULT_DEADLINE }

export async function readDeadlineSetting(): Promise<Deadline> {
  const { connectDB } = await import('./mongodb')
  const { Configuration } = await import('./models/Configuration')
  await connectDB()
  const doc = (await Configuration.findOne({ key: DEADLINE_KEY }).select('value').lean()) as { value?: unknown } | null
  return parseDeadline(doc?.value)
}

/** Les `count` prochains lundis strictement après `today` (AAAA-MM-JJ, jour de Tunis). */
export function nextMondays(today: string, count: number): string[] {
  const first = addDays(mondayOf(today), 7)
  return Array.from({ length: count }, (_, i) => addDays(first, 7 * i))
}

/**
 * L'instant de l'échéance d'une semaine : le dernier jour `weekday` avant son
 * lundi, à l'heure réglée à Tunis. Jeudi 18:00 pour le lundi 9 nov. : le
 * jeudi 5 nov. 17:00 UTC.
 */
export function deadlineAt(monday: string, deadline: Deadline, tz = DEFAULT_TIME_ZONE): Date {
  const day = addDays(monday, -(7 - deadline.weekday))
  const minutes = Number(deadline.time.slice(0, 2)) * 60 + Number(deadline.time.slice(3, 5))
  return new Date(startOfDay(day, tz).getTime() + minutes * 60_000)
}

/** Échue strictement après l'instant : à 18:00 pile, il est encore temps. */
export const deadlinePassed = (at: Date, now: Date) => now.getTime() > at.getTime()

/** « jeudi 18:00 », pour un message. */
export const deadlineLabel = (d: Deadline) => `${WEEKDAYS[d.weekday].toLowerCase()} ${d.time}`

/** Un jour AAAA-MM-JJ du vrai calendrier (le 30 février n'en est pas un). */
const isRealDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && addDays(v, 0) === v

/**
 * La semaine visée par copy-week et validate : un lundi, celui de cette
 * semaine ou plus tard. Pas un lundi, ou pas un jour : `bad_request`. Une
 * semaine déjà finie : `past_week`.
 */
export function parseWeek(raw: unknown, today: string): { ok: true; monday: string } | { ok: false; code: 'bad_request' | 'past_week' } {
  if (!isRealDay(raw) || mondayOf(raw) !== raw) return { ok: false, code: 'bad_request' }
  if (raw < mondayOf(today)) return { ok: false, code: 'past_week' }
  return { ok: true, monday: raw }
}

/** Au plus loin : un an après aujourd'hui (366 jours, pour couvrir une année bissextile). */
export const MAX_AHEAD_DAYS = 366

/** Ce jour (AAAA-MM-JJ) est-il au-delà de aujourd'hui + 1 an ? */
export const tooFarAhead = (day: string, today: string) => day > addDays(today, MAX_AHEAD_DAYS)

/**
 * validate : le lundi de cette semaine ou l'un des 2 suivants — pas plus loin,
 * sinon un gérant fait taire le rappel pour un an. Plus tôt : `past_week`.
 */
export function parseValidateWeek(raw: unknown, today: string): ReturnType<typeof parseWeek> {
  const week = parseWeek(raw, today)
  if (!week.ok) return week
  if (week.monday > addDays(mondayOf(today), 14)) return { ok: false, code: 'bad_request' }
  return week
}

/**
 * copy-week : une semaine après la semaine en cours (l'app ne propose que les
 * semaines à venir) et pas au-delà d'un an. La semaine en cours ou une passée :
 * `past_week`.
 */
export function parseCopyWeek(raw: unknown, today: string): ReturnType<typeof parseWeek> {
  const week = parseWeek(raw, today)
  if (!week.ok) return week
  if (week.monday <= mondayOf(today)) return { ok: false, code: 'past_week' }
  if (tooFarAhead(week.monday, today)) return { ok: false, code: 'bad_request' }
  return week
}

/** copy-week : la semaine d'avant, recopiée une fois sur `monday`. */
export const copyWeekRequest = (monday: string) => ({ mode: 'week' as const, from: addDays(monday, -7), weeks: 1 })
