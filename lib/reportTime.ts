/**
 * Days and hours as the shop lives them.
 *
 * The server runs in UTC and the shop does not: a burrito sold at 00:30 in
 * Tunis is 23:30 the day before in UTC, and one sold at 13:10 is 12:10. Every
 * date a report cuts — the bounds of the period, the day of a sale, its hour —
 * goes through here, in the shop's own time zone.
 */

export const DEFAULT_TIME_ZONE = 'Africa/Tunis'

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

export const isDay = (s: string | null | undefined): s is string =>
  typeof s === 'string' && DAY.test(s) && !Number.isNaN(Date.parse(s))

export function startOfDay(day: string, tz: string): Date {
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
  const [y, m, d] = day.split('-').map(Number)
  const target = Date.UTC(y, m - 1, d)
  const parts: Record<string, string> = {}
  for (const p of fmt.formatToParts(new Date(target))) parts[p.type] = p.value
  const asUtcMs = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second)
  let guess = target - (asUtcMs - target)
  const parts2: Record<string, string> = {}
  for (const p of fmt.formatToParts(new Date(guess))) parts2[p.type] = p.value
  const asUtcMs2 = Date.UTC(+parts2.year, +parts2.month - 1, +parts2.day, +parts2.hour, +parts2.minute, +parts2.second)
  return new Date(target - (asUtcMs2 - guess))
}

export function nextDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10)
}

export function daysBetween(from: string, to: string): string[] {
  const days: string[] = []
  for (let d = from; d <= to && days.length < 400; d = nextDay(d)) days.push(d)
  return days
}
