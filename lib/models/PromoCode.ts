import mongoose, { model, models, Schema } from 'mongoose'

/**
 * A code a customer types at checkout on the website. Its rules live in
 * lib/promoCodes (may it be used now?) and lib/promo (what is it worth?).
 *
 * Uses are not counted here: they are the website orders that carry the code
 * and were not cancelled. A cancelled order gives its use back on its own, and
 * no counter can drift from the orders it is meant to count.
 */
const PromoCodeSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: { type: String, default: '' },
    kind: { type: String, enum: ['percent', 'fixed'], required: true },
    value: { type: Number, required: true, min: 0 },
    minSubtotal: { type: Number, default: 0, min: 0 },
    startsAt: { type: Date, default: null },
    // The first instant it no longer works — the start of the day after its
    // last valid day, in the shop's time zone.
    expiresAt: { type: Date, required: true },
    /** Every customer together; 0 for no limit. */
    maxUses: { type: Number, default: 0, min: 0 },
    /** Per phone number; 0 for no limit. */
    maxUsesPerCustomer: { type: Number, default: 1, min: 0 },
    stackable: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
)

export const PromoCode = models.PromoCode || model('PromoCode', PromoCodeSchema)
export type PromoCodeDoc = mongoose.InferSchemaType<typeof PromoCodeSchema>
