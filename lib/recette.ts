import { connectDB } from './mongodb'
import { Order } from './models/Order'
import { Recette } from './models/Recette'
import { ORDER_SOURCES, type OrderSource } from './orderSource'

/**
 * Till sessions ("recettes") and their figures.
 *
 * The rule the whole feature hangs on: an order joins whichever session was
 * open the moment it was created — see the stamp in `POST /api/orders` — and
 * never moves. So a session's order list is settled the second the session
 * closes, and its totals can be frozen without ever going stale.
 *
 * A session collects every channel, not just the till: the shift's takings are
 * the shift's takings, whether the ticket was rung up at the counter, tapped on
 * the kiosk or sent from the website. The breakdown by origin, computed below,
 * is what tells them apart.
 */

/** An error carrying the HTTP status the API should answer with. */
export class RecetteError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

export interface Bucket {
  count: number
  revenue: number
}

export interface RecetteTotals {
  /** Orders that count — cancelled ones excluded. */
  orders: number
  cancelled: number
  /** Orders neither delivered nor cancelled — still on the pass. */
  inProgress: number
  /** Gross takings. */
  revenue: number
  /** What the restaurant keeps, after platform commission. */
  net: number
  discounts: number
  surcharges: number
  deliveryFees: number
  commission: number
  /**
   * What the drawer should hold on top of the opening float.
   *
   * Payment method is not recorded anywhere, so this is the honest
   * approximation: orders taken on the premises (caisse, borne) that no
   * delivery platform was involved in — the ones that are paid in cash at the
   * counter.
   */
  cashExpected: number
  byType: Record<'delivery' | 'pickup', Bucket>
  bySource: Record<OrderSource | 'unknown', Bucket>
}

type OrderLike = {
  status?: string
  type?: string
  source?: string
  total?: number
  deliveryFee?: number
  discount?: { amount?: number } | null
  surcharge?: { amount?: number } | null
  deliveryCompany?: { name?: string; commission?: number } | null
}

export function emptyTotals(): RecetteTotals {
  const bySource = {} as Record<OrderSource | 'unknown', Bucket>
  for (const key of [...ORDER_SOURCES, 'unknown'] as const) bySource[key] = { count: 0, revenue: 0 }
  return {
    orders: 0,
    cancelled: 0,
    inProgress: 0,
    revenue: 0,
    net: 0,
    discounts: 0,
    surcharges: 0,
    deliveryFees: 0,
    commission: 0,
    cashExpected: 0,
    byType: { delivery: { count: 0, revenue: 0 }, pickup: { count: 0, revenue: 0 } },
    bySource,
  }
}

/**
 * Adds up a session's orders. Pure, so the same arithmetic serves the live
 * figures of an open session and the snapshot frozen into a closed one.
 */
export function computeTotals(orders: OrderLike[]): RecetteTotals {
  const totals = emptyTotals()

  for (const order of orders) {
    if (order.status === 'cancelled') {
      totals.cancelled++
      continue
    }

    const total = order.total || 0
    const rate = order.deliveryCompany?.commission ?? 0
    const commission = order.type === 'delivery' ? total * (rate / 100) : 0

    totals.orders++
    if (order.status !== 'delivered') totals.inProgress++
    totals.revenue += total
    totals.net += total - commission
    totals.commission += commission
    totals.discounts += order.discount?.amount || 0
    totals.surcharges += order.surcharge?.amount || 0
    totals.deliveryFees += order.deliveryFee || 0

    const type = order.type === 'delivery' ? 'delivery' : 'pickup'
    totals.byType[type].count++
    totals.byType[type].revenue += total

    const source = (ORDER_SOURCES as readonly string[]).includes(String(order.source))
      ? (order.source as OrderSource)
      : 'unknown'
    totals.bySource[source].count++
    totals.bySource[source].revenue += total

    const onPremises = source === 'counter' || source === 'kiosk'
    if (onPremises && !order.deliveryCompany?.name) totals.cashExpected += total
  }

  return totals
}

/** The session currently taking orders, if any. */
export async function getOpenRecette() {
  await connectDB()
  return Recette.findOne({ status: 'open' })
}

/** Every order stamped with this session, newest first. */
export async function recetteOrders(id: unknown) {
  await connectDB()
  return Order.find({ recette: id }).sort({ createdAt: -1 }).lean()
}

/**
 * Live figures for a session. A closed session keeps its frozen snapshot —
 * recomputing it would let a status change made weeks later rewrite a closing
 * report that has already been signed off.
 */
export async function recetteTotals(recette: {
  _id: unknown
  status?: string
  totals?: RecetteTotals | null
}): Promise<RecetteTotals> {
  if (recette.status === 'closed' && recette.totals) return recette.totals
  return computeTotals((await recetteOrders(recette._id)) as OrderLike[])
}

/**
 * Difference between the cash counted at closing and what was expected.
 * `null` while nothing has been counted — an uncounted drawer is not a
 * balanced one.
 */
export function cashDifference(
  recette: { openingFloat?: number; closingCash?: number | null },
  totals: RecetteTotals
): number | null {
  if (typeof recette.closingCash !== 'number') return null
  return recette.closingCash - ((recette.openingFloat || 0) + totals.cashExpected)
}

const pad = (n: number) => String(n).padStart(2, '0')

/** R-20260909-01 — the day, then the rank of the session within that day. */
async function nextNumber(now: Date, offset: number): Promise<string> {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  const sameDay = await Recette.countDocuments({ openedAt: { $gte: start, $lt: end } })
  const day = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
  return `R-${day}-${pad(sameDay + 1 + offset)}`
}

/** Name of the unique index a write collided with, or null if it did not. */
function duplicateOf(err: unknown): string | null {
  const e = err as { code?: number; keyPattern?: Record<string, unknown> } | undefined
  if (!e || e.code !== 11000) return null
  return Object.keys(e.keyPattern ?? {})[0] ?? 'unknown'
}

export interface OpenInput {
  userId?: string | null
  userName?: string
  openingFloat?: number
  notes?: string
}

/**
 * Opens a session. Refuses if one is already running — checked here for a
 * readable message, and again by the unique index for the case where two
 * people press the button in the same second.
 */
export async function openRecette(input: OpenInput) {
  await connectDB()
  if (await getOpenRecette()) throw new RecetteError('Une recette est déjà ouverte', 409)

  const now = new Date()
  // A deleted session leaves a hole in the day's numbering, so a number
  // already taken is not an error — just try the next one.
  for (let offset = 0; offset < 5; offset++) {
    try {
      return await Recette.create({
        number: await nextNumber(now, offset),
        status: 'open',
        openedAt: now,
        openedBy: { user: input.userId ?? null, name: input.userName ?? '' },
        openingFloat: Number(input.openingFloat) || 0,
        notes: input.notes ?? '',
      })
    } catch (err) {
      const field = duplicateOf(err)
      if (field === 'number') continue
      if (field === 'status') throw new RecetteError('Une recette est déjà ouverte', 409)
      throw err
    }
  }
  throw new RecetteError("Impossible d'attribuer un numéro de recette", 500)
}

export interface CloseInput {
  userId?: string | null
  userName?: string
  closingCash?: number | null
  notes?: string
}

/** Closes a session and freezes its figures. */
export async function closeRecette(id: string, input: CloseInput) {
  await connectDB()
  const recette = await Recette.findById(id)
  if (!recette) throw new RecetteError('Recette introuvable', 404)
  if (recette.status === 'closed') throw new RecetteError('Recette déjà clôturée', 409)

  recette.totals = computeTotals((await recetteOrders(recette._id)) as OrderLike[])
  recette.status = 'closed'
  recette.closedAt = new Date()
  recette.closedBy = { user: input.userId ?? null, name: input.userName ?? '' }
  if (typeof input.closingCash === 'number' && Number.isFinite(input.closingCash)) {
    recette.closingCash = input.closingCash
  }
  if (typeof input.notes === 'string' && input.notes.trim()) recette.notes = input.notes.trim()
  await recette.save()
  return recette
}
