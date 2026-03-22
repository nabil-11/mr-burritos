import mongoose, { Schema, model, models } from 'mongoose'

const ReservationSchema = new Schema(
  {
    customer: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      email: { type: String, default: '' },
    },
    date: { type: Date, required: true },
    time: { type: String, required: true },
    guests: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled'],
      default: 'pending',
    },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
)

export const Reservation = models.Reservation || model('Reservation', ReservationSchema)
export type ReservationDoc = mongoose.InferSchemaType<typeof ReservationSchema>
