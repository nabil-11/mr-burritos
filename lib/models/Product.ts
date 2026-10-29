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
    // Prix barré facultatif (« au lieu de ») : le site affiche « 16,50 DT
    // ~~19,50 DT~~ · Économisez 3,00 DT » quand il dépasse le prix. Vide ou
    // inférieur au prix : rien ne s'affiche. N'entre dans aucun calcul.
    compareAtPrice: { type: Number, default: null, min: 0 },
    image: { type: String, default: '' },
    category: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    supplements: [{ type: Schema.Types.ObjectId, ref: 'Supplement' }],
    themes: [{ type: Schema.Types.ObjectId, ref: 'Theme' }],
    isAvailable: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
    // A base product is the category's entry point in the builder ("Tacos",
    // "Burrito") rather than a dish you order by name. Hidden from the menu grid.
    isBase: { type: Boolean, default: false },
  },
  { timestamps: true }
)

export const Product = models.Product || model('Product', ProductSchema)
export type ProductDoc = mongoose.InferSchemaType<typeof ProductSchema>
