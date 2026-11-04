import mongoose, { Schema, model, models } from 'mongoose'

/**
 * Le marqueur « cette semaine de planning est validée ».
 *
 * Un document par semaine, pas plus : `weekStart` (le lundi, « 2026-11-09 »)
 * est unique, et la validation est un upsert `$setOnInsert` — le premier qui
 * valide reste celui qu'on lit. On ne dévalide pas : le marqueur n'a pas de
 * route de suppression.
 *
 * Le nom est copié, comme sur les recettes : renommer le compte plus tard ne
 * réécrit pas l'histoire.
 */
const PlanningValidationSchema = new Schema(
  {
    weekStart: { type: String, required: true, unique: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    validatedBy: {
      user: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      name: { type: String, default: '' },
    },
    validatedAt: { type: Date, required: true },
  },
  { timestamps: true }
)

export const PlanningValidation = models.PlanningValidation || model('PlanningValidation', PlanningValidationSchema)
export type PlanningValidationDoc = mongoose.InferSchemaType<typeof PlanningValidationSchema>
