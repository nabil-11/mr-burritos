import mongoose, { Schema, model, models } from 'mongoose'
import { DEFAULT_ORDER_SOURCE, ORDER_SOURCES } from '../orderSource'

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
      latitude: { type: Number },
      longitude: { type: Number },
    },
    items: [OrderItemSchema],
    subtotal: { type: Number, required: true },
    // What came off the subtotal, and why. Stored on the order rather than
    // recomputed, so changing the promo later never rewrites past receipts.
    discount: {
      label: { type: String, default: '' },
      rate: { type: Number, default: 0 },
      amount: { type: Number, default: 0 },
    },
    // What was added to the subtotal, and why. The counterpart of `discount`,
    // stored the same way and for the same reason: a supplement agreed at the
    // counter — a fee, an extra portion, a delivery arranged on the spot —
    // must still read the same on the ticket a month later.
    surcharge: {
      label: { type: String, default: '' },
      amount: { type: Number, default: 0 },
    },
    total: { type: Number, required: true },
    type: {
      type: String,
      enum: ['delivery', 'pickup'],
      required: true,
    },
    // Channel the order came in through — site web, logiciel de caisse, or the
    // in-store kiosk. Distinct from `type`: a counter order can still be a
    // delivery, and a web order can still be picked up. Orders taken before this
    // field existed carry no value at all, so readers treat "missing" as unknown
    // rather than as the default.
    source: {
      type: String,
      enum: ORDER_SOURCES,
      default: DEFAULT_ORDER_SOURCE,
      index: true,
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
    deliveryFee: { type: Number, default: 0, min: 0, max: 10 },
    assignedDelivery: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reference: { type: String, default: '' },
    notes: { type: String, default: '' },
    confirmedAt: { type: Date },
    preparationDuration: { type: Number, default: 30 },
    // Set when the caisse takes an order in hand: it accepted the order and
    // started the preparation clock, so the same countdown that runs on-site
    // orders should carry this one to "prête" on its own. Without it a web
    // order accepted at the till would sit in "en préparation" until the
    // overdue sweep cancelled it.
    autoReady: { type: Boolean, default: false },
  },
  { timestamps: true }
)

export const Order = models.Order || model('Order', OrderSchema)
export type OrderDoc = mongoose.InferSchemaType<typeof OrderSchema>
