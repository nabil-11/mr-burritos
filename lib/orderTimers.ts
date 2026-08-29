import { connectDB } from './mongodb'
import { Order } from './models/Order'
import type { OrderSource } from './orderSource'

/**
 * Preparation countdown for orders taken on the premises.
 *
 * A caisse order is paid and fired the moment it is rung up, so it does not
 * wait for anyone to confirm it: it goes straight to "en préparation" and
 * starts a timer. The back-office shows the time left next to the status, and
 * once it runs out the order becomes "prête" on its own.
 *
 * Counter *deliveries* are deliberately left out: those are platform orders
 * whose driver flow waits on the "confirmed" status, and moving them along on
 * a timer would take the order out from under the driver.
 *
 * Add 'kiosk' below to give the in-store terminal the same behaviour.
 */
export const AUTO_READY_SOURCES: OrderSource[] = ['counter']

/** Only orders leaving over the counter run a timer. */
export const AUTO_READY_TYPE = 'pickup'

/** Fallback when an order carries no explicit preparation time. */
export const DEFAULT_PREP_MINUTES = 30

/** Statuses a countdown can still be running on. */
const RUNNING = ['confirmed', 'preparing']

/**
 * When the food is due. Counter orders are created already confirmed, and
 * `confirmedAt` is only written by the status route, so fall back to the
 * creation time — for these orders the two are the same instant anyway.
 */
export function readyDeadline(
  startedAt: Date | string | null | undefined,
  preparationDuration: number | null | undefined
): Date | null {
  if (!startedAt) return null
  const minutes = preparationDuration || DEFAULT_PREP_MINUTES
  return new Date(new Date(startedAt).getTime() + minutes * 60_000)
}

/**
 * The two ways an order ends up on a clock: it was taken on the premises, or
 * the caisse accepted it and started the preparation itself (a web order the
 * cashier pressed "préparer" on).
 */
function isTimed(source: unknown, type: unknown, autoReady: unknown): boolean {
  return (
    autoReady === true ||
    (AUTO_READY_SOURCES.includes(source as OrderSource) && type === AUTO_READY_TYPE)
  )
}

/** True while this order should be showing a countdown next to its status. */
export function hasCountdown(
  source: unknown,
  type: unknown,
  status: unknown,
  autoReady: unknown = false
): boolean {
  return isTimed(source, type, autoReady) && RUNNING.includes(String(status))
}

/**
 * Lazy transition: flips timed orders — on-site ones, and those the caisse
 * accepted — to "ready" once their preparation time
 * has run out. Runs on read, like the auto-cancel sweep, so no cron job is
 * needed — and it is a no-op (zero writes) when nothing is due.
 *
 * Call this BEFORE the auto-cancel sweep: a counter order left unattended past
 * the grace period must land on "prête" (the food was made and paid for), not
 * on "annulée".
 */
export async function autoReadyOnSiteOrders(): Promise<void> {
  await connectDB()
  await Order.updateMany(
    {
      $or: [
        { source: { $in: AUTO_READY_SOURCES }, type: AUTO_READY_TYPE },
        { autoReady: true },
      ],
      status: { $in: RUNNING },
      $expr: {
        $lte: [
          {
            $add: [
              { $ifNull: ['$confirmedAt', '$createdAt'] },
              { $multiply: [{ $ifNull: ['$preparationDuration', DEFAULT_PREP_MINUTES] }, 60_000] },
            ],
          },
          new Date(),
        ],
      },
    },
    { $set: { status: 'ready' } }
  )
}
