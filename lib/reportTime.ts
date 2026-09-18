/**
 * Days and hours as the shop lives them.
 *
 * The server runs in UTC and the shop does not: a burrito sold at 00:30 in
 * Tunis is 23:30 the day before in UTC, and one sold at 13:10 is 12:10. Every
 * date a report cuts — the bounds of the period, the day of a sale, its hour —
 * goes through here, in the shop's own time zone.
 */

export const DEFAULT_TIME_ZONE = 'Africa/Tunis'

/** The zone asked for if the runtime knows it, the shop's otherwise. */
export function safeTimeZone(tz: string | null | undefined): string {
  if (tz) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: tz })
      return tz
    } catch {
      // Unknown zone: fall back rather than fail the whole report.
    }
  }
  return DEFAULT_TIME_ZONE
}

const DAY = /^\d{4}-\d{2}-\d{2}$/

/** A calendar day written YYYY-MM-DD — the only form the report accepts. */
export const isDay = (s: string | null | undefined): s is string =>
  typeof s === 'string' && DAY.test(s) && !Number.isNaN(Date.parse(s))

/**
 * Reads an instant on the shop's wall clock. Built once per report: the
 * formatter is the expensive part, and a month is thousands of orders.
 */
export function wallClock(tz: string) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  return (instant: Date | number | string) => {
    const parts: Record<string, string> = {}
    for (const p of fmt.formatToParts(new Date(instant))) parts[p.type] = p.value
    return {
      day: `${parts.year}-${parts.month}-${parts.day}`,
      hour: Number(parts.hour),
      /** The wall-clock reading written as if it were UTC — used to find the offset. */
      asUtcMs: Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second),
    }
  }
}

/** The instant a local day begins: "2026-09-18" in Tunis is 2026-09-17T23:00Z. */
export function startOfDay(day: string, tz: string): Date {
  const clock = wallClock(tz)
  const [y, m, d] = day.split('-').map(Number)
  const target = Date.UTC(y, m - 1, d)
  // The zone's offset is measured at a first guess, then again at the result:
  // the second pass settles a day that begins on a daylight-saving change.
  let guess = target
  for (let i = 0; i < 2; i++) guess = target - (clock(guess).asUtcMs - guess)
  return new Date(guess)
}

/** "2026-09-18" → "2026-09-19", month and year ends included. */
export function nextDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10)
}

/** Every day from → to, both included. Capped: a report is never a decade. */
export function daysBetween(from: string, to: string): string[] {
  const days: string[] = []
  for (let d = from; d <= to && days.length < 400; d = nextDay(d)) days.push(d)
  return days
}
