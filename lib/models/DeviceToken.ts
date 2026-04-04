import mongoose, { Schema } from 'mongoose'

const deviceTokenSchema = new Schema(
  {
    token: { type: String, required: true, unique: true },
    platform: { type: String, enum: ['android', 'ios', 'web'], default: 'android' },
    phone: { type: String, index: true },
    orderNotifications: { type: Boolean, default: true },
    orderReadyNotifications: { type: Boolean, default: true },
  },
  { timestamps: true }
)

export const DeviceToken =
  mongoose.models.DeviceToken ||
  mongoose.model('DeviceToken', deviceTokenSchema)
