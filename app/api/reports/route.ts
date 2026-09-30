import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { Recette } from '@/lib/models/Recette'
import { recetteTotals } from '@/lib/recette'
import { daysBetween, isDay, nextDay, safeTimeZone, startOfDay } from '@/lib/reportTime'

/**
 * GET /api/reports?from=YYYY-MM-DD&to=YYYY-MM-DD&tz=Africa/Tunis
 *
 * Aggregates till sessions (recettes) into a period report. Closed sessions
 * keep their frozen totals; open ones are live.
 */

const round2 = (n: number) => Math.round(n * 100) / 100

type CompanyTally = {
  name: string
  count: number
  revenue: number
  net: number
  commission: number
  due: number
  paidNet: number
  paidCount: number
  unpaidNet: number
  unpaidCount: number
}

export async function GET(req: NextRequest) {
  try {
    await connectDB()
    const { searchParams } = new URL(req.url)
    const tz = safeTimeZone(searchParams.get('tz'))
    const fromParam = searchParams.get('from')
    const toParam = searchParams.get('to')
    const from = isDay(fromParam) ? fromParam : null
    const to = isDay(toParam) ? toParam : null

    const range: { $gte?: Date; $lt?: Date } = {}
    if (from) range.$gte = startOfDay(from, tz)
    if (to) range.$lt = startOfDay(nextDay(to), tz)

    const recettes = await Recette.find(range.$gte || range.$lt ? { openedAt: range } : {})
      .sort({ openedAt: 1 })
      .lean()

    const withTotals = await Promise.all(
      recettes.map(async (r) => ({ ...r, totals: await recetteTotals(r) }))
    )

    const totals = withTotals.reduce(
      (acc, r) => {
        const t = r.totals ?? {
          orders: 0,
          cancelled: 0,
          inProgress: 0,
          revenue: 0,
          net: 0,
          byType: { delivery: { count: 0, revenue: 0 }, pickup: { count: 0, revenue: 0 } },
          bySource: {},
          byCompany: [],
          commission: 0,
          cashSales: 0,
          cardSales: 0,
          achats: 0,
          depenses: 0,
          apports: 0,
          retraits: 0,
          platformDue: 0,
          platformPaid: 0,
          unsettled: 0,
          collected: 0,
          receivable: 0,
          cashExpected: 0,
          solde: 0,
        }

        acc.orderCount += t.orders
        acc.cancelledCount += t.cancelled
        acc.totalRevenue += t.revenue
        acc.netRevenue += t.net
        acc.commission += t.commission
        acc.cashSales += t.cashSales ?? 0
        acc.cardSales += t.cardSales ?? 0
        acc.achats += t.achats ?? 0
        acc.depenses += t.depenses ?? 0
        acc.apports += t.apports ?? 0
        acc.retraits += t.retraits ?? 0
        acc.platformDue += t.platformDue ?? 0
        acc.platformPaid += t.platformPaid ?? 0
        acc.unsettled += t.unsettled ?? 0
        acc.collected += t.collected ?? 0
        acc.receivable += t.receivable ?? 0

        if (t.byType) {
          acc.byType.delivery.count += t.byType.delivery.count
          acc.byType.delivery.revenue += t.byType.delivery.revenue
          acc.byType.pickup.count += t.byType.pickup.count
          acc.byType.pickup.revenue += t.byType.pickup.revenue
        }

        if (t.bySource) {
          for (const [key, bucket] of Object.entries(t.bySource) as [
            key: string,
            bucket: { count: number; revenue: number; net: number }
          ][]) {
            if (!acc.bySource[key]) acc.bySource[key] = { count: 0, revenue: 0, net: 0 }
            acc.bySource[key].count += bucket.count
            acc.bySource[key].revenue += bucket.revenue
            acc.bySource[key].net += bucket.net
          }
        }

        for (const c of (t.byCompany ?? []) as Array<{ name: string; count: number; revenue: number; net: number; commission: number; due: number; settled: number; cash: number }>) {
          const existing = acc.companies.find((x: CompanyTally) => x.name === c.name)
          if (existing) {
            existing.count += c.count
            existing.revenue += c.revenue
            existing.net += c.net
            existing.commission = c.commission
            existing.due += c.due
            existing.paidNet += c.settled
            existing.paidCount += c.cash > 0 ? 1 : 0
            existing.unpaidNet += c.due - c.settled
            existing.unpaidCount += c.due - c.settled > 0 ? 1 : 0
          } else {
            acc.companies.push({
              name: c.name,
              count: c.count,
              revenue: c.revenue,
              commission: c.commission,
              net: c.net,
              due: c.due,
              paidNet: c.settled,
              paidCount: c.cash > 0 ? 1 : 0,
              unpaidNet: c.due - c.settled,
              unpaidCount: c.due - c.settled > 0 ? 1 : 0,
            })
          }
        }

        for (const m of r.mouvements ?? []) {
          if (m.cancelledAt || !m.createdAt) continue
          const at = new Date(m.createdAt).getTime()
          if (range.$gte && at < range.$gte.getTime()) continue
          if (range.$lt && at >= range.$lt.getTime()) continue
          const kind = m.kind
          const amount = Number(m.amount) || 0
          if (kind === 'achat') acc.achats += amount
          else if (kind === 'depense') acc.depenses += amount
          else if (kind === 'apport') acc.apports += amount
          else if (kind === 'retrait') acc.retraits += amount
        }

        return acc
      },
      {
        orderCount: 0,
        cancelledCount: 0,
        totalRevenue: 0,
        netRevenue: 0,
        commission: 0,
        byType: { delivery: { count: 0, revenue: 0 }, pickup: { count: 0, revenue: 0 } },
        bySource: {} as Record<string, { count: number; revenue: number; net: number }>,
        companies: [] as CompanyTally[],
        achats: 0,
        depenses: 0,
        apports: 0,
        retraits: 0,
        cashSales: 0,
        cardSales: 0,
        platformDue: 0,
        platformPaid: 0,
        unsettled: 0,
        collected: 0,
        receivable: 0,
      }
    )

    const companies = totals.companies
      .map((c: CompanyTally) => ({
        ...c,
        commissionAmount: round2(c.revenue - c.net),
        paidNet: round2(c.paidNet),
        unpaidNet: round2(c.unpaidNet),
      }))
      .sort((a: { revenue: number }, b: { revenue: number }) => b.revenue - a.revenue)

    const avgOrder = totals.orderCount > 0 ? round2(totals.netRevenue / totals.orderCount) : 0
    const sortiesTotal = round2(totals.achats + totals.depenses)
    const solde = round2(totals.netRevenue - sortiesTotal)

    return NextResponse.json({
      totalRevenue: round2(totals.totalRevenue),
      netTotalRevenue: round2(totals.netRevenue),
      orderCount: totals.orderCount,
      avgOrder,
      byType: totals.byType,
      deliverySummary: {
        gross: round2(totals.byType.delivery.revenue),
        commissionAmount: round2(totals.commission),
        net: round2(totals.byType.delivery.revenue - totals.commission),
      },
      bySource: totals.bySource,
      byDeliveryCompany: companies,
      byPayment: {
        cash: { count: 0, revenue: round2(totals.cashSales) },
        card: { count: 0, revenue: round2(totals.cardSales) },
        other: { count: 0, revenue: 0 },
        unknown: { count: 0, revenue: round2(totals.unsettled) },
      },
      topProducts: [],
      byDay: [],
      byHour: [],
      byStatus: {
        pending: 0,
        confirmed: 0,
        preparing: 0,
        ready: 0,
        delivered: 0,
      },
      period: { from, to, tz },
      cancelled: {
        count: totals.cancelledCount,
        revenue: 0,
      },
      sorties: {
        achats: round2(totals.achats),
        depenses: round2(totals.depenses),
        total: sortiesTotal,
        count: 0,
        byLabel: [],
      },
      fond: {
        apports: round2(totals.apports),
        retraits: round2(totals.retraits),
        net: round2(totals.apports - totals.retraits),
        count: 0,
        byLabel: [],
      },
      solde,
      recettes: withTotals.map((r) => ({
        _id: String(r._id),
        number: r.number,
        status: r.status === 'open' ? 'open' : 'closed',
        openedAt: r.openedAt,
        closedAt: r.closedAt,
        orders: r.totals?.orders ?? 0,
        revenue: round2(r.totals?.revenue ?? 0),
        net: round2(r.totals?.net ?? 0),
        sorties: round2((r.totals?.achats ?? 0) + (r.totals?.depenses ?? 0)),
        fond: round2((r.totals?.apports ?? 0) - (r.totals?.retraits ?? 0)),
        openingFloat: r.openingFloat ?? 0,
        expected: round2((r.openingFloat ?? 0) + (r.totals?.cashExpected ?? 0)),
        closingCash: typeof r.closingCash === 'number' ? r.closingCash : null,
        ecart: null,
      })),
      caisse: {
        sessions: withTotals.length,
        open: withTotals.filter((r) => r.status === 'open').length,
        counted: withTotals.filter((r) => typeof r.closingCash === 'number').length,
        ecartTotal: 0,
        manquants: { count: 0, amount: 0 },
        excedents: { count: 0, amount: 0 },
      },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur serveur'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
