import { Sequence } from './models/Sequence'
import { DEFAULT_TIME_ZONE, wallClock } from './reportTime'

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
