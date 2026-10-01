import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { getTokenFromRequest } from '@/lib/auth'
import { Order } from '@/lib/models/Order'
import { Recette } from '@/lib/models/Recette'
import { recetteTotals, type RecetteTotals } from '@/lib/recette'
import { buildRecetteReport, type ReportRecetteDoc } from '@/lib/recetteReport'
import { companyOf, isPaid, moneyPocket, netOf, type PlatformOrderLike } from '@/lib/platformSettlement'
import { dayOf, isDay, nextDay, safeTimeZone, startOfDay } from '@/lib/reportTime'

/**
 * GET /api/reports?from=YYYY-MM-DD&to=YYYY-MM-DD&tz=Africa/Tunis
 *
 * Le rapport d'une période, recette par recette — voir lib/recetteReport pour
 * la règle : une recette appartient au jour où elle a été ouverte, entière, et
 * le rapport est la somme exacte de ses recettes.
 *
 * Deux questions que les recettes seules ne savent pas poser, et que la route
 * ajoute à côté, jamais dans les totaux :
 *
 *   — des commandes ont-elles été prises caisse fermée ? Elles ne sont dans
 *     aucune recette, donc dans aucun tiroir. On les compte pour les montrer.
 *   — les plateformes ont-elles payé depuis ? Une recette close garde ce
 *     qu'on savait le soir de sa clôture ; le gérant veut aussi savoir ce qui
 *     reste dû aujourd'hui.
 *
 * Réservé au back-office : ce sont les comptes du restaurant. La caisse a ses
 * propres routes (/api/recettes) et ne lit pas celle-ci.
 */

/** Plus d'un an de recettes, c'est une archive, pas un rapport. */
const MAX_DAYS = 400
/** Deux services par jour sur plus d'un an. Au-delà, le rapport le dit. */
const MAX_RECETTES = 1000

const round2 = (n: number) => Math.round(n * 100) / 100

export async function GET(req: NextRequest) {
  if (!getTokenFromRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await connectDB()
    const { searchParams } = new URL(req.url)
    const tz = safeTimeZone(searchParams.get('tz'))
    const today = dayOf(new Date(), tz)
    const fromParam = searchParams.get('from')
    const toParam = searchParams.get('to')
    let from = isDay(fromParam) ? fromParam : today
    let to = isDay(toParam) ? toParam : from
    if (from > to) [from, to] = [to, from]
    // Une période trop longue garde sa fin : c'est le récent qu'on vient voir.
    const cap = new Date(`${to}T00:00:00Z`)
    cap.setUTCDate(cap.getUTCDate() - (MAX_DAYS - 1))
    const earliest = cap.toISOString().slice(0, 10)
    if (from < earliest) from = earliest

    const range = { $gte: startOfDay(from, tz), $lt: startOfDay(nextDay(to), tz) }

    const docs = (await Recette.find({ openedAt: range })
      .sort({ openedAt: 1 })
      .limit(MAX_RECETTES + 1)
      .lean()) as (ReportRecetteDoc & { totals?: RecetteTotals | null })[]
    const truncated = docs.length > MAX_RECETTES
    if (truncated) docs.length = MAX_RECETTES

    const ids = docs.map((d) => d._id)

    const [inputs, orphanAgg, platformOrders] = await Promise.all([
      // Une recette close rend ses totaux figés sans requête ; seule celle qui
      // tourne encore va chercher ses commandes.
      Promise.all(
        docs.map(async (doc) => ({
          doc,
          totals: await recetteTotals(doc),
        }))
      ),
      Order.aggregate([
        { $match: { createdAt: range, recette: null, status: { $ne: 'cancelled' } } },
        { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: '$total' } } },
      ]),
      // Seules les commandes portées par une plateforme peuvent encore être dues.
      ids.length
        ? Order.find({
            recette: { $in: ids },
            status: { $ne: 'cancelled' },
            'deliveryCompany.name': { $nin: [null, ''] },
          })
            .select('type status source total payment deliveryCompany')
            .lean()
        : Promise.resolve([]),
    ])

    const report = buildRecetteReport(inputs, { from, to, tz, truncated })

    report.orphans = {
      count: orphanAgg[0]?.count ?? 0,
      revenue: round2(orphanAgg[0]?.revenue ?? 0),
    }

    // Même arbitrage que la clôture (lib/platformSettlement) : une commande
    // Glovo payée en espèces au livreur n'est pas due, quoi qu'on en dise.
    const outstanding = new Map<string, number>()
    for (const order of platformOrders as PlatformOrderLike[]) {
      if (moneyPocket(order) !== 'platform' || isPaid(order)) continue
      const name = companyOf(order)
      outstanding.set(name, (outstanding.get(name) ?? 0) + netOf(order))
    }
    for (const company of report.byCompany) {
      company.outstandingNow = round2(outstanding.get(company.name) ?? 0)
    }
    // Le total part des commandes, pas du tableau : une recette close avant le
    // détail par plateforme n'a pas de ligne, mais ses commandes restent dues.
    report.platformsOutstandingNow = round2([...outstanding.values()].reduce((s, n) => s + n, 0))

    return NextResponse.json(report, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur serveur'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
