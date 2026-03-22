import mongoose, { Schema, model, models } from 'mongoose'

const UserSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ['admin', 'manager', 'staff'],
      default: 'staff',
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
)

export const User = models.User || model('User', UserSchema)
export type UserDoc = mongoose.InferSchemaType<typeof UserSchema>
