import { DEFAULT_TIME_ZONE, addDays, startOfDay } from './reportTime'

/**
 * L'échéance de validation du pointage, et son calcul.
 *
 * Le gérant valide la journée de la veille avant une échéance : par défaut le
 * lendemain 12:00, heure de Tunis. Le réglage vit dans `Configuration`, clé
 * `attendance.validationDeadline`, valeur `{ afterDays, time }` — `afterDays`
 * jours après le jour de service, à `time`.
 *
 * Même patron que lib/planningDeadline. Pur, sauf `readDeadlineSetting` qui lit
 * la base (import différé : les scripts de vérification n'ont ni base ni
 * MONGO_URL).
 */

export const ATTENDANCE_DEADLINE_KEY = 'attendance.validationDeadline'

export interface AttendanceDeadline {
  /** Jours après le jour de service : 0 (le soir même), 1 (le lendemain), 2. */
  afterDays: number
  /** « 12:00 », heure de Tunis. */
  time: string
}

export const DEFAULT_ATTENDANCE_DEADLINE: AttendanceDeadline = { afterDays: 1, time: '12:00' }

/** Au-delà de 2 jours, l'échéance tomberait presque hors de la fenêtre de saisie (3 jours). */
export const MAX_AFTER_DAYS = 2

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

/**
 * Le réglage s'il est valide (objet, ou JSON en texte), sinon null. Pour
 * l'écriture : une valeur douteuse est refusée, pas remplacée par le défaut.
 */
export function strictAttendanceDeadline(raw: unknown): AttendanceDeadline | null {
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
  const afterDays = v.afterDays
  if (typeof afterDays !== 'number' || !Number.isInteger(afterDays) || afterDays < 0 || afterDays > MAX_AFTER_DAYS) return null
  if (typeof v.time !== 'string' || !TIME.test(v.time)) return null
  return { afterDays, time: v.time }
}

/** Le réglage tel que lu en base ; absent ou invalide : le défaut. */
export const parseAttendanceDeadline = (raw: unknown): AttendanceDeadline =>
  strictAttendanceDeadline(raw) ?? { ...DEFAULT_ATTENDANCE_DEADLINE }

export async function readAttendanceDeadlineSetting(): Promise<AttendanceDeadline> {
  const { connectDB } = await import('./mongodb')
  const { Configuration } = await import('./models/Configuration')
  await connectDB()
  const doc = (await Configuration.findOne({ key: ATTENDANCE_DEADLINE_KEY }).select('value').lean()) as { value?: unknown } | null
  return parseAttendanceDeadline(doc?.value)
}

/**
 * L'instant de l'échéance d'un jour de service : minuit de (jour + afterDays) à
 * Tunis, plus l'heure réglée. Pour le 3 nov. : le 4 nov. 12:00 Tunis, soit
 * 11:00 UTC.
 */
export function attendanceDeadlineAt(date: string, deadline: AttendanceDeadline, tz = DEFAULT_TIME_ZONE): Date {
  const minutes = Number(deadline.time.slice(0, 2)) * 60 + Number(deadline.time.slice(3, 5))
  return new Date(startOfDay(addDays(date, deadline.afterDays), tz).getTime() + minutes * 60_000)
}

/** Échue strictement après l'instant : à 12:00 pile, il est encore temps. */
export const attendanceDeadlinePassed = (at: Date, now: Date) => now.getTime() > at.getTime()

const AFTER_LABELS = ['le jour même', 'le lendemain', 'le surlendemain']

/** « le lendemain 12:00 », pour un message. */
export const attendanceDeadlineLabel = (d: AttendanceDeadline) => `${AFTER_LABELS[d.afterDays] ?? `${d.afterDays} jours après`} ${d.time}`
