import mongoose, { Schema, model, models } from 'mongoose'

// A "theme" is a cross-category label for products (e.g. Healthy, Épicé,
// Végétarien). A product can carry several themes.
const ThemeSchema = new Schema(
  {
    name: {
      ar: { type: String, required: true },
      fr: { type: String, required: true },
    },
    slug: { type: String, required: true, unique: true },
    color: { type: String, default: '#10B981' }, // badge color
    icon: { type: String, default: '' },          // optional emoji
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
)

export const Theme = models.Theme || model('Theme', ThemeSchema)
export type ThemeDoc = mongoose.InferSchemaType<typeof ThemeSchema>
