import mongoose, { Schema, model, models } from 'mongoose'

const ConfigurationSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: Schema.Types.Mixed, required: true },
    type: {
      type: String,
      enum: ['string', 'number', 'boolean', 'json'],
      default: 'string',
    },
    description: { type: String, default: '' },
  },
  { timestamps: true }
)

export const Configuration = models.Configuration || model('Configuration', ConfigurationSchema)
export type ConfigurationDoc = mongoose.InferSchemaType<typeof ConfigurationSchema>
