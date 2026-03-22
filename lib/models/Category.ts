import mongoose, { Schema, model, models } from 'mongoose'

const CategorySchema = new Schema(
  {
    name: {
      ar: { type: String, required: true },
      fr: { type: String, required: true },
    },
    slug: { type: String, required: true, unique: true },
    image: { type: String, default: '' },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
)

export const Category = models.Category || model('Category', CategorySchema)
export type CategoryDoc = mongoose.InferSchemaType<typeof CategorySchema>
