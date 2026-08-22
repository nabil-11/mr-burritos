import { connectDB } from './mongodb'
import { Order } from './models/Order'

/**
 * Numbers shown on the home page. Every one is computed from real orders —
 * nothing here is decorative. Cancelled orders are excluded so the count means
 * "food we actually made".
 */

export interface HomeStats {
  /** Orders actually prepared, all time. */
  prepared: number
  /** Distinct customers, identified by phone number. */
  clients: number
  /** Month/year of the first order, e.g. "juin 2026". */
  since: string | null
}

const MONTHS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
]

export async function getHomeStats(): Promise<HomeStats> {
  await connectDB()

  const notCancelled = { status: { $ne: 'cancelled' } }

  const [prepared, firstOrder, phoneGroups] = await Promise.all([
    Order.countDocuments(notCancelled),
    Order.findOne(notCancelled).sort({ createdAt: 1 }).select('createdAt').lean(),
    Order.aggregate<{ _id: string | null }>([
      { $match: notCancelled },
      { $group: { _id: '$customer.phone' } },
    ]),
  ])

  // The same customer is stored several ways — "99611804", "  99611804",
  // " 99611804 " are one person. Counter and kiosk orders carry "—" or "-" as
  // the phone: real orders, but not attributable to anyone, so they are not
  // counted as clients.
  const clients = new Set(
    phoneGroups
      .map((g) => String(g._id ?? '').replace(/\D/g, ''))
      .filter((p) => p.length > 0)
  ).size

  const created = (firstOrder as { createdAt?: Date } | null)?.createdAt
  const since = created
    ? `${MONTHS[new Date(created).getMonth()]} ${new Date(created).getFullYear()}`
    : null

  return { prepared, clients, since }
}
