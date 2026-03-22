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
      enum: ['sauce', 'size', 'extra'],
      default: 'extra',
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
)

export const Supplement = models.Supplement || model('Supplement', SupplementSchema)
export type SupplementDoc = mongoose.InferSchemaType<typeof SupplementSchema>
