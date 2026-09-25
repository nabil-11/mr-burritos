import mongoose, { Schema, model, models } from 'mongoose'
import { MOVEMENT_KINDS } from '../movementKinds'

/**
 * A recette is one till session.
 *
 * It is opened at the start of service, it collects every order taken while it
 * is open, and it is closed at the end. Closing freezes the figures: a closed
 * session's report never moves again, even if one of its orders changes status
 * afterwards.
 *
 * One open session at a time — enforced by the partial unique index below, in
 * the database itself, so two cashiers clicking at the same moment cannot end
 * up with two concurrent sessions.
 */

const TotalsSchema = new Schema(
  {
    orders: { type: Number, default: 0 },
    cancelled: { type: Number, default: 0 },
    inProgress: { type: Number, default: 0 },
    revenue: { type: Number, default: 0 },
    net: { type: Number, default: 0 },
    discounts: { type: Number, default: 0 },
    surcharges: { type: Number, default: 0 },
    deliveryFees: { type: Number, default: 0 },
    commission: { type: Number, default: 0 },
    // The ones below carry no default on purpose. A session closed before
    // cash-outs existed must read as "not recorded", not as a zero — a zero
    // here would quietly rewrite its drawer as empty. See normalizeTotals.
    /** Cash taken on the premises — caisse and borne, no delivery platform. */
    cashSales: { type: Number },
    /** Sales paid by card — takings that never reach the drawer. */
    cardSales: { type: Number },
    achats: { type: Number },
    depenses: { type: Number },
    /** Cash put into the drawer mid-service — a top-up, never a sale. */
    apports: { type: Number },
    /** Cash taken out without being spent — a deposit, never an expense. */
    retraits: { type: Number },
    /** What the delivery platforms collected for the shop, commission deducted. */
    platformDue: { type: Number },
    /** The part of platformDue whose payout had been ticked off by closing time. */
    platformPaid: { type: Number },
    /** Sales whose settlement was never recorded — neither cash, TPE nor platform. */
    unsettled: { type: Number },
    /**
     * La question de la fermeture, figée comme le reste : l'argent arrivé
     * (`collected` — espèces, TPE, versements déjà pointés) et celui qui
     * manquait encore (`receivable`). Gelés au moment de la clôture : un
     * versement encaissé trois jours plus tard appartient à ce jour-là, pas à
     * celui-ci.
     */
    collected: { type: Number },
    receivable: { type: Number },
    /** One line per delivery platform: Glovo, Jumia, a rider of one's own. */
    byCompany: { type: Schema.Types.Mixed },
    /** Net takings minus achats and dépenses. Top-ups and withdrawals cost nothing. */
    solde: { type: Number },
    /** What the drawer should hold on top of the float: everything in, minus everything out. */
    cashExpected: { type: Number, default: 0 },
    byType: { type: Schema.Types.Mixed, default: {} },
    bySource: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false }
)

/**
 * Cash that moved during the session, in or out.
 *
 * - achat   — goods for the kitchen: bread, vegetables, drinks, packaging, gas
 * - depense — anything else paid in cash: a rider, a staff advance, a repair
 * - apport  — cash put in: change bought, an advance from the safe or the bank
 * - retrait — cash taken out unspent: a bank deposit, the safe, the owner
 *
 * The first two cost the restaurant money; the last two only move it from one
 * place to another. Both change what the drawer should hold, which is why one
 * list carries them all.
 *
 * Never deleted. A mistake is cancelled and stays on the record, struck
 * through: a drawer that came up short has to be explainable line by line.
 */
const MovementSchema = new Schema({
  kind: { type: String, enum: MOVEMENT_KINDS, required: true },
  label: { type: String, required: true, trim: true, maxlength: 80 },
  amount: { type: Number, required: true, min: 0.01 },
  note: { type: String, default: '', trim: true, maxlength: 200 },
  createdAt: { type: Date, default: Date.now },
  createdBy: { name: { type: String, default: '' } },
  cancelledAt: { type: Date, default: null },
  cancelledBy: { name: { type: String, default: '' } },
})

const RecetteSchema = new Schema(
  {
    // R-20260909-01 — readable on a ticket, unique.
    number: { type: String, required: true, unique: true },
    status: { type: String, enum: ['open', 'closed'], default: 'open' },
    openedAt: { type: Date, default: Date.now },
    closedAt: { type: Date, default: null },
    // Who opened and who closed. The name is copied in: if the account is
    // renamed or deleted later, the session keeps the name it had on the day.
    openedBy: {
      user: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      name: { type: String, default: '' },
    },
    closedBy: {
      user: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      name: { type: String, default: '' },
    },
    /** Cash placed in the drawer at opening. */
    openingFloat: { type: Number, default: 0 },
    /** Cash counted at closing. `null` means it was not counted. */
    closingCash: { type: Number, default: null },
    notes: { type: String, default: '' },
    /** Every movement of cash in or out of the drawer, in the order it happened. */
    mouvements: { type: [MovementSchema], default: [] },
    /** Snapshot of the figures taken at closing. Empty while the session runs. */
    totals: { type: TotalsSchema, default: null },
  },
  { timestamps: true }
)

// At most one open session, whatever happens. This partial index also serves
// the "is the till open?" lookup, so `status` needs no index of its own.
RecetteSchema.index({ status: 1 }, { unique: true, partialFilterExpression: { status: 'open' } })
RecetteSchema.index({ openedAt: -1 })

export const Recette = models.Recette || model('Recette', RecetteSchema)
export type RecetteDoc = mongoose.InferSchemaType<typeof RecetteSchema>
