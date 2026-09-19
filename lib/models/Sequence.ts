import { Schema, model, models } from 'mongoose'

/**
 * Named counters, one document each — "order-2026-09-19" holds how many
 * orders that day has numbered so far. Incremented atomically with $inc, so
 * two orders placed in the same millisecond still get two numbers.
 */
const SequenceSchema = new Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
  },
  { versionKey: false }
)

export const Sequence = models.Sequence || model('Sequence', SequenceSchema)
