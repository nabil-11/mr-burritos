import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { Order } from '@/lib/models/Order'
import { Recette } from '@/lib/models/Recette'
import { ORDER_SOURCES, type OrderSource } from '@/lib/orderSource'
import { cashDifference, recetteTotals, type RecetteTotals } from '@/lib/recette'
import { MOVEMENT_META, isMovementKind, type MovementKind } from '@/lib/movementKinds'
import { PlatformPayout } from '@/lib/models/PlatformPayout'
import { isPaid, moneyPocket, receivableOf, type PlatformOrderLike } from '@/lib/platformSettlement'
import { daysBetween, isDay, nextDay, safeTimeZone, startOfDay, wallClock } from '@/lib/reportTime'

/**
 * GET /api/reports?from=YYYY-MM-DD&to=YYYY-MM-DD&tz=Africa/Tunis
 *
 * What a period took in — and, since the caisse records them, what went out
 * of the drawer, what is left, and whether the drawers balanced. Read by the
 * back-office and by the till; everything added after the first version is
 * additive, so an older reader simply ignores it.
 *
 * Days and hours are cut in the shop's time zone (`tz`, Tunis by default), not
 * the server's: the server runs in UTC, and a sale at 13:10 in Tunis belongs
 * in the 13h bar, not the 12h one.
 */

const round2 = (n: number) => Math.round(n * 100) / 100

/** Up to this many days, a period lists every day — closed ones as zero. */
const FILL_DAYS_UP_TO = 62
/** A month and then some; beyond that the list is a history, not a report. */
const MAX_RECETTES = 62

type MovementDoc = {
  kind?: string
  label?: string
  amount?: number
  createdAt?: Date
  cancelledAt?: Date | null
}

type RecetteDoc = {
  _id: unknown
  number?: string
  status?: string
  openedAt?: Date
  closedAt?: Date | null
  openingFloat?: number
  closingCash?: number | null
  totals?: RecetteTotals | null
  mouvements?: MovementDoc[]
}

/** "Légumes ", "legumes" and "LEGUMES" are one line of the report. */
const labelKey = (kind: string, label: string) =>
  `${kind}:${label.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}`

type Tally = { kind: MovementKind; label: string; count: number; amount: number; last: number }

/** Adds one entry to a "what was it spent on" ranking. */
function tally(map: Map<string, Tally>, kind: MovementKind, raw: string, amount: number, at: number) {
  const label = raw.trim()
  const key = labelKey(kind, label)
  const entry = map.get(key) ?? { kind, label, count: 0, amount: 0, last: 0 }
  entry.count++
  entry.amount += amount
  // Shown as it was last typed.
  if (at >= entry.last && label) {
    entry.last = at
    entry.label = label
  }
  map.set(key, entry)
}

/** The ten biggest lines — beyond that a ranking is a ledger. */
const topLabels = (map: Map<string, Tally>) =>
  [...map.values()]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10)
    .map(({ kind, label, count, amount }) => ({ kind, label, count, amount: round2(amount) }))

export async function GET(req: NextRequest) {
  try {
    await connectDB()
    const { searchParams } = new URL(req.url)
    const tz = safeTimeZone(searchParams.get('tz'))
    const fromParam = searchParams.get('from')
    const toParam = searchParams.get('to')
    const from = isDay(fromParam) ? fromParam : null
    const to = isDay(toParam) ? toParam : null

    // Local midnight to local midnight: `to` runs up to the start of the day
    // after it, so its last hour is in and the next day's first is not.
    const range: { $gte?: Date; $lt?: Date } = {}
    if (from) range.$gte = startOfDay(from, tz)
    if (to) range.$lt = startOfDay(nextDay(to), tz)
    const bounded = Boolean(range.$gte || range.$lt)
    const within = (t: number) =>
      (!range.$gte || t >= range.$gte.getTime()) && (!range.$lt || t < range.$lt.getTime())
    const clock = wallClock(tz)

    const [all, recetteDocs, movementDocs, payoutDocs] = await Promise.all([
      Order.find(bounded ? { createdAt: range } : {}).lean(),
      Recette.find(bounded ? { openedAt: range } : {})
        .sort({ openedAt: -1 })
        .limit(MAX_RECETTES)
        .lean(),
      // A cash-out belongs to the day it was paid, whichever session it sits
      // in — a recette opened on Monday evening can hold Tuesday's bread.
      Recette.find(
        bounded ? { mouvements: { $elemMatch: { createdAt: range } } } : { 'mouvements.0': { $exists: true } },
        { mouvements: 1 }
      ).lean(),
      // Un versement appartient au jour où il est arrivé, pas à celui des
      // commandes qu'il solde : Glovo paie lundi une semaine déjà écoulée.
      PlatformPayout.find(bounded ? { createdAt: range } : {}).lean(),
    ])

    // Cancelled orders took no money: they stay out of every figure below and
    // are counted on their own, so a bad day of cancellations still shows.
    const orders = all.filter((o) => o.status !== 'cancelled')
    const cancelledOrders = all.filter((o) => o.status === 'cancelled')

    // Net revenue for a single order (deducts commission for delivery orders)
    const orderNet = (o: (typeof orders)[0]): number => {
      const total = o.total || 0
      if (o.type === 'delivery') {
        const commission = (o.deliveryCompany as { commission?: number } | undefined)?.commission ?? 0
        return total * (1 - commission / 100)
      }
      return total
    }

    const totalRevenue = orders.reduce((s, o) => s + (o.total || 0), 0)
    const orderCount = orders.length

    const delivery = orders.filter((o) => o.type === 'delivery')
    const pickup = orders.filter((o) => o.type === 'pickup')

    // By delivery company — net computed per order, with each order's own rate.
    // Le règlement vient en plus : sur la période, ce que la plateforme a
    // encaissé pour le restaurant, et la part qu'elle a déjà reversée. Une
    // commande payée en espèces au comptoir ne doit rien — voir
    // lib/platformSettlement, qui tranche pour tout le monde.
    type CompanyTally = {
      count: number
      revenue: number
      netRevenue: number
      commission: number
      due: number
      paidNet: number
      paidCount: number
      unpaidNet: number
      unpaidCount: number
    }
    const companyMap: Record<string, CompanyTally> = {}
    for (const o of delivery) {
      const dc = o.deliveryCompany as { name?: string; commission?: number } | undefined
      const name = dc?.name || 'Inconnue'
      const commission = dc?.commission ?? 0
      if (!companyMap[name]) {
        companyMap[name] = {
          count: 0, revenue: 0, netRevenue: 0, commission,
          due: 0, paidNet: 0, paidCount: 0, unpaidNet: 0, unpaidCount: 0,
        }
      }
      const entry = companyMap[name]
      entry.count++
      entry.revenue += o.total || 0
      entry.netRevenue += (o.total || 0) * (1 - commission / 100)
      entry.commission = commission
      const receivable = receivableOf(o as PlatformOrderLike)
      if (receivable > 0) {
        entry.due += receivable
        if (isPaid(o as PlatformOrderLike)) {
          entry.paidNet += receivable
          entry.paidCount++
        } else {
          entry.unpaidNet += receivable
          entry.unpaidCount++
        }
      }
    }
    const byDeliveryCompany = Object.entries(companyMap)
      .map(([name, d]) => ({
        name,
        count: d.count,
        revenue: d.revenue,
        commission: d.commission,
        net: d.netRevenue,
        commissionAmount: d.revenue - d.netRevenue,
        /** Le net que la plateforme a encaissé pour le restaurant sur la période. */
        due: round2(d.due),
        paidNet: round2(d.paidNet),
        paidCount: d.paidCount,
        unpaidNet: round2(d.unpaidNet),
        unpaidCount: d.unpaidCount,
      }))
      .sort((a, b) => b.revenue - a.revenue)

    // By source — `unknown` collects orders placed before the field existed;
    // folding them into 'website' would overstate the site's past share.
    const bySource = {} as Record<OrderSource | 'unknown', { count: number; revenue: number; net: number }>
    for (const key of [...ORDER_SOURCES, 'unknown'] as const) bySource[key] = { count: 0, revenue: 0, net: 0 }
    for (const o of orders) {
      const key = (ORDER_SOURCES as readonly string[]).includes(String(o.source))
        ? (o.source as OrderSource)
        : 'unknown'
      bySource[key].count++
      bySource[key].revenue += o.total || 0
      bySource[key].net += orderNet(o)
    }

    // By payment — what the till recorded. Web orders and orders from before
    // it asked read as "non renseigne", never as cash.
    const byPayment = {
      cash: { count: 0, revenue: 0 },
      card: { count: 0, revenue: 0 },
      other: { count: 0, revenue: 0 },
      unknown: { count: 0, revenue: 0 },
    }
    for (const o of orders) {
      const m = (o.payment as { method?: string } | undefined)?.method
      const key = m === 'cash' || m === 'card' || m === 'other' ? m : 'unknown'
      byPayment[key].count++
      byPayment[key].revenue = round2(byPayment[key].revenue + (o.total || 0))
    }

    // Top products — from every order that lists its items: caisse, borne and
    // web alike, delivered or not. Platform orders keyed in at the till carry
    // an amount rather than items, and simply add nothing here.
    const productMap: Record<string, { qty: number; revenue: number }> = {}
    for (const o of orders) {
      const items = (o.items || []) as {
        productName: { fr: string } | string
        quantity: number
        unitPrice: number
        supplements?: { price: number }[]
      }[]
      for (const item of items) {
        const name =
          typeof item.productName === 'object' && item.productName !== null
            ? (item.productName as { fr: string }).fr
            : String(item.productName)
        const suppTotal = item.supplements?.reduce((s, x) => s + (x.price || 0), 0) ?? 0
        const lineRevenue = (item.unitPrice + suppTotal) * item.quantity
        if (!productMap[name]) productMap[name] = { qty: 0, revenue: 0 }
        productMap[name].qty += item.quantity
        productMap[name].revenue += lineRevenue
      }
    }
    const topProducts = Object.entries(productMap)
      .map(([name, d]) => ({ name, qty: d.qty, revenue: d.revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)

    // By day and by hour, on the shop's clock. A short bounded period lists
    // every day, closed ones as zero: a Monday with no sales is part of the
    // shape of the week, not a gap to close up.
    const dayMap = new Map<string, { revenue: number; count: number }>()
    if (from && to) {
      const days = daysBetween(from, to)
      if (days.length <= FILL_DAYS_UP_TO) for (const d of days) dayMap.set(d, { revenue: 0, count: 0 })
    }
    const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour, revenue: 0, count: 0 }))
    for (const o of orders) {
      const { day, hour } = clock(o.createdAt as Date)
      const net = orderNet(o)
      const entry = dayMap.get(day) ?? { revenue: 0, count: 0 }
      entry.revenue += net
      entry.count++
      dayMap.set(day, entry)
      byHour[hour].revenue += net
      byHour[hour].count++
    }
    const byDay = [...dayMap.entries()]
      .map(([date, d]) => ({ date, revenue: d.revenue, count: d.count }))
      .sort((a, b) => a.date.localeCompare(b.date))

    const byStatus = {
      pending: orders.filter((o) => o.status === 'pending').length,
      confirmed: orders.filter((o) => o.status === 'confirmed').length,
      preparing: orders.filter((o) => o.status === 'preparing').length,
      ready: orders.filter((o) => o.status === 'ready').length,
      delivered: orders.filter((o) => o.status === 'delivered').length,
    }

    const deliveryGross = delivery.reduce((s, o) => s + (o.total || 0), 0)
    const deliveryNet = byDeliveryCompany.reduce((s, c) => s + c.net, 0)
    const pickupRevenue = pickup.reduce((s, o) => s + (o.total || 0), 0)
    // What the restaurant actually receives: pickup in full, delivery after commission
    const netTotalRevenue = pickupRevenue + deliveryNet
    const avgOrder = orderCount > 0 ? netTotalRevenue / orderCount : 0

    // ── Ce que les plateformes doivent, et ce qu'elles ont versé ──────────
    // Deux mesures qui ne se recouvrent pas, et c'est voulu : `due` regarde les
    // commandes de la période, `payouts` les virements reçus pendant la même
    // période — lesquels soldent souvent la période d'avant. L'écart entre les
    // deux n'est pas une erreur, c'est le décalage de règlement lui-même.
    const payouts = (payoutDocs as Record<string, unknown>[]).map((p) => ({
      amount: Number(p.amount) || 0,
      expected: Number(p.expected) || 0,
      gap: Number(p.gap) || 0,
    }))
    // Où en est l'argent de la période, en deux nombres : ce qui est arrivé et
    // ce qui manque. Les espèces sont dans le tiroir, le TPE est payé sans y
    // être passé, une plateforme peut n'avoir encore rien versé. Même
    // répartition que la caisse (lib/platformSettlement), pour que la journée
    // et le mois racontent la même histoire.
    const pockets = { drawer: 0, bank: 0, platformPaid: 0, platformDue: 0, unknown: 0 }
    for (const o of orders) {
      const order = o as PlatformOrderLike
      const total = o.total || 0
      switch (moneyPocket(order)) {
        case 'drawer':
          pockets.drawer += total
          break
        case 'bank':
          pockets.bank += total
          break
        case 'platform': {
          const net = receivableOf(order)
          pockets.platformDue += net
          if (isPaid(order)) pockets.platformPaid += net
          break
        }
        default:
          pockets.unknown += total
      }
    }
    const encaissement = {
      paid: {
        cash: round2(pockets.drawer),
        /** Le TPE : payé, mais en banque — pas dans le tiroir. */
        card: round2(pockets.bank),
        platforms: round2(pockets.platformPaid),
        total: round2(pockets.drawer + pockets.bank + pockets.platformPaid),
      },
      unpaid: {
        platforms: round2(pockets.platformDue - pockets.platformPaid),
        /** Des ventes dont personne n'a noté le règlement. */
        unrecorded: round2(pockets.unknown),
        total: round2(pockets.platformDue - pockets.platformPaid + pockets.unknown),
      },
    }

    const platforms = {
      /** Le net encaissé par les plateformes sur les commandes de la période. */
      due: round2(byDeliveryCompany.reduce((s, c) => s + c.due, 0)),
      paid: {
        count: byDeliveryCompany.reduce((s, c) => s + c.paidCount, 0),
        net: round2(byDeliveryCompany.reduce((s, c) => s + c.paidNet, 0)),
      },
      unpaid: {
        count: byDeliveryCompany.reduce((s, c) => s + c.unpaidCount, 0),
        net: round2(byDeliveryCompany.reduce((s, c) => s + c.unpaidNet, 0)),
      },
      /** Les versements reçus pendant la période, quelle que soit leur période d'origine. */
      payouts: {
        count: payouts.length,
        amount: round2(payouts.reduce((s, p) => s + p.amount, 0)),
        expected: round2(payouts.reduce((s, p) => s + p.expected, 0)),
        gap: round2(payouts.reduce((s, p) => s + p.gap, 0)),
      },
    }

    // ── Mouvements de caisse ──────────────────────────────────────────────
    // Two families, deliberately kept apart. Achats and dépenses are money
    // gone: they come off the result. Apports and retraits only move cash
    // between the drawer and somewhere else — the change bought at midday,
    // the takings deposited at night. Folding the second family into the
    // first would turn a day of buying change into a day of spending.
    const total: Record<MovementKind, number> = { achat: 0, depense: 0, apport: 0, retrait: 0 }
    const count = { spent: 0, moved: 0 }
    const spentLabels = new Map<string, Tally>()
    const movedLabels = new Map<string, Tally>()

    for (const r of movementDocs as RecetteDoc[]) {
      for (const m of r.mouvements ?? []) {
        if (m.cancelledAt || !m.createdAt) continue
        const at = new Date(m.createdAt).getTime()
        if (!within(at)) continue
        if (!isMovementKind(m.kind)) continue
        const amount = Number(m.amount) || 0
        total[m.kind] += amount
        const spent = MOVEMENT_META[m.kind].expense
        if (spent) count.spent++
        else count.moved++
        tally(spent ? spentLabels : movedLabels, m.kind, m.label ?? '', amount, at)
      }
    }

    const sorties = {
      achats: round2(total.achat),
      depenses: round2(total.depense),
      total: round2(total.achat + total.depense),
      count: count.spent,
      byLabel: topLabels(spentLabels),
    }
    /** Cash that only changed place: the float topped up, the drawer emptied. */
    const fond = {
      apports: round2(total.apport),
      retraits: round2(total.retrait),
      /** Put in, less taken out — what the drawers hold beyond their sales. */
      net: round2(total.apport - total.retrait),
      count: count.moved,
      byLabel: topLabels(movedLabels),
    }

    // ── Recettes of the period and how their drawers came out ─────────────
    const recettes = await Promise.all(
      (recetteDocs as RecetteDoc[]).map(async (r) => {
        const t = await recetteTotals(r)
        return {
          _id: String(r._id),
          number: r.number ?? '',
          status: r.status === 'open' ? 'open' : 'closed',
          openedAt: r.openedAt ?? null,
          closedAt: r.closedAt ?? null,
          orders: t.orders,
          revenue: round2(t.revenue),
          net: round2(t.net),
          sorties: round2((t.achats ?? 0) + (t.depenses ?? 0)),
          fond: round2((t.apports ?? 0) - (t.retraits ?? 0)),
          openingFloat: r.openingFloat ?? 0,
          expected: round2((r.openingFloat ?? 0) + t.cashExpected),
          closingCash: typeof r.closingCash === 'number' ? r.closingCash : null,
          ecart: cashDifference(r, t),
        }
      })
    )
    const counted = recettes.filter((r) => r.ecart !== null)
    // Under half a centime, a drawer is right: rounded prices leave dust.
    const short = counted.filter((r) => (r.ecart ?? 0) < -0.005)
    const over = counted.filter((r) => (r.ecart ?? 0) > 0.005)
    const caisse = {
      sessions: recettes.length,
      open: recettes.filter((r) => r.status === 'open').length,
      counted: counted.length,
      ecartTotal: round2(counted.reduce((s, r) => s + (r.ecart ?? 0), 0)),
      manquants: { count: short.length, amount: round2(-short.reduce((s, r) => s + (r.ecart ?? 0), 0)) },
      excedents: { count: over.length, amount: round2(over.reduce((s, r) => s + (r.ecart ?? 0), 0)) },
    }

    return NextResponse.json({
      totalRevenue,
      netTotalRevenue,
      orderCount,
      avgOrder,
      byType: {
        delivery: { count: delivery.length, revenue: deliveryGross },
        pickup: { count: pickup.length, revenue: pickupRevenue },
      },
      deliverySummary: {
        gross: deliveryGross,
        commissionAmount: deliveryGross - deliveryNet,
        net: deliveryNet,
      },
      platforms,
      encaissement,
      bySource,
      byPayment,
      byDeliveryCompany,
      topProducts,
      byDay,
      byHour,
      byStatus,
      period: { from, to, tz },
      cancelled: {
        count: cancelledOrders.length,
        revenue: round2(cancelledOrders.reduce((s, o) => s + (o.total || 0), 0)),
      },
      sorties,
      fond,
      solde: round2(netTotalRevenue - sorties.total),
      recettes,
      caisse,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur serveur'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
