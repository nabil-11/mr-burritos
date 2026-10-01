import { connectDB } from './mongodb'
import { Order } from './models/Order'
import { Recette } from './models/Recette'
import { Review } from './models/Review'
import { Reservation } from './models/Reservation'
import { cashDifference, cashInDrawer, recetteTotals, type RecetteTotals } from './recette'
import { ORDER_SOURCES, type OrderSource } from './orderSource'
import { OPENING_HOURS, TIMEZONE, openStateAt } from './hours'
import { autoReadyOnSiteOrders, autoSettleOverdueOrders, readyDeadline } from './orderTimers'
import { ageInDays, companyOf, isPaid, moneyPocket, netOf, type PlatformOrderLike } from './platformSettlement'
import { addDays, dayOf, hourOf, nextDay, startOfDay } from './reportTime'

/**
 * Le tableau de bord : ce qui se passe maintenant, et ce qui demande une main.
 *
 * Le rapport (/reports) répond à « combien sur la période ? », recette par
 * recette, une fois les chiffres posés. Ici la question est celle du service en
 * cours : est-ce qu'on vend plus ou moins que d'habitude, qu'est-ce qui attend
 * en cuisine, la caisse est-elle ouverte, qui nous doit de l'argent ?
 *
 * Trois partis pris :
 *
 *   — **Aujourd'hui, c'est le jour de Tunis**, pas celui du serveur (UTC).
 *     Une commande de 00:30 appartient à la nuit qui commence, pas à la veille.
 *
 *   — **Une comparaison n'est juste qu'à heure égale.** À 14 h, comparer la
 *     journée entamée à toute la journée de mardi dernier dit toujours « en
 *     baisse ». On compare donc au même jour de la semaine passée, arrêté à la
 *     même heure — le seul repère qui tienne compte du rythme de la semaine.
 *
 *   — **Les ventes se comptent depuis les commandes**, annulées exclues, qu'une
 *     caisse soit ouverte ou non : une vente prise caisse fermée reste une
 *     vente. C'est justement ce qui la rend digne d'une alerte.
 */

const tz = TIMEZONE
const round2 = (n: number) => Math.round(n * 100) / 100

/** Les statuts d'une commande qui n'est pas encore partie. */
export const ACTIVE_STATUSES = ['pending', 'confirmed', 'preparing', 'ready'] as const
export type ActiveStatus = (typeof ACTIVE_STATUSES)[number]

/** Au-delà, une commande non acceptée fait attendre un client qui ne sait rien. */
export const PENDING_ALERT_MIN = 10
/** Au-delà, une créance plateforme mérite qu'on aille la réclamer. */
export const RECEIVABLE_ALERT_DAYS = 14

export interface Totals {
  orders: number
  revenue: number
  avgTicket: number
}

export interface HourPoint {
  hour: number
  orders: number
  revenue: number
  /** Le même jour la semaine passée, journée complète : la forme habituelle du service. */
  lastWeekRevenue: number
  lastWeekOrders: number
  /** Heure pas encore arrivée : la barre du jour n'existe pas encore. */
  future: boolean
}

export interface DayPoint {
  day: string
  orders: number
  revenue: number
}

export interface PassItem {
  id: string
  orderNumber: string
  customer: string
  type: string
  source: string
  status: ActiveStatus
  total: number
  createdAt: string
  /** Minutes depuis la prise de commande. */
  ageMin: number
  /** Minutes avant (positif) ou après (négatif) l'heure promise, si une minuterie court. */
  dueInMin: number | null
  late: boolean
  /** Prise un autre jour : probablement oubliée. */
  stale: boolean
}

export type Alert = {
  level: 'critical' | 'warning' | 'info'
  title: string
  detail?: string
  href: string
  action: string
}

export interface Dashboard {
  now: string
  today: string
  shop: { open: boolean; at: string }
  sales: Totals & {
    cancelled: number
    bySource: Record<OrderSource | 'unknown', { count: number; revenue: number }>
    byType: Record<'delivery' | 'pickup', { count: number; revenue: number }>
  }
  /** Même jour, semaine passée, arrêté à la même heure. */
  sameTimeLastWeek: Totals
  hours: HourPoint[]
  /** Les 14 derniers jours, aujourd'hui compris (entamé). */
  days: DayPoint[]
  /** 7 jours glissants contre les 7 précédents, chacun arrêté à l'heure actuelle. */
  week: { current: Totals; previous: Totals }
  pass: {
    counts: Record<ActiveStatus, number>
    total: number
    late: number
    stale: number
    oldestPendingMin: number | null
    items: PassItem[]
  }
  till:
    | {
        open: true
        id: string
        number: string
        openedAt: string
        openedBy: string
        totals: Pick<RecetteTotals, 'orders' | 'revenue' | 'collected' | 'receivable' | 'achats' | 'depenses' | 'cashSales' | 'cardSales'>
        cashInDrawer: number
      }
    | { open: false }
  /** Commandes du jour prises sans caisse ouverte. */
  outsideTill: { count: number; revenue: number }
  platforms: {
    outstanding: number
    orders: number
    oldestDays: number
    byCompany: { name: string; amount: number; orders: number; oldestDays: number }[]
  }
  /** Clôtures des 7 derniers jours qui posent question. */
  caisse: {
    closed: number
    uncounted: { id: string; number: string }[]
    shortages: { id: string; number: string; ecart: number }[]
  }
  topProducts: { scope: 'today' | 'week'; items: { name: string; quantity: number; revenue: number }[] }
  reviewsPending: number
  reservations: { id: string; time: string; name: string; guests: number; status: string }[]
  alerts: Alert[]
}

type OrderLite = {
  _id: unknown
  orderNumber?: string
  customer?: { name?: string }
  status?: string
  type?: string
  source?: string
  total?: number
  createdAt?: Date
  confirmedAt?: Date | null
  preparationDuration?: number
  recette?: unknown
  items?: { product?: unknown; productName?: { fr?: string; ar?: string }; quantity?: number; unitPrice?: number }[]
}

const totalsOf = (orders: number, revenue: number): Totals => ({
  orders,
  revenue: round2(revenue),
  avgTicket: orders > 0 ? round2(revenue / orders) : 0,
})

const fromAgg = (agg: { orders?: number; revenue?: number }[]) =>
  totalsOf(agg[0]?.orders ?? 0, agg[0]?.revenue ?? 0)

const notCancelled = { status: { $ne: 'cancelled' } }

/**
 * Les heures d'ouverture du jour, plus toute heure qui a vu une vente. Une
 * vente à 00:30 garde sa place en tête d'axe, sans dérouler les heures creuses
 * de la matinée jusqu'à l'ouverture.
 */
function hourSpan(day: string, seen: number[]): number[] {
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay()
  const slot = OPENING_HOURS[weekday] ?? { open: 11, close: 23 }
  const hours = new Set<number>(seen)
  for (let h = slot.open; h < Math.min(slot.close, 24); h++) hours.add(h)
  return [...hours].sort((a, b) => a - b)
}

/** Les plus vendus, quantité d'abord : c'est ce que la cuisine prépare. */
function topProductsOf(orders: OrderLite[]) {
  const map = new Map<string, { name: string; quantity: number; revenue: number }>()
  for (const o of orders) {
    if (o.status === 'cancelled') continue
    for (const it of o.items ?? []) {
      const name = it.productName?.fr || it.productName?.ar || '—'
      const key = it.product ? String(it.product) : name
      const entry = map.get(key) ?? { name, quantity: 0, revenue: 0 }
      const q = Number(it.quantity) || 0
      entry.quantity += q
      entry.revenue += (Number(it.unitPrice) || 0) * q
      map.set(key, entry)
    }
  }
  return [...map.values()]
    .map((p) => ({ ...p, revenue: round2(p.revenue) }))
    .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
    .slice(0, 6)
}

/** La cuisine et le comptoir : ce qui attend, le plus urgent d'abord. */
export function passOf(active: OrderLite[], now: Date, today: string): Dashboard['pass'] {
  const counts = { pending: 0, confirmed: 0, preparing: 0, ready: 0 } as Record<ActiveStatus, number>
  let oldestPendingMin: number | null = null
  const items: PassItem[] = []

  for (const o of active) {
    const status = o.status as ActiveStatus
    if (!(ACTIVE_STATUSES as readonly string[]).includes(status) || !o.createdAt) continue
    counts[status]++
    const ageMin = Math.max(0, Math.floor((now.getTime() - new Date(o.createdAt).getTime()) / 60_000))
    let dueInMin: number | null = null
    if (status === 'confirmed' || status === 'preparing') {
      const deadline = readyDeadline(o.confirmedAt ?? o.createdAt, o.preparationDuration)
      if (deadline) dueInMin = Math.round((deadline.getTime() - now.getTime()) / 60_000)
    }
    if (status === 'pending') oldestPendingMin = Math.max(oldestPendingMin ?? 0, ageMin)
    const stale = dayOf(o.createdAt, tz) !== today
    items.push({
      id: String(o._id),
      orderNumber: o.orderNumber ?? '',
      customer: o.customer?.name ?? '',
      type: o.type ?? '',
      source: o.source ?? '',
      status,
      total: round2(o.total || 0),
      createdAt: new Date(o.createdAt).toISOString(),
      ageMin,
      dueInMin,
      late: (status === 'pending' && ageMin >= PENDING_ALERT_MIN) || (dueInMin !== null && dueInMin < 0),
      stale,
    })
  }

  // À accepter d'abord — personne d'autre ne le fera —, puis les retards, puis
  // l'ancienneté. Les oubliées des jours passés ferment la marche : elles
  // encombrent, elles n'ont plus d'urgence.
  const rank = (i: PassItem) => (i.stale ? 3 : i.status === 'pending' ? 0 : i.late ? 1 : 2)
  items.sort((a, b) => rank(a) - rank(b) || b.ageMin - a.ageMin)

  return {
    counts,
    total: items.length,
    // Une commande non acceptée a déjà son alerte « à accepter » : la compter
    // ici aussi la signalerait deux fois.
    late: items.filter((i) => i.late && !i.stale && i.status !== 'pending').length,
    stale: items.filter((i) => i.stale).length,
    oldestPendingMin,
    items: items.slice(0, 8),
  }
}

export async function getDashboard(now = new Date()): Promise<Dashboard> {
  await connectDB()
  // Les mêmes balayages que la liste des commandes : une commande dont la
  // minuterie a expiré est « prête », pas « en retard » — sans eux, le tableau
  // de bord crierait au retard sur des commandes déjà servies.
  await autoReadyOnSiteOrders()
  await autoSettleOverdueOrders()

  const today = dayOf(now, tz)
  const todayStart = startOfDay(today, tz)
  const tomorrowStart = startOfDay(nextDay(today), tz)
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000)
  const lastWeekDay = addDays(today, -7)
  const lastWeekStart = startOfDay(lastWeekDay, tz)
  const lastWeekEnd = startOfDay(addDays(today, -6), tz)
  const days14Start = startOfDay(addDays(today, -13), tz)
  const week7Start = startOfDay(addDays(today, -6), tz)

  const [
    todayOrders,
    sameTimeAgg,
    lastWeekHours,
    dailyAgg,
    prevWeekAgg,
    active,
    openRecette,
    platformOrders,
    recentClosed,
    reviewsPending,
    reservations,
  ] = await Promise.all([
    Order.find({ createdAt: { $gte: todayStart, $lt: tomorrowStart } })
      .select('status type source total items.product items.productName items.quantity items.unitPrice recette createdAt')
      .lean() as Promise<OrderLite[]>,
    Order.aggregate([
      { $match: { ...notCancelled, createdAt: { $gte: lastWeekStart, $lt: weekAgo } } },
      { $group: { _id: null, orders: { $sum: 1 }, revenue: { $sum: '$total' } } },
    ]),
    Order.aggregate([
      { $match: { ...notCancelled, createdAt: { $gte: lastWeekStart, $lt: lastWeekEnd } } },
      { $group: { _id: { $hour: { date: '$createdAt', timezone: tz } }, orders: { $sum: 1 }, revenue: { $sum: '$total' } } },
    ]),
    Order.aggregate([
      { $match: { ...notCancelled, createdAt: { $gte: days14Start, $lt: tomorrowStart } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: tz } },
          orders: { $sum: 1 },
          revenue: { $sum: '$total' },
        },
      },
    ]),
    // Les 7 jours d'avant, arrêtés à la même heure qu'aujourd'hui.
    Order.aggregate([
      { $match: { ...notCancelled, createdAt: { $gte: days14Start, $lt: weekAgo } } },
      { $group: { _id: null, orders: { $sum: 1 }, revenue: { $sum: '$total' } } },
    ]),
    Order.find({ status: { $in: ACTIVE_STATUSES } })
      .sort({ createdAt: 1 })
      .limit(200)
      .select('orderNumber customer.name status type source total createdAt confirmedAt preparationDuration')
      .lean() as Promise<OrderLite[]>,
    Recette.findOne({ status: 'open' }).lean(),
    // Seules les commandes plateforme non pointées peuvent encore être dues.
    Order.find({
      ...notCancelled,
      'deliveryCompany.name': { $nin: [null, ''] },
      'deliveryCompany.paid': { $ne: true },
    })
      .select('type status source total payment deliveryCompany createdAt')
      .lean(),
    Recette.find({ status: 'closed', closedAt: { $gte: new Date(now.getTime() - 7 * 86_400_000) } })
      .sort({ closedAt: -1 })
      .lean(),
    Review.countDocuments({ isApproved: false }),
    Reservation.find({ date: { $gte: todayStart, $lt: tomorrowStart }, status: { $ne: 'cancelled' } })
      .sort({ time: 1 })
      .limit(20)
      .lean(),
  ])

  // ── Ventes du jour ───────────────────────────────────────────
  const bySource = {} as Dashboard['sales']['bySource']
  for (const key of [...ORDER_SOURCES, 'unknown'] as const) bySource[key] = { count: 0, revenue: 0 }
  const byType = { delivery: { count: 0, revenue: 0 }, pickup: { count: 0, revenue: 0 } }
  const hourMap = new Map<number, { orders: number; revenue: number }>()
  let orders = 0
  let revenue = 0
  let cancelled = 0
  const outsideTill = { count: 0, revenue: 0 }

  for (const o of todayOrders) {
    if (o.status === 'cancelled') {
      cancelled++
      continue
    }
    const total = o.total || 0
    orders++
    revenue += total
    const src = (ORDER_SOURCES as readonly string[]).includes(String(o.source)) ? (o.source as OrderSource) : 'unknown'
    bySource[src].count++
    bySource[src].revenue += total
    const type = o.type === 'delivery' ? 'delivery' : 'pickup'
    byType[type].count++
    byType[type].revenue += total
    if (o.createdAt) {
      const h = hourOf(o.createdAt, tz)
      const point = hourMap.get(h) ?? { orders: 0, revenue: 0 }
      point.orders++
      point.revenue += total
      hourMap.set(h, point)
    }
    if (!o.recette) {
      outsideTill.count++
      outsideTill.revenue += total
    }
  }
  for (const b of [...Object.values(bySource), ...Object.values(byType)]) b.revenue = round2(b.revenue)
  outsideTill.revenue = round2(outsideTill.revenue)

  const lastWeekMap = new Map<number, { orders: number; revenue: number }>(
    (lastWeekHours as { _id: number; orders: number; revenue: number }[]).map((h) => [h._id, h])
  )
  const nowHour = hourOf(now, tz)
  const hours = hourSpan(today, [...hourMap.keys(), ...lastWeekMap.keys()]).map((hour) => ({
    hour,
    orders: hourMap.get(hour)?.orders ?? 0,
    revenue: round2(hourMap.get(hour)?.revenue ?? 0),
    lastWeekOrders: lastWeekMap.get(hour)?.orders ?? 0,
    lastWeekRevenue: round2(lastWeekMap.get(hour)?.revenue ?? 0),
    future: hour > nowHour,
  }))

  // ── Tendance ─────────────────────────────────────────────────
  const dailyMap = new Map((dailyAgg as { _id: string; orders: number; revenue: number }[]).map((d) => [d._id, d]))
  const days: DayPoint[] = []
  for (let i = 13; i >= 0; i--) {
    const day = addDays(today, -i)
    days.push({ day, orders: dailyMap.get(day)?.orders ?? 0, revenue: round2(dailyMap.get(day)?.revenue ?? 0) })
  }
  const last7 = days.slice(7)
  const week7Revenue = last7.reduce((s, d) => s + d.revenue, 0)
  const week7Orders = last7.reduce((s, d) => s + d.orders, 0)

  // ── Caisse ───────────────────────────────────────────────────
  let till: Dashboard['till'] = { open: false }
  if (openRecette) {
    const r = openRecette as {
      _id: unknown
      number?: string
      openedAt?: Date
      openedBy?: { name?: string }
      openingFloat?: number
      status?: string
      mouvements?: never[]
    }
    const t = await recetteTotals(r)
    till = {
      open: true,
      id: String(r._id),
      number: r.number ?? '',
      openedAt: r.openedAt ? new Date(r.openedAt).toISOString() : '',
      openedBy: r.openedBy?.name ?? '',
      totals: {
        orders: t.orders,
        revenue: t.revenue,
        collected: t.collected,
        receivable: t.receivable,
        achats: t.achats,
        depenses: t.depenses,
        cashSales: t.cashSales,
        cardSales: t.cardSales,
      },
      cashInDrawer: cashInDrawer(r, t),
    }
  }

  // ── Plateformes ──────────────────────────────────────────────
  // Même arbitrage que la clôture : une commande Glovo payée en espèces au
  // livreur est déjà dans le tiroir, elle n'est pas due.
  const companies = new Map<string, { name: string; amount: number; orders: number; oldestDays: number }>()
  for (const o of platformOrders as (PlatformOrderLike & { createdAt?: Date })[]) {
    if (moneyPocket(o) !== 'platform' || isPaid(o)) continue
    const name = companyOf(o)
    const c = companies.get(name) ?? { name, amount: 0, orders: 0, oldestDays: 0 }
    c.amount += netOf(o)
    c.orders++
    c.oldestDays = Math.max(c.oldestDays, ageInDays(o.createdAt, now))
    companies.set(name, c)
  }
  const byCompany = [...companies.values()]
    .map((c) => ({ ...c, amount: round2(c.amount) }))
    .sort((a, b) => b.amount - a.amount)
  const platforms = {
    outstanding: round2(byCompany.reduce((s, c) => s + c.amount, 0)),
    orders: byCompany.reduce((s, c) => s + c.orders, 0),
    oldestDays: byCompany.reduce((m, c) => Math.max(m, c.oldestDays), 0),
    byCompany,
  }

  // ── Clôtures récentes ────────────────────────────────────────
  const caisse: Dashboard['caisse'] = { closed: recentClosed.length, uncounted: [], shortages: [] }
  for (const doc of recentClosed as {
    _id: unknown
    number?: string
    status?: string
    openingFloat?: number
    closingCash?: number | null
    totals?: RecetteTotals | null
  }[]) {
    const totals = await recetteTotals(doc) // close : figée, aucune requête
    const gap = cashDifference(doc, totals)
    if (gap === null) caisse.uncounted.push({ id: String(doc._id), number: doc.number ?? '' })
    else if (gap <= -0.005) caisse.shortages.push({ id: String(doc._id), number: doc.number ?? '', ecart: gap })
  }

  // ── Top produits ─────────────────────────────────────────────
  let topProducts: Dashboard['topProducts'] = { scope: 'today', items: topProductsOf(todayOrders) }
  if (topProducts.items.length === 0) {
    // Avant le premier client, la semaine dit ce qui va partir.
    const week = (await Order.find({ ...notCancelled, createdAt: { $gte: week7Start, $lt: todayStart } })
      .select('status items.product items.productName items.quantity items.unitPrice')
      .lean()) as OrderLite[]
    topProducts = { scope: 'week', items: topProductsOf(week) }
  }

  const pass = passOf(active, now, today)
  const shop = openStateAt(now)
  const sales = { ...totalsOf(orders, revenue), cancelled, bySource, byType }

  const dashboard: Dashboard = {
    now: now.toISOString(),
    today,
    shop,
    sales,
    sameTimeLastWeek: fromAgg(sameTimeAgg),
    hours,
    days,
    week: { current: totalsOf(week7Orders, week7Revenue), previous: fromAgg(prevWeekAgg) },
    pass,
    till,
    outsideTill,
    platforms,
    caisse,
    topProducts,
    reviewsPending,
    reservations: (reservations as {
      _id: unknown
      time?: string
      customer?: { name?: string }
      guests?: number
      status?: string
    }[]).map((r) => ({
      id: String(r._id),
      time: r.time ?? '',
      name: r.customer?.name ?? '',
      guests: r.guests ?? 0,
      status: r.status ?? 'pending',
    })),
    alerts: [],
  }
  dashboard.alerts = alertsOf(dashboard)
  return dashboard
}

/** Ce qui demande une main, le plus pressant d'abord. Rien d'autre. */
export function alertsOf(d: Dashboard): Alert[] {
  const alerts: Alert[] = []
  const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`

  if (d.pass.counts.pending > 0) {
    const old = d.pass.oldestPendingMin ?? 0
    alerts.push({
      level: old >= PENDING_ALERT_MIN ? 'critical' : 'warning',
      title: `${plural(d.pass.counts.pending, 'commande')} à accepter`,
      detail: old > 0 ? `La plus ancienne attend depuis ${old} min.` : 'Elle vient d’arriver.',
      href: '/orders',
      action: 'Ouvrir les commandes',
    })
  }
  if (d.pass.late > 0) {
    alerts.push({
      level: 'warning',
      title: `${plural(d.pass.late, 'commande')} en retard`,
      detail: 'L’heure promise est dépassée.',
      href: '/orders',
      action: 'Voir',
    })
  }
  if (!d.till.open && (d.shop.open || d.outsideTill.count > 0)) {
    alerts.push({
      level: d.outsideTill.count > 0 ? 'critical' : 'warning',
      title: 'Caisse fermée',
      detail:
        d.outsideTill.count > 0
          ? `${plural(d.outsideTill.count, 'commande')} (${d.outsideTill.revenue.toFixed(2)} DT) prises aujourd’hui sans recette ouverte : elles ne figurent dans aucun tiroir.`
          : 'Le restaurant est ouvert : les commandes prises maintenant ne seront rattachées à aucune recette.',
      href: '/recettes',
      action: 'Recettes',
    })
  }
  for (const s of d.caisse.shortages) {
    alerts.push({
      level: 'warning',
      title: `Manquant de caisse sur ${s.number}`,
      detail: `${s.ecart.toFixed(2)} DT au comptage de clôture.`,
      href: `/recettes/${s.id}`,
      action: 'Détail',
    })
  }
  if (d.caisse.uncounted.length > 0) {
    alerts.push({
      level: 'info',
      title: `${plural(d.caisse.uncounted.length, 'recette')} clôturée${d.caisse.uncounted.length > 1 ? 's' : ''} sans comptage`,
      detail: d.caisse.uncounted.map((u) => u.number).join(', '),
      href: '/recettes',
      action: 'Recettes',
    })
  }
  if (d.platforms.outstanding > 0 && d.platforms.oldestDays >= RECEIVABLE_ALERT_DAYS) {
    alerts.push({
      level: 'warning',
      title: `${d.platforms.outstanding.toFixed(2)} DT dus par les plateformes`,
      detail: `La plus ancienne créance a ${d.platforms.oldestDays} jours.`,
      href: '/platform-payouts',
      action: 'Règlements',
    })
  }
  if (d.pass.stale > 0) {
    alerts.push({
      level: 'info',
      title: `${plural(d.pass.stale, 'commande')} des jours passés toujours ouverte${d.pass.stale > 1 ? 's' : ''}`,
      detail: 'À livrer ou à annuler, pour que les chiffres soient justes.',
      href: '/orders?range=all',
      action: 'Voir',
    })
  }
  const pendingResa = d.reservations.filter((r) => r.status === 'pending').length
  if (pendingResa > 0) {
    alerts.push({
      level: 'info',
      title: `${plural(pendingResa, 'réservation')} à confirmer aujourd’hui`,
      href: '/reservations',
      action: 'Réservations',
    })
  }
  if (d.reviewsPending > 0) {
    alerts.push({
      level: 'info',
      title: `${d.reviewsPending} avis en attente de modération`,
      href: '/reviews',
      action: 'Modérer',
    })
  }

  const order = { critical: 0, warning: 1, info: 2 }
  return alerts.sort((a, b) => order[a.level] - order[b.level])
}
