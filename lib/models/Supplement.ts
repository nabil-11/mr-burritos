import mongoose, { Schema, model, models } from 'mongoose'

const SupplementSchema = new Schema(
  {
    name: {
      ar: { type: String, required: true },
      fr: { type: String, required: true },
    },
    price: { type: Number, required: true, min: 0 },
    type: {
      type: String,
      enum: ['sauce', 'size', 'viande', 'extra'],
      default: 'extra',
    },
    // Viandes are pictured in the builder, so they carry their own image.
    image: { type: String, default: '' },
    // Optional transparent PNG used as one slice of the ingredient stack.
    // Empty falls back to a tinted placeholder bar.
    layerImage: { type: String, default: '' },
    // Sizes only: how many viandes the customer picks (M 1, XL 2, XXL 3).
    meatCount: { type: Number, default: 1, min: 1 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
)

export const Supplement = models.Supplement || model('Supplement', SupplementSchema)
export type SupplementDoc = mongoose.InferSchemaType<typeof SupplementSchema>
