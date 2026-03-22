import mongoose, { Schema, model, models } from 'mongoose'

const ReviewSchema = new Schema(
  {
    customerName: { type: String, required: true, trim: true },
    orderNumber:  { type: String, default: '' },
    rating:       { type: Number, required: true, min: 1, max: 5 },
    comment:      { type: String, default: '' },
    isApproved:   { type: Boolean, default: false },
  },
  { timestamps: true }
)

export const Review = models.Review || model('Review', ReviewSchema)
export type ReviewDoc = mongoose.InferSchemaType<typeof ReviewSchema>
