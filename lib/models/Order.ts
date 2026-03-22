import mongoose, { Schema, model, models } from 'mongoose'

const OrderItemSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { ar: String, fr: String },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true },
    supplements: [
      {
        supplement: { type: Schema.Types.ObjectId, ref: 'Supplement' },
        name: { ar: String, fr: String },
        price: Number,
      },
    ],
    notes: { type: String, default: '' },
  },
  { _id: false }
)

const OrderSchema = new Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    customer: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      email: { type: String, default: '' },
      address: { type: String, default: '' },
    },
    items: [OrderItemSchema],
    subtotal: { type: Number, required: true },
    total: { type: Number, required: true },
    type: {
      type: String,
      enum: ['delivery', 'pickup'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'],
      default: 'pending',
    },
    deliveryCompany: {
      companyId: { type: Schema.Types.ObjectId, ref: 'DeliveryCompany', default: null },
      name: { type: String, default: '' },
      commission: { type: Number, default: 0 },
    },
    reference: { type: String, default: '' },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
)

export const Order = models.Order || model('Order', OrderSchema)
export type OrderDoc = mongoose.InferSchemaType<typeof OrderSchema>
