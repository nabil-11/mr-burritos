import { ORDER_SOURCE_LABELS, isOrderSource } from './orderSource'
import { formatDT } from './format'
import { readyDeadline } from './prepDeadline'
import { WEEKDAYS } from './planning'
import { DEFAULT_TIME_ZONE, dayOf } from './reportTime'

/**
 * Manager alerts — what deserves the owner's attention right now.
 *
 * Pure on purpose: orders and recettes go in, alerts come out. No database, no
 * clock of its own (`now` is passed), so the rules can be checked by
 * scripts/check-alerts.ts with nothing running. The route that feeds it is
 * app/api/manager/alerts.
 *
 * Nothing here ever reads a customer's phone, address or email: the inputs do
 * not even declare them, and the messages only carry order numbers, amounts and
 * staff-side facts.
 */

// ── Thresholds ───────────────────────────────────────────────────────────────

/** An order still « en attente » after this long has been forgotten. */
export const PENDING_MINUTES = 10
/** Past its prep deadline, an order is only « en retard » after this much more. */
export const LATE_GRACE_MINUTES = 10
/** A closed drawer off by more than this (either way) is worth a look, in DT. */
export const CASH_TOLERANCE_DT = 1
/** The most alerts a response carries. */
export const ALERT_LIMIT = 200

export const THRESHOLDS = {
  pendingMinutes: PENDING_MINUTES,
  lateGraceMinutes: LATE_GRACE_MINUTES,
  cashToleranceDt: CASH_TOLERANCE_DT,
} as const

// ── Shapes ───────────────────────────────────────────────────────────────────

export type AlertKind =
  | 'order.pending_stale'
  | 'order.late'
  | 'order.auto_settled'
  | 'order.cancelled'
  | 'order.orphan'
  | 'recette.cash_gap'
  | 'recette.not_counted'
  | 'recette.correction'
  | 'planning.not_validated'

export type AlertSeverity = 'critical' | 'warning' | 'info'

export interface Alert {
  id: string
  kind: AlertKind
  severity: AlertSeverity
  title: string
  message: string
  /** ISO instant the alert is about — what the list is sorted on. */
  at: string
  orderId?: string
  orderNumber?: string
  recetteId?: string
  recetteNumber?: string
  /** Where the order was taken: website, counter or kiosk. */
  source?: string
  /** DT. An order's total, or a drawer's signed difference. */
  amount?: number
  meta: Record<string, unknown>
}

type DateLike = Date | string | number | null | undefined

/** The slice of an order the rules read. No customer field, by design. */
export interface AlertOrder {
  _id: unknown
  orderNumber?: string
  status?: string
  source?: string
  type?: string
  total?: number
  createdAt?: DateLike
  updatedAt?: DateLike
  confirmedAt?: DateLike
  preparationDuration?: number | null
  cancelledAt?: DateLike
  deliveredAt?: DateLike
  autoSettled?: boolean
  recette?: unknown
}

export interface AlertCorrection {
  _id: unknown
  at?: DateLike
  action?: string
  target?: string
  reason?: string
  by?: { name?: string } | null
}

/** A recette with its drawer difference already computed (lib/recette cashDifference). */
export interface AlertRecette {
  _id: unknown
  number?: string
  status?: string
  closedAt?: DateLike
  closingCash?: number | null
  /** Signed: counted minus expected. `null` while nothing was counted. */
  cashDifference?: number | null
  corrections?: AlertCorrection[] | null
}

/**
 * The coming week of the planning, as the route read it: its Monday, whether
 * the manager validated it, and when its deadline falls. The rule below
 * decides whether that is worth an alert.
 */
export interface AlertPlanningWeek {
  /** YYYY-MM-DD, a Monday. */
  monday: string
  validated: boolean
  deadlineAt: DateLike
  /** 0 = Monday, as in lib/planning. Only used to word the message. */
  deadlineWeekday: number
  /** « 18:00 », Tunis time. Only used to word the message. */
  deadlineTime: string
}

export interface AlertInput {
  orders: AlertOrder[]
  recettes: AlertRecette[]
  /** The coming week's validation, when the route read it. Unset: no planning alert. */
  planning?: AlertPlanningWeek | null
  now: Date
  /**
   * When set, the « today » kinds (everything except pending_stale and late,
   * which describe a state that is true now) only count if their `at` is not
   * before it. Leave unset to evaluate every document as given.
   */
  todayStart?: Date | null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const MINUTE = 60_000

function ms(value: DateLike): number | null {
  if (value === null || value === undefined || value === '') return null
  const t = new Date(value).getTime()
  return Number.isNaN(t) ? null : t
}

const iso = (t: number) => new Date(t).toISOString()

/** A duration for people: « 45 min », « 2 h 05 », « 1 j 5 h ». Whole minutes in, floored. */
export function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.floor(Number.isFinite(minutes) ? minutes : 0))
  if (total < 60) return `${total} min`
  if (total < 24 * 60) return `${Math.floor(total / 60)} h ${String(total % 60).padStart(2, '0')}`
  return `${Math.floor(total / 1440)} j ${Math.floor((total % 1440) / 60)} h`
}

const SEVERITY_RANK: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 }

const sourceLabel = (source: unknown) => (isOrderSource(source) ? ORDER_SOURCE_LABELS[source] : '')

const numberOf = (order: AlertOrder) => String(order.orderNumber ?? '')

/** Same order fields on every order alert. */
function orderBase(order: AlertOrder) {
  const total = Number(order.total)
  return {
    orderId: String(order._id),
    orderNumber: numberOf(order),
    ...(order.source ? { source: String(order.source) } : {}),
    ...(Number.isFinite(total) ? { amount: total } : {}),
  }
}

const CORRECTION_ACTIONS: Record<string, string> = {
  'order.settle': 'règlement d’une commande',
  'order.amount': 'montant d’une commande',
  'order.cancel': 'annulation d’une commande',
  'order.restore': 'rétablissement d’une commande',
  'order.add': 'vente ajoutée',
  count: 'comptage de la caisse',
  'movement.add': 'mouvement ajouté',
  'movement.cancel': 'mouvement annulé',
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

// ── The rules ────────────────────────────────────────────────────────────────

function orderAlerts(order: AlertOrder, nowMs: number, windowStart: number | null): Alert[] {
  const out: Alert[] = []
  const status = String(order.status ?? '')
  const num = numberOf(order)
  const base = orderBase(order)
  const created = ms(order.createdAt)
  const today = (at: number) => windowStart === null || at >= windowStart
  const total = Number.isFinite(Number(order.total)) ? formatDT(Number(order.total)) : ''
  const where = sourceLabel(order.source)

  // Waiting for someone to accept it.
  if (status === 'pending' && created !== null && nowMs - created > PENDING_MINUTES * MINUTE) {
    const waited = Math.floor((nowMs - created) / MINUTE)
    out.push({
      id: `order.pending_stale:${base.orderId}`,
      kind: 'order.pending_stale',
      severity: 'warning',
      title: 'Commande en attente',
      message: `La commande ${num}${where ? ` (${where})` : ''} attend une prise en charge depuis ${formatDuration(waited)}.`,
      at: iso(created),
      ...base,
      meta: { status, waitedMinutes: waited, type: order.type ?? null },
    })
  }

  // Cooking, but past its deadline and the grace on top.
  if (status === 'confirmed' || status === 'preparing') {
    const due = readyDeadline(
      (order.confirmedAt ?? order.createdAt) as Date | string | null | undefined,
      order.preparationDuration
    )
    if (due && !Number.isNaN(due.getTime())) {
      const lateFrom = due.getTime() + LATE_GRACE_MINUTES * MINUTE
      if (nowMs > lateFrom) {
        const behind = Math.floor((nowMs - due.getTime()) / MINUTE)
        out.push({
          id: `order.late:${base.orderId}`,
          kind: 'order.late',
          severity: 'critical',
          title: 'Commande en retard',
          message: `La commande ${num}${where ? ` (${where})` : ''} a ${formatDuration(behind)} de retard sur sa préparation.`,
          at: iso(lateFrom),
          ...base,
          meta: { status, deadline: due.toISOString(), minutesLate: behind, type: order.type ?? null },
        })
      }
    }
  }

  // Closed as « livrée » by the timeout, not by a person. The flag is history
  // and survives a later cancel/restore, so a cancelled order does not raise it
  // (order.cancelled already covers it).
  if (order.autoSettled === true && status !== 'cancelled') {
    const at = ms(order.deliveredAt) ?? ms(order.updatedAt) ?? created
    if (at !== null && today(at)) {
      out.push({
        id: `order.auto_settled:${base.orderId}`,
        kind: 'order.auto_settled',
        severity: 'warning',
        title: 'Commande clôturée automatiquement',
        message: `La commande ${num}${total ? ` (${total})` : ''} a été marquée livrée par le délai, sans que personne ne la termine.`,
        at: iso(at),
        ...base,
        meta: { status, exact: ms(order.deliveredAt) !== null },
      })
    }
  }

  // Cancelled — informational, but the owner wants to see money disappear.
  if (status === 'cancelled') {
    const at = ms(order.cancelledAt) ?? ms(order.updatedAt) ?? created
    if (at !== null && today(at)) {
      out.push({
        id: `order.cancelled:${base.orderId}`,
        kind: 'order.cancelled',
        severity: 'info',
        title: 'Commande annulée',
        message: `La commande ${num}${total ? ` (${total})` : ''} a été annulée.`,
        at: iso(at),
        ...base,
        meta: { exact: ms(order.cancelledAt) !== null, type: order.type ?? null },
      })
    }
  }

  // Taken outside any till session — its money is in no recette. Website
  // orders get no exception: POST /api/orders stamps every channel with the
  // open recette (website included), so a web order with none really did land
  // outside one.
  if (status !== 'cancelled' && (order.recette === null || order.recette === undefined) && created !== null && today(created)) {
    out.push({
      id: `order.orphan:${base.orderId}`,
      kind: 'order.orphan',
      severity: 'warning',
      title: 'Commande hors recette',
      message: `La commande ${num}${total ? ` (${total})` : ''} n’appartient à aucune recette : elle a été prise caisse fermée.`,
      at: iso(created),
      ...base,
      meta: { status, type: order.type ?? null },
    })
  }

  return out
}

function recetteAlerts(recette: AlertRecette, windowStart: number | null): Alert[] {
  const out: Alert[] = []
  const id = String(recette._id)
  const number = String(recette.number ?? '')
  const closed = recette.status === 'closed'
  const closedAt = ms(recette.closedAt)
  const today = (at: number) => windowStart === null || at >= windowStart
  const base = { recetteId: id, recetteNumber: number }

  if (closed && closedAt !== null && today(closedAt)) {
    const diff = recette.cashDifference
    const counted = typeof recette.closingCash === 'number'

    if (typeof diff === 'number' && Number.isFinite(diff)) {
      // Whole millimes, so that exactly 1.000 DT is inside the tolerance.
      if (Math.round(Math.abs(diff) * 1000) > Math.round(CASH_TOLERANCE_DT * 1000)) {
        out.push({
          id: `recette.cash_gap:${id}`,
          kind: 'recette.cash_gap',
          severity: 'critical',
          title: 'Écart de caisse',
          message: `La recette ${number} a été clôturée. ${diff < 0 ? 'Manque' : 'Excédent'} de ${formatDT(Math.abs(diff))}.`,
          at: iso(closedAt),
          ...base,
          amount: diff,
          meta: { closingCash: recette.closingCash ?? null, toleranceDt: CASH_TOLERANCE_DT },
        })
      }
    }

    if (!counted) {
      out.push({
        id: `recette.not_counted:${id}`,
        kind: 'recette.not_counted',
        severity: 'warning',
        title: 'Caisse non comptée',
        message: `La recette ${number} a été clôturée sans comptage des espèces.`,
        at: iso(closedAt),
        ...base,
        meta: {},
      })
    }
  }

  // Corrections written after the books were closed.
  if (closed && closedAt !== null) {
    for (const c of recette.corrections ?? []) {
      const at = ms(c.at)
      if (at === null || at <= closedAt || !today(at)) continue
      const what = CORRECTION_ACTIONS[String(c.action ?? '')] ?? String(c.action ?? 'correction')
      const who = c.by?.name ? String(c.by.name) : 'Un utilisateur'
      const reason = c.reason ? ` Motif : ${clip(String(c.reason), 140)}` : ''
      out.push({
        id: `recette.correction:${id}:${String(c._id)}`,
        kind: 'recette.correction',
        severity: 'warning',
        title: 'Recette corrigée après clôture',
        message: `${who} a corrigé la recette ${number} après sa clôture (${what}${c.target ? ` : ${c.target}` : ''}).${reason}`,
        at: iso(at),
        ...base,
        meta: { action: c.action ?? '', target: c.target ?? '', by: c.by?.name ?? '', correctionId: String(c._id) },
      })
    }
  }

  return out
}

const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

/** « 2026-11-09 » -> « 9 nov. ». */
const shortDate = (day: string) => `${Number(day.slice(8, 10))} ${MONTHS_SHORT[Number(day.slice(5, 7)) - 1] ?? ''}`.trim()

/**
 * The coming week is still not validated and its deadline has gone by. A state
 * rather than an event of the day, so it ignores the « today » window. It stops
 * the moment the week is validated, or starts (the shop's day reaches its Monday).
 */
function planningAlert(week: AlertPlanningWeek, now: Date): Alert[] {
  const due = ms(week.deadlineAt)
  if (week.validated || due === null || now.getTime() <= due) return []
  if (dayOf(now, DEFAULT_TIME_ZONE) >= week.monday) return []
  const day = (WEEKDAYS[week.deadlineWeekday] ?? '').toLowerCase()
  return [
    {
      id: `planning.not_validated:${week.monday}`,
      kind: 'planning.not_validated',
      severity: 'warning',
      title: 'Planning non validé',
      message: `Planning de la semaine du ${shortDate(week.monday)} non validé (échéance ${day} ${week.deadlineTime})`,
      at: iso(due),
      meta: { week: week.monday, deadlineAt: iso(due) },
    },
  ]
}

/** Severity (critical first), then newest first; the id settles ties so the order is stable. */
export function compareAlerts(a: Alert, b: Alert): number {
  return (
    SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
    (a.at < b.at ? 1 : a.at > b.at ? -1 : 0) ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  )
}

/** Every alert the given documents raise, sorted. Same input, same output — ids included. */
export function computeAlerts({ orders, recettes, planning = null, now, todayStart = null }: AlertInput): Alert[] {
  const nowMs = now.getTime()
  const windowStart = todayStart ? todayStart.getTime() : null
  const alerts: Alert[] = []
  for (const o of orders) alerts.push(...orderAlerts(o, nowMs, windowStart))
  for (const r of recettes) alerts.push(...recetteAlerts(r, windowStart))
  if (planning) alerts.push(...planningAlert(planning, now))
  return alerts.sort(compareAlerts)
}

export interface AlertReport {
  counts: { total: number; critical: number; warning: number; info: number }
  truncated: boolean
  alerts: Alert[]
}

/**
 * Applies `since` (alerts with `at` >= since), counts what is left, then caps
 * the list. Counts are taken before the cap, so they always say how many
 * alerts there really are.
 */
export function buildReport(sorted: Alert[], opts: { since?: Date | null; limit?: number } = {}): AlertReport {
  const limit = opts.limit ?? ALERT_LIMIT
  const sinceMs = opts.since ? opts.since.getTime() : null
  const kept = sinceMs === null ? sorted : sorted.filter((a) => new Date(a.at).getTime() >= sinceMs)
  const counts = { total: kept.length, critical: 0, warning: 0, info: 0 }
  for (const a of kept) counts[a.severity]++
  return { counts, truncated: kept.length > limit, alerts: kept.slice(0, limit) }
}
