import mongoose, { Schema } from 'mongoose'

const deviceTokenSchema = new Schema(
  {
    token: { type: String, required: true, unique: true },
    platform: { type: String, enum: ['android', 'ios', 'web'], default: 'android' },
    phone: { type: String, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    role: { type: String, enum: ['manager', 'admin', 'delivery'], index: true },
    orderNotifications: { type: Boolean, default: true },
    orderReadyNotifications: { type: Boolean, default: true },
  },
  { timestamps: true }
)

export const DeviceToken =
  mongoose.models.DeviceToken ||
  mongoose.model('DeviceToken', deviceTokenSchema)
