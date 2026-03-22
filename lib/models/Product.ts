import mongoose, { Schema, model, models } from 'mongoose'

const ProductSchema = new Schema(
  {
    name: {
      ar: { type: String, required: true },
      fr: { type: String, required: true },
    },
    description: {
      ar: { type: String, default: '' },
      fr: { type: String, default: '' },
    },
    price: { type: Number, required: true, min: 0 },
    image: { type: String, default: '' },
    category: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    supplements: [{ type: Schema.Types.ObjectId, ref: 'Supplement' }],
    isAvailable: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
)

export const Product = models.Product || model('Product', ProductSchema)
export type ProductDoc = mongoose.InferSchemaType<typeof ProductSchema>
