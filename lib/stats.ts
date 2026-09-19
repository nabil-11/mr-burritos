import { connectDB } from './mongodb'
import { Order } from './models/Order'
import { Review } from './models/Review'

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

export interface ReviewSummary {
  average: number
  count: number
  latest: { name: string; rating: number; comment: string }[]
}

/**
 * Approved reviews only — what the avis page already shows publicly. Used for
 * the home page's word-of-mouth block and the search-engine rating.
 */
export async function getReviewSummary(): Promise<ReviewSummary> {
  await connectDB()
  const [agg, latest] = await Promise.all([
    Review.aggregate<{ average: number; count: number }>([
      { $match: { isApproved: true } },
      { $group: { _id: null, average: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]),
    Review.find({ isApproved: true, comment: { $ne: '' } })
      .sort({ createdAt: -1 })
      .limit(3)
      .select('customerName rating comment')
      .lean(),
  ])
  return {
    average: Math.round((agg[0]?.average ?? 0) * 10) / 10,
    count: agg[0]?.count ?? 0,
    latest: (latest as { customerName?: string; rating?: number; comment?: string }[]).map((r) => ({
      name: String(r.customerName ?? '').split(/\s+/)[0] ?? '',
      rating: Number(r.rating ?? 0),
      comment: String(r.comment ?? ''),
    })),
  }
}
