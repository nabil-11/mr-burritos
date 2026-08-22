/**
 * Opening hours, in the restaurant's own timezone.
 *
 * These are hardcoded because nothing in the database holds them yet — the
 * Configuration collection is empty. Change them here, in one place, and the
 * navbar status and the footer both follow.
 */

export const TIMEZONE = 'Africa/Tunis'

/** Index 0 = Sunday, matching Date.getDay(). `null` means closed that day. */
export const OPENING_HOURS: ({ open: number; close: number } | null)[] = [
  { open: 11, close: 23 }, // dimanche
  { open: 11, close: 23 }, // lundi
  { open: 11, close: 23 }, // mardi
  { open: 11, close: 23 }, // mercredi
  { open: 11, close: 23 }, // jeudi
  { open: 11, close: 24 }, // vendredi
  { open: 11, close: 24 }, // samedi
]

/** Typical time from order to handover, in minutes. */
export const PREP_MINUTES = 25

export interface OpenState {
  open: boolean
  /** "23:00" when open, "11:00" when closed. */
  at: string
}

const hhmm = (h: number) => `${String(h % 24).padStart(2, '0')}:00`

/** Where the restaurant stands right now, evaluated in its own timezone. */
export function openStateAt(now: Date): OpenState {
  // Read the wall clock in Tunis rather than wherever this code happens to run.
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE,
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(now)

  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const day = days.indexOf(get('weekday'))
  const hour = Number(get('hour'))
  const minute = Number(get('minute'))

  const today = OPENING_HOURS[day] ?? null
  if (!today) {
    const next = OPENING_HOURS.find(Boolean)
    return { open: false, at: hhmm(next?.open ?? 11) }
  }

  const nowMin = hour * 60 + minute
  const isOpen = nowMin >= today.open * 60 && nowMin < today.close * 60

  return isOpen
    ? { open: true, at: hhmm(today.close) }
    : { open: false, at: hhmm(today.open) }
}
