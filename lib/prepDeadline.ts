/**
 * When the food is due — the one piece of lib/orderTimers that needs no
 * database. Kept apart so pure rules (lib/managerAlerts) and their check script
 * can use it without importing lib/mongodb, which throws without MONGO_URL.
 * lib/orderTimers re-exports both names, so existing imports are unchanged.
 */

/** Fallback when an order carries no explicit preparation time. */
export const DEFAULT_PREP_MINUTES = 30

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
