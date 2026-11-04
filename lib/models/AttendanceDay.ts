import mongoose, { Schema, model, models } from 'mongoose'

/**
 * Le marqueur « le pointage de ce jour est validé ».
 *
 * Un document par jour, pas plus : `date` (« 2026-11-03 », jour de Tunis) est
 * unique, et la validation est un upsert `$setOnInsert` — le premier qui valide
 * reste celui qu'on lit. On ne dévalide pas : aucune route ne le supprime.
 * Sans marqueur, les lignes `Attendance` du jour ne sont que des brouillons.
 *
 * Le nom (l'e-mail du compte) est copié, comme sur PlanningValidation :
 * renommer le compte plus tard ne réécrit pas l'histoire.
 */
const AttendanceDaySchema = new Schema(
  {
    date: { type: String, required: true, unique: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    validatedBy: {
      user: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      name: { type: String, default: '' },
    },
    validatedAt: { type: Date, required: true },
  },
  { timestamps: true }
)

export const AttendanceDay = models.AttendanceDay || model('AttendanceDay', AttendanceDaySchema)
export type AttendanceDayDoc = mongoose.InferSchemaType<typeof AttendanceDaySchema>
