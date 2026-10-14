import mongoose from 'mongoose'
import { connectDB } from './mongodb'
import { Order } from './models/Order'
import { Recette } from './models/Recette'
import { DeliveryCompany } from './models/DeliveryCompany'
import { isDuplicateKey, nextOrderNumber } from './orderNumber'
import { orderBus } from './orderBus'
import { MOVEMENT_META, isMovementKind } from './movementKinds'
import {
  CORRECTION_ACTIONS,
  CORRECTION_LABELS,
  CORRECTION_ROLES,
  SETTLE_PAYMENTS,
  type CorrectionAction,
  type SettlePayment,
} from './correctionKinds'
import {
  RecetteError,
  attachEmployees,
  cashDifference,
  cleanMovement,
  recetteOrders,
  recetteTotals,
  refrozenTotals,
  type RecetteTotals,
} from './recette'

/**
 * Corriger une recette après coup.
 *
 * Une recette clôturée ne se rouvre jamais — la caisse en a déjà ouvert une
 * autre, et un rapport rouvert serait un rapport qui bouge sans prévenir. On la
 * corrige donc, geste par geste, et chaque geste fait trois choses ensemble :
 *
 *   1. il change ce qui était faux (la commande, le comptage, le mouvement) ;
 *   2. il recalcule les totaux figés de la recette — voir `refrozenTotals` ;
 *   3. il s'inscrit au journal de la recette : qui, quand, pourquoi, et ce que
 *      ça a changé aux chiffres. Sans raison, pas de correction.
 *
 * Rien n'est jamais effacé. Une commande « supprimée » est annulée — elle
 * reste lisible, barrée, et se rétablit ; un mouvement aussi. Une commande
 * dont la plateforme a déjà versé l'argent (pointée dans Règlements
 * plateformes) est verrouillée : la changer ferait mentir le versement.
 *
 * Une recette encore ouverte accepte les corrections de commandes (ses totaux
 * sont recalculés à chaque affichage) ; son comptage et ses mouvements, eux,
 * passent par la caisse, comme d'habitude.
 */

export { CORRECTION_ACTIONS, CORRECTION_LABELS, CORRECTION_ROLES, SETTLE_PAYMENTS }
export type { CorrectionAction, SettlePayment }

export interface CorrectionUser {
  userId: string | null
  name: string
}

export interface CorrectionDelta {
  revenue: number
  net: number
  cashExpected: number
  receivable: number
}

export interface CorrectionResult {
  target: string
  changes: string[]
  delta: CorrectionDelta
  gapBefore: number | null
  gapAfter: number | null
}

const MAX_AMOUNT = 100_000
const round2 = (n: number) => Math.round(n * 100) / 100
const money = (n: number) => `${(Number(n) || 0).toFixed(2)} DT`
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

const STATUS_FR: Record<string, string> = {
  pending: 'En attente', confirmed: 'Confirmée', preparing: 'En préparation',
  ready: 'Prête', delivered: 'Livrée', cancelled: 'Annulée',
}
const TYPE_FR = (t: unknown) => (t === 'delivery' ? 'livraison' : 'à emporter')

/** Le règlement en mots — `undefined` : personne n'a rien noté, c'est le canal qui décide. */
function paymentFr(method: string | undefined, company: string, source?: string): string {
  if (method === 'cash') return 'espèces'
  if (method === 'card') return 'TPE'
  if (method === 'other') return 'autre'
  if (company) return `encaissé par ${company}`
  // Même règle que lib/platformSettlement : pris sur place, l'argent est au tiroir.
  return ['counter', 'kiosk', 'website'].includes(String(source)) ? 'espèces (non noté)' : 'non renseigné'
}

type RecetteLean = {
  _id: unknown
  status?: string
  openedAt?: Date
  closedAt?: Date | null
  openingFloat?: number
  closingCash?: number | null
  totals?: RecetteTotals | null
  mouvements?: { _id: unknown; kind?: string; label?: string; amount?: number; cancelledAt?: Date | null }[]
}

type OrderLean = {
  _id: unknown
  orderNumber?: string
  status?: string
  type?: string
  source?: string
  total?: number
  payment?: { method?: string } | null
  correction?: { amount?: number } | null
  deliveryCompany?: {
    companyId?: unknown
    name?: string
    commission?: number
    paid?: boolean
    payoutRef?: string
  } | null
}

type CompanyLean = { _id: unknown; name?: string; commission?: number }

const NO_COMPANY = { companyId: null, name: '', commission: 0, paid: false, paidAt: null, paidBy: '', payout: null, payoutRef: '' }

/** L'instant d'une saisie après coup, tenu dans les heures de la recette. */
function instantIn(recette: RecetteLean, raw: unknown): Date {
  const start = recette.openedAt ? new Date(recette.openedAt).getTime() : Date.now()
  const end = recette.closedAt ? new Date(recette.closedAt).getTime() : Date.now()
  const asked = typeof raw === 'string' && raw ? new Date(raw).getTime() : NaN
  // Sans heure donnée : juste avant la clôture — la fin du service.
  const at = Number.isFinite(asked) ? asked : end - 60_000
  return new Date(Math.min(Math.max(at, start), end))
}

async function companyFrom(raw: unknown): Promise<CompanyLean | null> {
  if (raw === null || raw === undefined || raw === '') return null
  const id = String(raw)
  if (!mongoose.isValidObjectId(id)) throw new RecetteError('Plateforme introuvable', 400)
  const found = (await DeliveryCompany.findById(id).select('name commission').lean()) as CompanyLean | null
  if (!found) throw new RecetteError('Plateforme introuvable', 400)
  return found
}

function paymentFrom(raw: unknown, company: CompanyLean | null): string | undefined {
  if (!(SETTLE_PAYMENTS as readonly string[]).includes(String(raw))) {
    throw new RecetteError('Choisissez comment la commande a été réglée', 400)
  }
  if (raw === 'platform') {
    if (!company) {
      throw new RecetteError("Seule une plateforme encaisse à la place du restaurant : choisissez-la", 400)
    }
    return undefined
  }
  return String(raw)
}

async function orderOf(recetteId: string, orderId: unknown): Promise<OrderLean> {
  const id = String(orderId ?? '')
  if (!mongoose.isValidObjectId(id)) throw new RecetteError('Commande introuvable', 404)
  const order = (await Order.findOne({ _id: id, recette: recetteId }).lean()) as OrderLean | null
  if (!order) throw new RecetteError('Commande introuvable sur cette recette', 404)
  return order
}

/** Une commande dont le versement a été pointé ne bouge plus : le versement mentirait. */
function guardPayout(order: OrderLean) {
  const dc = order.deliveryCompany
  if (dc?.paid) {
    throw new RecetteError(
      `Le versement de ${dc.name || 'la plateforme'} est déjà pointé sur cette commande${
        dc.payoutRef ? ` (${dc.payoutRef})` : ''
      } : annulez ce pointage dans Règlements plateformes avant de la corriger.`,
      409
    )
  }
}

function guardNotCancelled(order: OrderLean) {
  if (order.status === 'cancelled') {
    throw new RecetteError('Commande annulée : rétablissez-la avant de la corriger', 409)
  }
}

function needsClosed(recette: RecetteLean) {
  if (recette.status !== 'closed') {
    throw new RecetteError('Recette encore ouverte : le comptage et les mouvements se font depuis la caisse', 409)
  }
}

async function touchOrder(id: unknown, set: Record<string, unknown>, unset: Record<string, ''> = {}) {
  const updated = await Order.findByIdAndUpdate(
    id,
    { ...(Object.keys(set).length ? { $set: set } : {}), ...(Object.keys(unset).length ? { $unset: unset } : {}) },
    { returnDocument: 'after' }
  ).lean()
  // Une caisse ou un écran ouvert voit la commande changer sans recharger.
  if (updated) orderBus.emit('order-status', updated)
}

type Applied = { target: string; changes: string[] }

// ── Les gestes ───────────────────────────────────────────────────────────────

/** Plateforme, type, et qui a encaissé — les trois se décident ensemble. */
async function settleOrder(recetteId: string, body: Record<string, unknown>): Promise<Applied> {
  const order = await orderOf(recetteId, body.orderId)
  guardNotCancelled(order)
  const company = await companyFrom(body.companyId)
  const method = paymentFrom(body.payment, company)
  // Une commission ne s'applique qu'à une livraison : une plateforme fait donc une livraison.
  const type = company ? 'delivery' : body.type === 'delivery' ? 'delivery' : 'pickup'

  const dc = order.deliveryCompany ?? {}
  const oldCompany = dc.name?.trim() ?? ''
  const sameCompany = company
    ? dc.companyId
      ? String(dc.companyId) === String(company._id)
      : oldCompany === company.name
    : !oldCompany
  const oldMethod = order.payment?.method || undefined

  const changes: string[] = []
  if (type !== (order.type === 'delivery' ? 'delivery' : 'pickup')) {
    changes.push(`Type : ${TYPE_FR(order.type)} → ${TYPE_FR(type)}`)
  }
  if (!sameCompany) changes.push(`Plateforme : ${oldCompany || 'aucune'} → ${company?.name || 'aucune'}`)
  // Une vente au comptoir sans règlement noté est en espèces (lib/platformSettlement) :
  // y choisir « espèces » ne change rien — ni l'argent, ni le journal.
  const onSpot = ['counter', 'kiosk', 'website'].includes(String(order.source))
  const effectiveOld = oldMethod ?? (!oldCompany && onSpot ? 'cash' : undefined)
  const effectiveNew = method ?? (!company && onSpot ? 'cash' : undefined)
  if (effectiveOld !== effectiveNew || (!effectiveNew && oldCompany !== (company?.name ?? ''))) {
    changes.push(`Règlement : ${paymentFr(oldMethod, oldCompany, order.source)} → ${paymentFr(method, company?.name ?? '', order.source)}`)
  }
  if (!changes.length) throw new RecetteError('Rien à corriger : la commande est déjà ainsi', 400)
  guardPayout(order)

  const set: Record<string, unknown> = { type }
  const unset: Record<string, ''> = {}
  if (!sameCompany) {
    // Une plateforme qui change repart de zéro : son taux d'aujourd'hui, rien de versé.
    set.deliveryCompany = company
      ? { ...NO_COMPANY, companyId: company._id, name: company.name ?? '', commission: Number(company.commission) || 0 }
      : NO_COMPANY
  }
  if (oldMethod !== method) {
    if (method) set.payment = { method }
    else unset.payment = ''
  }
  await touchOrder(order._id, set, unset)
  return { target: String(order.orderNumber ?? ''), changes }
}

/**
 * Le montant d'une commande. La différence va dans `correction`, pas dans la
 * remise du caissier : le ticket réimprimé montre les deux, et tombe juste.
 */
async function amountOrder(recetteId: string, body: Record<string, unknown>): Promise<Applied> {
  const order = await orderOf(recetteId, body.orderId)
  guardNotCancelled(order)
  const total = num(body.total)
  if (total === null || total <= 0 || total > MAX_AMOUNT) throw new RecetteError('Montant invalide', 400)
  const next = round2(total)
  const prev = round2(Number(order.total) || 0)
  if (Math.abs(next - prev) < 0.005) throw new RecetteError('Rien à corriger : le montant est déjà celui-là', 400)
  guardPayout(order)

  const correction = round2((Number(order.correction?.amount) || 0) + next - prev)
  await touchOrder(order._id, {
    total: next,
    'correction.amount': correction,
    'correction.label': Math.abs(correction) < 0.005 ? '' : 'Correction',
  })
  return { target: String(order.orderNumber ?? ''), changes: [`Montant : ${money(prev)} → ${money(next)}`] }
}

/** « Supprimer » une commande : l'annuler. Elle reste lisible, barrée, et se rétablit. */
async function cancelOrder(recetteId: string, body: Record<string, unknown>): Promise<Applied> {
  const order = await orderOf(recetteId, body.orderId)
  if (order.status === 'cancelled') throw new RecetteError('Commande déjà annulée', 409)
  guardPayout(order)
  await touchOrder(order._id, { status: 'cancelled' })
  return {
    target: String(order.orderNumber ?? ''),
    changes: [`Statut : ${STATUS_FR[String(order.status)] ?? order.status} → Annulée (${money(Number(order.total) || 0)} retirés)`],
  }
}

async function restoreOrder(recetteId: string, body: Record<string, unknown>): Promise<Applied> {
  const order = await orderOf(recetteId, body.orderId)
  if (order.status !== 'cancelled') throw new RecetteError("Cette commande n'est pas annulée", 409)
  await touchOrder(order._id, { status: 'delivered' })
  return {
    target: String(order.orderNumber ?? ''),
    changes: [`Statut : Annulée → Livrée (${money(Number(order.total) || 0)} réintégrés)`],
  }
}

/**
 * Une vente oubliée — le ticket Glovo jamais saisi, la commande prise caisse
 * fermée. Elle entre comme la caisse saisit un montant de plateforme : sans
 * articles, livrée, à l'heure où elle a eu lieu.
 */
async function addOrder(recette: RecetteLean, body: Record<string, unknown>, reason: string): Promise<Applied> {
  const total = num(body.total)
  if (total === null || total <= 0 || total > MAX_AMOUNT) throw new RecetteError('Montant invalide', 400)
  const company = await companyFrom(body.companyId)
  const method = paymentFrom(body.payment, company)
  const type = company ? 'delivery' : body.type === 'delivery' ? 'delivery' : 'pickup'
  const at = instantIn(recette, body.at)
  const amount = round2(total)

  const doc = {
    customer: { name: text(body.customer, 80) || company?.name || 'Vente ajoutée', phone: '—' },
    items: [],
    subtotal: amount,
    total: amount,
    type,
    source: 'counter',
    status: 'delivered',
    deliveryCompany: company
      ? { ...NO_COMPANY, companyId: company._id, name: company.name ?? '', commission: Number(company.commission) || 0 }
      : NO_COMPANY,
    reference: text(body.reference, 60),
    notes: `Ajoutée à la recette après coup : ${reason}`.slice(0, 500),
    confirmedAt: at,
    recette: recette._id,
    ...(method ? { payment: { method } } : {}),
  }

  let created: { _id: unknown; orderNumber: string } | null = null
  for (let attempt = 0; !created; attempt++) {
    try {
      created = await Order.create({ ...doc, orderNumber: await nextOrderNumber(at) })
    } catch (err) {
      if (isDuplicateKey(err) && attempt < 5) continue
      throw err
    }
  }
  // L'heure de la vente, pas celle de la saisie. Mongoose tient `createdAt`
  // pour immuable et ignorerait la mise à jour : on passe par le pilote.
  await Order.collection.updateOne({ _id: created._id as mongoose.Types.ObjectId }, { $set: { createdAt: at } })

  return {
    target: created.orderNumber,
    changes: [
      `Vente ajoutée : ${money(amount)} · ${TYPE_FR(type)}${company ? ` · ${company.name}` : ''} · ${paymentFr(method, company?.name ?? '', 'counter')}`,
    ],
  }
}

/** Le comptage du tiroir : les espèces comptées à la clôture, et le fond d'ouverture. */
async function recount(recette: RecetteLean, body: Record<string, unknown>): Promise<Applied> {
  needsClosed(recette)
  const set: Record<string, unknown> = {}
  const changes: string[] = []
  const fmt = (n: number | null | undefined) => (typeof n === 'number' ? money(n) : 'non compté')

  if ('closingCash' in body) {
    const raw = body.closingCash
    const value = raw === null || raw === '' ? null : num(raw)
    if (value !== null && (value < 0 || value > MAX_AMOUNT * 10)) throw new RecetteError('Montant compté invalide', 400)
    const next = value === null ? null : round2(value)
    const prev = typeof recette.closingCash === 'number' ? recette.closingCash : null
    if (next !== prev) {
      set.closingCash = next
      changes.push(`Espèces comptées : ${fmt(prev)} → ${fmt(next)}`)
    }
  }
  if ('openingFloat' in body) {
    const value = num(body.openingFloat)
    if (value === null || value < 0 || value > MAX_AMOUNT) throw new RecetteError("Fond d'ouverture invalide", 400)
    const next = round2(value)
    const prev = round2(Number(recette.openingFloat) || 0)
    if (next !== prev) {
      set.openingFloat = next
      changes.push(`Fond d'ouverture : ${money(prev)} → ${money(next)}`)
    }
  }
  if (!changes.length) throw new RecetteError('Rien à corriger : le comptage est déjà celui-là', 400)
  await Recette.updateOne({ _id: recette._id, status: 'closed' }, { $set: set })
  return { target: 'Tiroir', changes }
}

/** Un mouvement oublié — le pain payé, jamais saisi. Daté de quand l'argent a bougé. */
async function addLateMovement(recette: RecetteLean, body: Record<string, unknown>, user: CorrectionUser): Promise<Applied> {
  needsClosed(recette)
  const [movement] = await attachEmployees([cleanMovement(body)])
  const at = instantIn(recette, body.at)
  const updated = await Recette.updateOne(
    { _id: recette._id, status: 'closed' },
    {
      $push: {
        mouvements: { ...movement, createdAt: at, createdBy: { name: user.name }, addedLater: new Date() },
      },
    },
    { runValidators: true }
  )
  if (!updated.modifiedCount) throw new RecetteError('Recette introuvable', 404)
  const meta = MOVEMENT_META[movement.kind]
  return {
    target: movement.label,
    changes: [`${meta.label} ajouté${meta.kind === 'depense' ? 'e' : ''} : ${movement.label} ${meta.sign > 0 ? '+' : '−'} ${money(movement.amount)}`],
  }
}

async function cancelLateMovement(recette: RecetteLean, body: Record<string, unknown>, user: CorrectionUser): Promise<Applied> {
  needsClosed(recette)
  const id = String(body.movementId ?? '')
  const movement = recette.mouvements?.find((m) => String(m._id) === id)
  if (!movement) throw new RecetteError('Mouvement introuvable', 404)
  if (movement.cancelledAt) throw new RecetteError('Mouvement déjà annulé', 409)
  await Recette.updateOne(
    { _id: recette._id, status: 'closed', mouvements: { $elemMatch: { _id: id, cancelledAt: null } } },
    { $set: { 'mouvements.$.cancelledAt': new Date(), 'mouvements.$.cancelledBy': { name: user.name } } }
  )
  const meta = isMovementKind(movement.kind) ? MOVEMENT_META[movement.kind] : null
  return {
    target: movement.label ?? '',
    changes: [`${meta?.label ?? 'Mouvement'} annulé : ${movement.label} ${meta && meta.sign > 0 ? '+' : '−'} ${money(Number(movement.amount) || 0)}`],
  }
}

// ── L'entrée ─────────────────────────────────────────────────────────────────

export async function applyCorrection(
  recetteId: string,
  body: Record<string, unknown>,
  user: CorrectionUser
): Promise<CorrectionResult> {
  if (!mongoose.isValidObjectId(recetteId)) throw new RecetteError('Recette introuvable', 404)
  const action = String(body.action ?? '') as CorrectionAction
  if (!(CORRECTION_ACTIONS as readonly string[]).includes(action)) throw new RecetteError('Correction inconnue', 400)
  const reason = text(body.reason, 300)
  if (reason.length < 3) throw new RecetteError('Indiquez la raison de la correction', 400)

  await connectDB()
  const recette = (await Recette.findById(recetteId).lean()) as RecetteLean | null
  if (!recette) throw new RecetteError('Recette introuvable', 404)
  const closed = recette.status === 'closed'
  const before = await recetteTotals(recette)
  const gapBefore = cashDifference(recette, before)

  const applied =
    action === 'order.settle' ? await settleOrder(recetteId, body)
    : action === 'order.amount' ? await amountOrder(recetteId, body)
    : action === 'order.cancel' ? await cancelOrder(recetteId, body)
    : action === 'order.restore' ? await restoreOrder(recetteId, body)
    : action === 'order.add' ? await addOrder(recette, body, reason)
    : action === 'count' ? await recount(recette, body)
    : action === 'movement.add' ? await addLateMovement(recette, body, user)
    : await cancelLateMovement(recette, body, user)

  // Relu après le geste : les totaux se recalculent sur ce qui est vraiment en base.
  const fresh = (await Recette.findById(recetteId).lean()) as RecetteLean
  const after = closed
    ? refrozenTotals(fresh, (await recetteOrders(recetteId)) as Parameters<typeof refrozenTotals>[1])
    : await recetteTotals(fresh)
  const gapAfter = cashDifference(fresh, after)
  const delta: CorrectionDelta = {
    revenue: round2(after.revenue - before.revenue),
    net: round2(after.net - before.net),
    cashExpected: round2(after.cashExpected - before.cashExpected),
    receivable: round2(after.receivable - before.receivable),
  }

  await Recette.updateOne(
    { _id: recetteId },
    {
      ...(closed ? { $set: { totals: after } } : {}),
      $push: {
        corrections: {
          at: new Date(),
          by: { user: user.userId, name: user.name },
          action,
          target: applied.target,
          changes: applied.changes,
          reason,
          delta,
        },
      },
    }
  )

  return { ...applied, delta, gapBefore, gapAfter }
}
