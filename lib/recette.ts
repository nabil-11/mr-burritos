import mongoose from 'mongoose'
import { connectDB } from './mongodb'
import { Order } from './models/Order'
import { Recette } from './models/Recette'
import { ORDER_SOURCES, type OrderSource } from './orderSource'
import { MOVEMENT_KINDS, type MovementKind, isMovementKind } from './movementKinds'
import { companyOf, isPaid, moneyPocket } from './platformSettlement'

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
 *
 * Cash also moves while the service runs, both ways — the bread bought at
 * nine, the rider paid at noon, the 50 DT of change put in at one o'clock
 * because the drawer had run out of small notes. All of it is recorded on the
 * session itself (`mouvements`), so the count at closing is measured against
 * what the drawer should really hold, not against sales alone.
 *
 * Two of those four cost money (achat, dépense) and two only move it (apport,
 * retrait) — see lib/movementKinds. The distinction is the whole point: a
 * drawer topped up with 50 DT holds 50 DT more, but the service earned not a
 * millime more for it.
 */

/** An error carrying the HTTP status the API should answer with. */
export class RecetteError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

export { MOVEMENT_KINDS }
export type { MovementKind }

export interface Bucket {
  count: number
  revenue: number
}

/**
 * Ce qu'une plateforme a apporté sur la session — Glovo, Jumia, un coursier
 * maison. Le chiffre qui compte en fin de journée n'est pas le brut mais
 * `net` : ce que la plateforme reversera une fois sa commission prise.
 */
export interface CompanyBucket {
  name: string
  count: number
  /** Ce que les clients ont payé, commission comprise. */
  revenue: number
  /** Le taux appliqué, ou null si plusieurs taux se sont mélangés. */
  rate: number | null
  commission: number
  /** Brut moins commission : ce que le restaurant garde sur ces commandes. */
  net: number
  /** La part déjà encaissée au comptoir — un livreur qui paie en espèces. */
  cash: number
  /**
   * Ce que la plateforme doit encore verser : le net des seules commandes
   * qu'elle a encaissées elle-même. Sur une commande payée en espèces au
   * comptoir, l'argent est déjà là — la compter ici la ferait attendre deux
   * fois. La somme des `due` fait exactement `platformDue`.
   */
  due: number
  /**
   * La part de `due` dont le versement a déjà été pointé — voir
   * lib/platformSettlement. Ce qui reste réellement à encaisser est donc
   * `due − settled`.
   */
  settled: number
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
   * Sales paid in cash — what went into the drawer.
   *
   * Read off the payment the till records. Where none was recorded, the
   * channel answers: the counter, the kiosk and the website all take their
   * money on the spot — the site charges nothing online, the customer pays at
   * the counter or to the driver — so that sale is cash in the drawer. Only a
   * platform collects on our behalf and pays later. See lib/platformSettlement.
   */
  cashSales: number
  /** Sales paid by card: takings that never touch the drawer. */
  cardSales: number
  /** Goods paid for out of the drawer — cancelled entries excluded. */
  achats: number
  /** Everything else paid out of the drawer — cancelled entries excluded. */
  depenses: number
  /** Cash added to the drawer mid-service. Not a sale: it buys nothing. */
  apports: number
  /** Cash taken out of the drawer unspent — bank, safe, owner. Not an expense. */
  retraits: number
  /**
   * Où est l'argent du service, en quatre poches qui ne se recouvrent pas :
   * `cashSales` dans le tiroir, `cardSales` en banque, `platformDue` chez les
   * plateformes, `unsettled` nulle part de connu. Avec les commissions des
   * commandes non encaissées en espèces, les quatre font le chiffre d'affaires.
   */
  /** Ce que les plateformes ont encaissé pour le restaurant, commissions déduites. */
  platformDue: number
  /**
   * La part de `platformDue` dont le versement a déjà été pointé. Elle reste
   * dans `platformDue` — c'est bien la plateforme qui a encaissé — mais elle
   * n'est plus attendue : voir `receivable`.
   */
  platformPaid: number
  /** Ventes dont le règlement n'a jamais été enregistré. Ni un reproche, ni un oubli à cacher. */
  unsettled: number
  /** Une ligne par plateforme, la plus grosse d'abord. */
  byCompany: CompanyBucket[]
  /**
   * La question de la fin de journée, en deux nombres.
   *
   * `collected` : l'argent réellement arrivé — les espèces du tiroir, ce que
   * le TPE a pris (payé, mais en banque et non dans la caisse), et les
   * versements de plateformes déjà pointés.
   *
   * `receivable` : ce qui manque encore à l'appel — le net que les
   * plateformes n'ont pas versé, et les ventes dont personne n'a noté le
   * règlement. Rien n'est compté deux fois : chaque commande tombe dans une
   * seule poche (voir lib/platformSettlement).
   */
  collected: number
  receivable: number
  /** What the drawer should hold on top of the opening float. */
  cashExpected: number
  /** Net takings once achats and dépenses are paid. Top-ups change nothing here. */
  solde: number
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
  payment?: { method?: string } | null
}

type MovementLike = {
  kind?: string
  amount?: number
  cancelledAt?: Date | string | null
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
    cashSales: 0,
    cardSales: 0,
    achats: 0,
    depenses: 0,
    apports: 0,
    retraits: 0,
    platformDue: 0,
    platformPaid: 0,
    unsettled: 0,
    byCompany: [],
    collected: 0,
    receivable: 0,
    cashExpected: 0,
    solde: 0,
    byType: { delivery: { count: 0, revenue: 0 }, pickup: { count: 0, revenue: 0 } },
    bySource,
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100

const MONEY_KEYS = [
  'revenue', 'net', 'discounts', 'surcharges', 'deliveryFees', 'commission',
  'cashSales', 'cardSales', 'achats', 'depenses', 'apports', 'retraits',
  'platformDue', 'platformPaid', 'unsettled', 'collected', 'receivable', 'cashExpected', 'solde',
] as const

/**
 * Adds up a session's orders and cash-outs. Pure, so the same arithmetic
 * serves the live figures of an open session and the snapshot frozen into a
 * closed one.
 */
export function computeTotals(orders: OrderLike[], movements: MovementLike[] = []): RecetteTotals {
  const totals = emptyTotals()
  const companies = new Map<string, CompanyBucket>()

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

    // La même commande ne tombe que dans une poche, et c'est lib/platformSettlement
    // qui tranche — le même arbitrage que celui des créances plateformes. Deux
    // copies de cette règle finiraient par se contredire, et le tiroir aurait
    // tort contre les factures.
    const company = companyOf(order)
    const pocket = moneyPocket(order)
    if (pocket === 'drawer') totals.cashSales += total
    else if (pocket === 'bank') totals.cardSales += total
    // Une commande Glovo payée dans l'application n'est pas encore de l'argent
    // reçu : elle est due, jusqu'à ce que le versement soit pointé.
    else if (pocket === 'platform') {
      totals.platformDue += total - commission
      if (isPaid(order)) totals.platformPaid += total - commission
    } else totals.unsettled += total

    if (company) {
      const bucket = companies.get(company) ?? {
        name: company,
        count: 0,
        revenue: 0,
        rate,
        commission: 0,
        net: 0,
        cash: 0,
        due: 0,
        settled: 0,
      }
      bucket.count++
      bucket.revenue += total
      bucket.commission += commission
      bucket.net += total - commission
      if (pocket === 'drawer') bucket.cash += total
      else if (pocket === 'platform') {
        bucket.due += total - commission
        if (isPaid(order)) bucket.settled += total - commission
      }
      // Un taux renégocié en cours de journée : mieux vaut n'en afficher aucun
      // qu'en afficher un qui ne vaut que pour la moitié des commandes.
      if (bucket.rate !== null && bucket.rate !== rate) bucket.rate = null
      companies.set(company, bucket)
    }
  }

  // La plus grosse plateforme en premier : c'est celle dont on veut le total.
  totals.byCompany = [...companies.values()]
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

  // A cancelled entry stays on the record but moves no money.
  for (const movement of movements) {
    if (movement.cancelledAt) continue
    const amount = Number(movement.amount) || 0
    if (movement.kind === 'achat') totals.achats += amount
    else if (movement.kind === 'depense') totals.depenses += amount
    else if (movement.kind === 'apport') totals.apports += amount
    else if (movement.kind === 'retrait') totals.retraits += amount
  }

  // The drawer counts every movement; the result counts only what was spent.
  // Putting 50 DT of change in makes the drawer heavier, not the day better.
  totals.cashExpected =
    totals.cashSales + totals.apports - totals.retraits - totals.achats - totals.depenses
  totals.solde = totals.net - totals.achats - totals.depenses

  // Payé / pas payé : les quatre poches, regroupées selon la seule question
  // qui compte à la fermeture — cet argent est-il arrivé, oui ou non ?
  totals.collected = totals.cashSales + totals.cardSales + totals.platformPaid
  totals.receivable = totals.platformDue - totals.platformPaid + totals.unsettled

  // Sums of prices drift into 12.300000000000001; a report shows centimes.
  for (const key of MONEY_KEYS) totals[key] = round2(totals[key])
  for (const bucket of [...Object.values(totals.byType), ...Object.values(totals.bySource)]) {
    bucket.revenue = round2(bucket.revenue)
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
 * A frozen snapshot, completed if it predates cash-outs. Such a session had no
 * achats or dépenses, so every cash sale was still in the drawer: its figures
 * read exactly as they did the day it was closed.
 */
function normalizeTotals(raw: RecetteTotals): RecetteTotals {
  const withToObject = raw as unknown as { toObject?: () => RecetteTotals }
  const totals = typeof withToObject.toObject === 'function' ? withToObject.toObject() : raw
  const base =
    typeof totals.cashSales === 'number'
      ? totals
      : { ...totals, cashSales: totals.cashExpected ?? 0, achats: 0, depenses: 0, solde: totals.net ?? 0 }
  // Card payments, top-ups, withdrawals and the platform breakdown each
  // arrived after some sessions had already been closed. A missing figure
  // reads as zero rather than being recomputed: a status changed weeks later
  // must not rewrite a report that has been signed off.
  const cardSales = base.cardSales ?? 0
  const platformDue = base.platformDue ?? 0
  const platformPaid = base.platformPaid ?? 0
  const unsettled = base.unsettled ?? 0
  return {
    ...base,
    cardSales,
    apports: base.apports ?? 0,
    retraits: base.retraits ?? 0,
    platformDue,
    platformPaid,
    unsettled,
    byCompany: Array.isArray(base.byCompany)
      ? base.byCompany.map((c) => ({ ...c, settled: c.settled ?? 0 }))
      : [],
    // « Encaissé » et « à recevoir » sont arrivés après certaines clôtures.
    // Ils se déduisent des poches déjà figées plutôt que d'être recalculés sur
    // les commandes : une session close garde les chiffres de son soir, y
    // compris l'ignorance où l'on était alors des versements à venir.
    collected: base.collected ?? round2((base.cashSales ?? 0) + cardSales + platformPaid),
    receivable: base.receivable ?? round2(platformDue - platformPaid + unsettled),
  }
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
  mouvements?: MovementLike[] | null
}): Promise<RecetteTotals> {
  if (recette.status === 'closed' && recette.totals) return normalizeTotals(recette.totals)
  return computeTotals(
    (await recetteOrders(recette._id)) as OrderLike[],
    (recette.mouvements ?? []) as MovementLike[]
  )
}

/**
 * What the drawer should hold at this instant: the float it opened with, plus
 * everything that came in, less everything that went out.
 *
 * The figure a cashier can check against the notes in front of them — and the
 * one an achat is weighed against before it is recorded, since a drawer that
 * does not hold 40 DT cannot pay 40 DT of bread.
 */
export function cashInDrawer(
  recette: { openingFloat?: number },
  totals: Pick<RecetteTotals, 'cashExpected'>
): number {
  return round2((recette.openingFloat || 0) + totals.cashExpected)
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
  return round2(recette.closingCash - cashInDrawer(recette, totals))
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

/**
 * Closes a session and freezes its figures.
 *
 * Two steps, in this order. The status flips first, in one atomic update: from
 * that instant no achat, dépense or cancellation can land, because each of
 * those only matches an open session. The entries read back are therefore
 * final, and the totals frozen from them are complete.
 *
 * Reading first and saving after — the obvious way — leaves a gap: an achat
 * pushed in between stays on the session but is missing from its frozen
 * totals, and the drawer no longer adds up.
 */
export async function closeRecette(id: string, input: CloseInput) {
  if (!mongoose.isValidObjectId(id)) throw new RecetteError('Recette introuvable', 404)
  await connectDB()

  const set: Record<string, unknown> = {
    status: 'closed',
    closedAt: new Date(),
    closedBy: { user: input.userId ?? null, name: input.userName ?? '' },
  }
  if (typeof input.closingCash === 'number' && Number.isFinite(input.closingCash)) {
    set.closingCash = input.closingCash
  }
  if (typeof input.notes === 'string' && input.notes.trim()) set.notes = input.notes.trim()

  const recette = await Recette.findOneAndUpdate(
    { _id: id, status: 'open' },
    { $set: set },
    { returnDocument: 'after' }
  )
  if (!recette) {
    if (await Recette.exists({ _id: id })) throw new RecetteError('Recette déjà clôturée', 409)
    throw new RecetteError('Recette introuvable', 404)
  }

  recette.totals = computeTotals(
    (await recetteOrders(recette._id)) as OrderLike[],
    recette.mouvements as MovementLike[]
  )
  await recette.save()
  return recette
}

// ── Mouvements de caisse ────────────────────────────────────────────────────

/** Above this, a typing slip is far likelier than a real movement. */
const MAX_MOVEMENT = 100_000

export interface MovementInput {
  kind?: unknown
  label?: unknown
  amount?: unknown
  note?: unknown
  userName?: string
}

function cleanMovement(input: MovementInput) {
  const kind = input.kind
  if (!isMovementKind(kind)) {
    throw new RecetteError('Type de mouvement invalide : achat, dépense, apport ou retrait', 400)
  }
  const label = typeof input.label === 'string' ? input.label.trim().slice(0, 80) : ''
  if (!label) throw new RecetteError('Indiquez un libellé', 400)
  // A till types "12,5" as readily as 12.5.
  const amount = round2(Number(String(input.amount ?? '').replace(',', '.')))
  if (!Number.isFinite(amount) || amount <= 0) throw new RecetteError('Montant invalide', 400)
  if (amount > MAX_MOVEMENT) throw new RecetteError('Montant trop élevé', 400)
  const note = typeof input.note === 'string' ? input.note.trim().slice(0, 200) : ''
  return { kind, label, amount, note }
}

/** Why an update guarded on an open session matched nothing. */
async function sessionMiss(id: string): Promise<never> {
  const found = await Recette.exists({ _id: id })
  if (!found) throw new RecetteError('Recette introuvable', 404)
  throw new RecetteError('Recette clôturée : ses chiffres sont figés', 409)
}

/** Beyond this, it is no longer one decision being recorded. */
const MAX_AT_ONCE = 4

/**
 * Records movements on an open session — one, or several in a single update.
 *
 * Several at once is not a convenience. "The drawer is short, so I put 20 DT
 * in and then paid the 35 DT of bread" is one decision, and the two lines it
 * produces belong together: pushed one after the other, a failure in between
 * would leave a top-up on the record with nothing to explain it, and a drawer
 * that no longer adds up. `$each` lands them together or not at all.
 *
 * The open status is part of the update's filter rather than a check made
 * beforehand: a session closed a millisecond earlier cannot receive an entry
 * after its figures were frozen.
 */
export async function addMovements(recetteId: string, inputs: MovementInput[], userName = '') {
  if (!Array.isArray(inputs) || inputs.length === 0) {
    throw new RecetteError('Aucun mouvement à enregistrer', 400)
  }
  if (inputs.length > MAX_AT_ONCE) throw new RecetteError('Trop de mouvements en une fois', 400)
  const cleaned = inputs.map(cleanMovement)
  if (!mongoose.isValidObjectId(recetteId)) throw new RecetteError('Recette introuvable', 404)
  await connectDB()

  // One instant, one millisecond apart, so the list keeps the order they were
  // decided in: the top-up above the achat it paid for.
  const now = Date.now()
  const updated = await Recette.findOneAndUpdate(
    { _id: recetteId, status: 'open' },
    {
      $push: {
        mouvements: {
          $each: cleaned.map((movement, i) => ({
            ...movement,
            createdAt: new Date(now + i),
            createdBy: { name: userName },
          })),
        },
      },
    },
    { returnDocument: 'after', runValidators: true }
  )
  return updated ?? sessionMiss(recetteId)
}

/** Un seul mouvement — voir addMovements. */
export async function addMovement(recetteId: string, input: MovementInput) {
  return addMovements(recetteId, [input], input.userName ?? '')
}

/**
 * Cancels an entry. It stays on the session, struck through and out of the
 * totals — same guard as above, and an entry is only ever cancelled once.
 */
export async function cancelMovement(recetteId: string, movementId: string, userName = '') {
  if (!mongoose.isValidObjectId(recetteId) || !mongoose.isValidObjectId(movementId)) {
    throw new RecetteError('Sortie introuvable', 404)
  }
  await connectDB()

  const updated = await Recette.findOneAndUpdate(
    { _id: recetteId, status: 'open', mouvements: { $elemMatch: { _id: movementId, cancelledAt: null } } },
    { $set: { 'mouvements.$.cancelledAt': new Date(), 'mouvements.$.cancelledBy': { name: userName } } },
    { returnDocument: 'after' }
  )
  if (updated) return updated

  // Nothing matched: say which of the three conditions failed.
  const recette = (await Recette.findById(recetteId).select('status mouvements._id mouvements.cancelledAt').lean()) as {
    status?: string
    mouvements?: { _id: unknown; cancelledAt?: Date | null }[]
  } | null
  if (!recette) throw new RecetteError('Recette introuvable', 404)
  if (recette.status !== 'open') throw new RecetteError('Recette clôturée : ses chiffres sont figés', 409)
  if (!recette.mouvements?.some((m) => String(m._id) === movementId)) {
    throw new RecetteError('Sortie introuvable', 404)
  }
  throw new RecetteError('Sortie déjà annulée', 409)
}
