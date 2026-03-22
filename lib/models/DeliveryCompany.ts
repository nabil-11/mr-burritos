import { model, models, Schema } from 'mongoose'

const DeliveryCompanySchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    commission: { type: Number, required: true, min: 0, max: 100 }, // percentage e.g. 30
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
)

export const DeliveryCompany = models.DeliveryCompany || model('DeliveryCompany', DeliveryCompanySchema)
