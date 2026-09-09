import mongoose, { Schema, model, models } from 'mongoose'

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
    cashExpected: { type: Number, default: 0 },
    byType: { type: Schema.Types.Mixed, default: {} },
    bySource: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false }
)

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
