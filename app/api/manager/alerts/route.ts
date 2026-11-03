import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { User } from '@/lib/models/User'
import { Order } from '@/lib/models/Order'
import { Recette } from '@/lib/models/Recette'
import { getTokenFromRequest } from '@/lib/auth'
import { addDays, dayOf, startOfDay } from '@/lib/reportTime'
import { cashDifference, recetteTotals } from '@/lib/recette'
import {
  buildReport,
  computeAlerts,
  THRESHOLDS,
  type AlertOrder,
  type AlertRecette,
} from '@/lib/managerAlerts'

export const dynamic = 'force-dynamic'

/**
 * GET /api/manager/alerts?since=<ISO optional> — what needs the owner's eye.
 *
 * Read-only by construction: it runs none of the lazy sweeps (those write) and
 * asks lib/recette for closed-session figures without letting it persist the
 * legacy `platformCash` backfill. The rules live in lib/managerAlerts.
 *
 * « Today » is the shop's day in Africa/Tunis. Two kinds describe a state that
 * is true now rather than an event of the day — an order still pending, an
 * order past its deadline — so those also look back 7 days.
 *
 * Errors are `{ error, code }`: 401 unauthorized, 403 forbidden,
 * 400 bad_request, 500 server_error.
 */

const TZ = 'Africa/Tunis'
const LOOKBACK_DAYS = 7
const ALLOWED_ROLES = ['admin', 'manager']

const fail = (status: number, code: string, error: string) =>
  NextResponse.json({ error, code }, { status, headers: { 'Cache-Control': 'no-store' } })

const ISO = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:?\d{2})?)?$/

function parseSince(raw: string | null): Date | null | 'invalid' {
  if (raw === null) return null
  if (!ISO.test(raw)) return 'invalid'
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? 'invalid' : d
}

export async function GET(req: NextRequest) {
  try {
    // Who is asking — token first, then the account itself, as /api/auth/me does:
    // a closed account stops seeing alerts now, not when the token expires.
    const payload = getTokenFromRequest(req)
    if (!payload) return fail(401, 'unauthorized', 'Session expirée')

    await connectDB()
    const user = await User.findOne({ _id: payload.userId, isActive: true })
      .select('role')
      .lean<{ role?: string } | null>()
    if (!user) return fail(401, 'unauthorized', 'Compte introuvable')
    if (!ALLOWED_ROLES.includes(String(user.role))) return fail(403, 'forbidden', 'Accès réservé aux managers')

    const since = parseSince(req.nextUrl.searchParams.get('since'))
    if (since === 'invalid') return fail(400, 'bad_request', 'Paramètre since invalide : date ISO attendue')

    const now = new Date()
    const today = dayOf(now, TZ)
    const todayStart = startOfDay(today, TZ)
    const lookbackStart = startOfDay(addDays(today, -LOOKBACK_DAYS), TZ)

    const orders = (await Order.find({
      $or: [
        { status: { $in: ['pending', 'confirmed', 'preparing'] }, createdAt: { $gte: lookbackStart } },
        { createdAt: { $gte: todayStart } },
        { updatedAt: { $gte: todayStart } },
      ],
    })
      // No `customer` here: phone, address and email never leave the database.
      .select(
        'orderNumber status source type total createdAt updatedAt confirmedAt preparationDuration cancelledAt deliveredAt autoSettled recette'
      )
      .lean()) as unknown as AlertOrder[]

    const closed = (await Recette.find({
      status: 'closed',
      $or: [{ closedAt: { $gte: todayStart } }, { 'corrections.at': { $gte: todayStart } }],
    })
      .select('number status closedAt openingFloat closingCash totals mouvements corrections')
      .lean()) as unknown as (AlertRecette & {
      openingFloat?: number
      totals?: Parameters<typeof recetteTotals>[0]['totals']
      mouvements?: Parameters<typeof recetteTotals>[0]['mouvements']
    })[]

    const recettes: AlertRecette[] = []
    for (const r of closed) {
      let difference: number | null = null
      if (typeof r.closingCash === 'number') {
        const totals = await recetteTotals(
          { _id: r._id, status: r.status, closedAt: r.closedAt as Date | null | undefined, totals: r.totals, mouvements: r.mouvements },
          { persist: false }
        )
        difference = cashDifference({ openingFloat: r.openingFloat, closingCash: r.closingCash }, totals)
      }
      recettes.push({
        _id: r._id,
        number: r.number,
        status: r.status,
        closedAt: r.closedAt,
        closingCash: r.closingCash ?? null,
        cashDifference: difference,
        corrections: r.corrections,
      })
    }

    const report = buildReport(computeAlerts({ orders, recettes, now, todayStart }), { since })

    return NextResponse.json(
      {
        generatedAt: now.toISOString(),
        window: { from: todayStart.toISOString(), to: now.toISOString(), tz: TZ },
        thresholds: THRESHOLDS,
        counts: report.counts,
        truncated: report.truncated,
        alerts: report.alerts,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch {
    return fail(500, 'server_error', 'Erreur serveur')
  }
}
