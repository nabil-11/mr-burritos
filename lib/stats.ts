import { connectDB } from './mongodb'
import { Order } from './models/Order'
import { Review } from './models/Review'
import { TOP_SELLERS } from './commerce'

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

/**
 * « Les plus commandés » : les produits les plus vendus sur la période
 * (lib/commerce TOP_SELLERS), annulations exclues, chacun vendu au moins
 * `minSold` fois — un plat commandé deux fois n'est pas un « top vente ».
 * Compté en unités, toutes provenances confondues (site, caisse, borne).
 */
export async function getTopSellers(): Promise<string[]> {
  await connectDB()
  const since = new Date(Date.now() - TOP_SELLERS.days * 86_400_000)
  const rows = await Order.aggregate<{ _id: unknown; sold: number }>([
    { $match: { status: { $ne: 'cancelled' }, createdAt: { $gte: since } } },
    { $unwind: '$items' },
    { $group: { _id: '$items.product', sold: { $sum: '$items.quantity' } } },
    { $match: { sold: { $gte: TOP_SELLERS.minSold } } },
    { $sort: { sold: -1 } },
    // Un peu plus que nécessaire : un produit retiré de la carte laisse sa place au suivant.
    { $limit: TOP_SELLERS.count * 3 },
  ])
  return rows.map((r) => String(r._id))
}
