import { cashDifference, cashInDrawer, type CompanyBucket, type RecetteTotals } from './recette'
import { MOVEMENT_KINDS, isMovementKind, type MovementKind } from './movementKinds'
import { ORDER_SOURCES, type OrderSource } from './orderSource'
import { dayOf, daysBetween } from './reportTime'

/**
 * Le rapport d'une période, construit recette par recette.
 *
 * La règle qui tient tout : une période, c'est la somme des recettes ouvertes
 * pendant cette période — chacune comptée en entier, avec ses chiffres figés
 * si elle est close, en direct si elle tourne encore. Rien n'est recoupé à
 * l'heure près, rien n'est recalculé depuis les commandes.
 *
 * Pourquoi pas les commandes ? Parce que le rapport doit pouvoir se vérifier à
 * la main : chaque total ici est exactement la somme des lignes du tableau des
 * recettes, et chaque ligne est exactement ce qu'affiche la page de la recette.
 * Une recette ouverte le lundi soir et fermée le mardi matin appartient au
 * lundi, entière — achats compris. La couper en deux ferait un rapport qu'aucun
 * ticket de clôture ne confirme.
 *
 * Ce que les recettes ne voient pas — les commandes prises caisse fermée — est
 * signalé à part par la route (`orphans`), jamais mélangé aux totaux.
 *
 * Pur : ni Mongo ni requête. La route lit, ce fichier additionne.
 */

const round2 = (n: number) => Math.round(n * 100) / 100

/** En dessous d'un demi-millime, un écart est un arrondi, pas un écart. */
const GAP_EPSILON = 0.005

/** Jusqu'à deux mois, chaque jour a sa ligne — même vide, un jour sans recette se voit. */
const FILL_DAYS_UP_TO = 62

export interface ReportRecetteDoc {
  _id: unknown
  number?: string
  status?: string
  openedAt?: Date | string | null
  closedAt?: Date | string | null
  openedBy?: { name?: string } | null
  closedBy?: { name?: string } | null
  openingFloat?: number
  closingCash?: number | null
  mouvements?: {
    kind?: string
    label?: string
    amount?: number
    cancelledAt?: Date | string | null
  }[] | null
}

export interface ReportInput {
  doc: ReportRecetteDoc
  totals: RecetteTotals
}

/** Les montants qui s'additionnent tels quels d'une recette à l'autre. */
const SUMMED = [
  'revenue', 'net', 'commission', 'discounts', 'surcharges', 'deliveryFees',
  'cashSales', 'cardSales', 'platformDue', 'platformPaid', 'unsettled',
  'collected', 'receivable', 'achats', 'depenses', 'apports', 'retraits',
  'cashExpected', 'solde',
] as const
type SummedKey = (typeof SUMMED)[number]

export type ReportSummary = Record<SummedKey, number> & {
  sessions: number
  open: number
  orders: number
  cancelled: number
  inProgress: number
  /** Brut par commande — le même calcul que la page d'une recette. */
  avgTicket: number
}

export interface ReportCaisse {
  sessions: number
  open: number
  closed: number
  /** Clôturées avec un comptage des espèces. */
  counted: number
  /** Clôturées sans comptage : un tiroir non compté n'est pas un tiroir juste. */
  uncounted: number
  /** Comptées, écart nul. */
  balanced: number
  manquants: { count: number; amount: number }
  excedents: { count: number; amount: number }
  /** Somme des écarts comptés : les excédents compensent les manquants. */
  ecartNet: number
}

export interface ReportCompany extends CompanyBucket {
  /** Ce que la plateforme doit encore à l'heure du rapport — rempli par la route. */
  outstandingNow: number
}

export interface ReportMovementLine {
  kind: MovementKind
  label: string
  count: number
  amount: number
}

export interface ReportMovements {
  byKind: Record<MovementKind, { count: number; amount: number }>
  /** Les plus gros libellés, tous genres confondus. */
  top: ReportMovementLine[]
  /** Lignes annulées : hors des totaux, mais pas hors de vue. */
  cancelled: number
}

export interface ReportDay {
  day: string
  sessions: number
  orders: number
  revenue: number
  net: number
  collected: number
  receivable: number
  sorties: number
  solde: number
  /** null tant qu'aucune recette du jour n'a été comptée. */
  ecart: number | null
}

export interface ReportCashier {
  name: string
  sessions: number
  orders: number
  revenue: number
  counted: number
  ecart: number
  manquants: number
}

export interface ReportRecetteRow {
  _id: string
  number: string
  status: 'open' | 'closed'
  day: string
  openedAt: string | null
  closedAt: string | null
  openedBy: string
  closedBy: string
  /** En minutes, jusqu'à maintenant si elle tourne encore. */
  durationMin: number | null
  orders: number
  cancelled: number
  revenue: number
  net: number
  commission: number
  cashSales: number
  cardSales: number
  platformDue: number
  collected: number
  receivable: number
  sorties: number
  apports: number
  retraits: number
  solde: number
  openingFloat: number
  expected: number
  closingCash: number | null
  ecart: number | null
}

export interface RecetteReport {
  period: { from: string; to: string; tz: string; days: number }
  generatedAt: string
  /** Vrai si la période dépassait le plafond de recettes lues. */
  truncated: boolean
  summary: ReportSummary
  caisse: ReportCaisse
  byType: Record<'delivery' | 'pickup', { count: number; revenue: number }>
  bySource: Record<OrderSource | 'unknown', { count: number; revenue: number }>
  byCompany: ReportCompany[]
  movements: ReportMovements
  byDay: ReportDay[]
  byCashier: ReportCashier[]
  recettes: ReportRecetteRow[]
  /** Commandes de la période prises sans recette ouverte — rempli par la route. */
  orphans: { count: number; revenue: number }
  /** Ce que les plateformes doivent encore aujourd'hui sur ces recettes — rempli par la route. */
  platformsOutstandingNow: number
}

/** « Légumes », « legumes » et « LÉGUMES » sont une seule ligne du rapport. */
const labelKey = (kind: string, label: string) =>
  `${kind}:${label.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}`

const iso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : null)

function emptySummary(): ReportSummary {
  const s = { sessions: 0, open: 0, orders: 0, cancelled: 0, inProgress: 0, avgTicket: 0 } as ReportSummary
  for (const key of SUMMED) s[key] = 0
  return s
}

/**
 * Fusionne les plateformes de plusieurs recettes. Un taux qui change d'une
 * recette à l'autre ne s'affiche plus : mieux vaut aucun taux qu'un faux.
 */
function mergeCompanies(all: CompanyBucket[][]): ReportCompany[] {
  const map = new Map<string, ReportCompany>()
  for (const list of all) {
    for (const c of list) {
      if (!c?.name) continue
      const acc = map.get(c.name)
      if (!acc) {
        map.set(c.name, { ...c, settled: c.settled ?? 0, outstandingNow: 0 })
        continue
      }
      acc.count += c.count || 0
      acc.revenue += c.revenue || 0
      acc.commission += c.commission || 0
      acc.net += c.net || 0
      acc.cash += c.cash || 0
      acc.due += c.due || 0
      acc.settled += c.settled ?? 0
      if (acc.rate !== null && acc.rate !== c.rate) acc.rate = null
    }
  }
  return [...map.values()]
    .map((c) => ({
      ...c,
      revenue: round2(c.revenue),
      commission: round2(c.commission),
      net: round2(c.net),
      cash: round2(c.cash),
      due: round2(c.due),
      settled: round2(c.settled),
    }))
    .sort((a, b) => b.revenue - a.revenue)
}

export function buildRecetteReport(
  inputs: ReportInput[],
  opts: { from: string; to: string; tz: string; now?: Date; truncated?: boolean }
): RecetteReport {
  const now = opts.now ?? new Date()
  const summary = emptySummary()
  const caisse: ReportCaisse = {
    sessions: 0, open: 0, closed: 0, counted: 0, uncounted: 0, balanced: 0,
    manquants: { count: 0, amount: 0 }, excedents: { count: 0, amount: 0 }, ecartNet: 0,
  }
  const byType = { delivery: { count: 0, revenue: 0 }, pickup: { count: 0, revenue: 0 } }
  const bySource = {} as RecetteReport['bySource']
  for (const key of [...ORDER_SOURCES, 'unknown'] as const) bySource[key] = { count: 0, revenue: 0 }

  const byKind = {} as ReportMovements['byKind']
  for (const kind of MOVEMENT_KINDS) byKind[kind] = { count: 0, amount: 0 }
  const labels = new Map<string, ReportMovementLine>()
  let cancelledMovements = 0

  const days = new Map<string, ReportDay>()
  const cashiers = new Map<string, ReportCashier>()
  const rows: ReportRecetteRow[] = []

  for (const { doc, totals: t } of inputs) {
    const isOpen = doc.status === 'open'
    const ecart = cashDifference(doc, t)
    const expected = cashInDrawer(doc, t)
    const day = doc.openedAt ? dayOf(doc.openedAt, opts.tz) : opts.from
    const sorties = (t.achats || 0) + (t.depenses || 0)

    // ── Totaux ───────────────────────────────────────────────
    summary.sessions++
    if (isOpen) summary.open++
    summary.orders += t.orders || 0
    summary.cancelled += t.cancelled || 0
    summary.inProgress += t.inProgress || 0
    for (const key of SUMMED) summary[key] += Number(t[key]) || 0

    for (const type of ['delivery', 'pickup'] as const) {
      byType[type].count += t.byType?.[type]?.count || 0
      byType[type].revenue += t.byType?.[type]?.revenue || 0
    }
    for (const key of Object.keys(bySource) as (keyof typeof bySource)[]) {
      bySource[key].count += t.bySource?.[key]?.count || 0
      bySource[key].revenue += t.bySource?.[key]?.revenue || 0
    }

    // ── Contrôle de caisse ───────────────────────────────────
    caisse.sessions++
    if (isOpen) caisse.open++
    else {
      caisse.closed++
      if (ecart === null) caisse.uncounted++
    }
    if (ecart !== null) {
      caisse.counted++
      caisse.ecartNet += ecart
      if (Math.abs(ecart) < GAP_EPSILON) caisse.balanced++
      else if (ecart < 0) {
        caisse.manquants.count++
        caisse.manquants.amount += -ecart
      } else {
        caisse.excedents.count++
        caisse.excedents.amount += ecart
      }
    }

    // ── Mouvements, ligne à ligne ────────────────────────────
    // Une recette close ne reçoit plus de mouvement : la somme de ces lignes
    // est exactement celle figée dans ses totaux.
    for (const m of doc.mouvements ?? []) {
      if (!isMovementKind(m.kind)) continue
      if (m.cancelledAt) {
        cancelledMovements++
        continue
      }
      const amount = Number(m.amount) || 0
      byKind[m.kind].count++
      byKind[m.kind].amount += amount
      const label = (m.label ?? '').trim() || '—'
      const key = labelKey(m.kind, label)
      const line = labels.get(key) ?? { kind: m.kind, label, count: 0, amount: 0 }
      line.count++
      line.amount += amount
      labels.set(key, line)
    }

    // ── Par jour d'ouverture ─────────────────────────────────
    const d = days.get(day) ?? {
      day, sessions: 0, orders: 0, revenue: 0, net: 0, collected: 0,
      receivable: 0, sorties: 0, solde: 0, ecart: null,
    }
    d.sessions++
    d.orders += t.orders || 0
    d.revenue += t.revenue || 0
    d.net += t.net || 0
    d.collected += t.collected || 0
    d.receivable += t.receivable || 0
    d.sorties += sorties
    d.solde += t.solde || 0
    if (ecart !== null) d.ecart = (d.ecart ?? 0) + ecart
    days.set(day, d)

    // ── Par caissier ─────────────────────────────────────────
    // L'écart est à celui qui a compté le tiroir : celui qui a clôturé.
    const who = (isOpen ? doc.openedBy?.name : doc.closedBy?.name || doc.openedBy?.name)?.trim() || '—'
    const c = cashiers.get(who) ?? { name: who, sessions: 0, orders: 0, revenue: 0, counted: 0, ecart: 0, manquants: 0 }
    c.sessions++
    c.orders += t.orders || 0
    c.revenue += t.revenue || 0
    if (ecart !== null) {
      c.counted++
      c.ecart += ecart
      if (ecart <= -GAP_EPSILON) c.manquants += -ecart
    }
    cashiers.set(who, c)

    // ── La ligne de la recette ───────────────────────────────
    const openedMs = doc.openedAt ? new Date(doc.openedAt).getTime() : NaN
    const endMs = doc.closedAt ? new Date(doc.closedAt).getTime() : isOpen ? now.getTime() : NaN
    rows.push({
      _id: String(doc._id),
      number: doc.number ?? '',
      status: isOpen ? 'open' : 'closed',
      day,
      openedAt: iso(doc.openedAt),
      closedAt: iso(doc.closedAt),
      openedBy: doc.openedBy?.name ?? '',
      closedBy: doc.closedBy?.name ?? '',
      durationMin: Number.isFinite(openedMs) && Number.isFinite(endMs)
        ? Math.max(0, Math.round((endMs - openedMs) / 60_000))
        : null,
      orders: t.orders || 0,
      cancelled: t.cancelled || 0,
      revenue: round2(t.revenue || 0),
      net: round2(t.net || 0),
      commission: round2(t.commission || 0),
      cashSales: round2(t.cashSales || 0),
      cardSales: round2(t.cardSales || 0),
      platformDue: round2(t.platformDue || 0),
      collected: round2(t.collected || 0),
      receivable: round2(t.receivable || 0),
      sorties: round2(sorties),
      apports: round2(t.apports || 0),
      retraits: round2(t.retraits || 0),
      solde: round2(t.solde || 0),
      openingFloat: round2(doc.openingFloat || 0),
      expected,
      closingCash: typeof doc.closingCash === 'number' ? doc.closingCash : null,
      ecart,
    })
  }

  // ── Arrondis, une seule fois, à la fin ─────────────────────
  for (const key of SUMMED) summary[key] = round2(summary[key])
  summary.avgTicket = summary.orders > 0 ? round2(summary.revenue / summary.orders) : 0
  caisse.ecartNet = round2(caisse.ecartNet)
  caisse.manquants.amount = round2(caisse.manquants.amount)
  caisse.excedents.amount = round2(caisse.excedents.amount)
  for (const b of [...Object.values(byType), ...Object.values(bySource)]) b.revenue = round2(b.revenue)
  for (const k of MOVEMENT_KINDS) byKind[k].amount = round2(byKind[k].amount)

  // Une période courte liste tous ses jours ; une longue, seulement ceux qui ont vu une recette.
  const period = daysBetween(opts.from, opts.to)
  const dayKeys = period.length <= FILL_DAYS_UP_TO
    ? [...new Set([...period, ...days.keys()])].sort()
    : [...days.keys()].sort()
  const byDay = dayKeys.map((day) => {
    const d = days.get(day)
    if (!d) {
      return { day, sessions: 0, orders: 0, revenue: 0, net: 0, collected: 0, receivable: 0, sorties: 0, solde: 0, ecart: null }
    }
    return {
      ...d,
      revenue: round2(d.revenue),
      net: round2(d.net),
      collected: round2(d.collected),
      receivable: round2(d.receivable),
      sorties: round2(d.sorties),
      solde: round2(d.solde),
      ecart: d.ecart === null ? null : round2(d.ecart),
    }
  })

  return {
    period: { from: opts.from, to: opts.to, tz: opts.tz, days: period.length },
    generatedAt: now.toISOString(),
    truncated: Boolean(opts.truncated),
    summary,
    caisse,
    byType,
    bySource,
    byCompany: mergeCompanies(inputs.map((i) => i.totals.byCompany ?? [])),
    movements: {
      byKind,
      top: [...labels.values()]
        .map((l) => ({ ...l, amount: round2(l.amount) }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 12),
      cancelled: cancelledMovements,
    },
    byDay,
    byCashier: [...cashiers.values()]
      .map((c) => ({ ...c, revenue: round2(c.revenue), ecart: round2(c.ecart), manquants: round2(c.manquants) }))
      .sort((a, b) => b.revenue - a.revenue),
    // Le plus ancien en haut : un rapport se lit dans l'ordre où la journée s'est passée.
    recettes: rows.sort((a, b) => (a.openedAt ?? '').localeCompare(b.openedAt ?? '')),
    orphans: { count: 0, revenue: 0 },
    platformsOutstandingNow: 0,
  }
}
