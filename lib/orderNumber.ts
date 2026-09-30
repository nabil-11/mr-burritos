import { Sequence } from './models/Sequence'

const DEFAULT_TIME_ZONE = 'Africa/Tunis'

/**
 * Reads an instant on the shop's wall clock.
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

/**
 * MB-20260919-0012 — the shop's day, then the order's rank within it.
 *
 * It replaces four random digits. Two orders of the same day could draw the
 * same four, and the second then failed on the unique index: an order lost to
 * a dice roll. A counter per day, incremented atomically, cannot hand out the
 * same number twice — and "commande 12" is something a cashier can call out.
 *
 * The day is the shop's (Tunis), not the server's UTC: an order at 00:30 is
 * the new day's order, not the last one of the day before.
 */
export async function nextOrderNumber(now: Date = new Date()): Promise<string> {
  const { day } = wallClock(DEFAULT_TIME_ZONE)(now)
  const counter = (await Sequence.findOneAndUpdate(
    { _id: `order-${day}` },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' }
  ).lean()) as { seq?: number } | null
  return `MB-${day.replace(/-/g, '')}-${String(counter?.seq ?? 1).padStart(4, '0')}`
}

/**
 * A unique index said no. For an order that can only be its number — taken by
 * an order numbered before the daily sequence existed, or by two first orders
 * of the day racing to create the day's counter — and the fix is to take the
 * next one.
 */
export const isDuplicateKey = (err: unknown): boolean =>
  (err as { code?: number } | null)?.code === 11000
