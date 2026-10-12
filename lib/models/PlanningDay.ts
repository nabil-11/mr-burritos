import mongoose, { model, models, Schema } from 'mongoose'
import { DAY_KINDS } from '../planning'

/**
 * Une exception au planning : ce qu'un employé fait un jour précis, quand ce
 * n'est pas ce que dit sa semaine type — un congé, une absence, un repos
 * décalé, des horaires changés.
 *
 * Un document par employé et par jour, pas plus : poser une exception sur un
 * jour qui en a déjà une la remplace. La supprimer rend le jour à la semaine
 * type (voir lib/planning).
 */
const PlanningDaySchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    /** Le jour, à l'heure du restaurant : « 2026-10-12 ». Une chaîne, pour ne dépendre d'aucun fuseau. */
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    kind: { type: String, enum: DAY_KINDS, required: true },
    /** Pour un jour travaillé seulement ; vide = les horaires de la semaine type. */
    shifts: {
      type: [new Schema({ from: { type: String, required: true }, to: { type: String, required: true } }, { _id: false })],
      default: [],
    },
    note: { type: String, default: '', trim: true, maxlength: 200 },
    updatedBy: { name: { type: String, default: '' } },
  },
  { timestamps: true }
)

PlanningDaySchema.index({ employee: 1, date: 1 }, { unique: true })
PlanningDaySchema.index({ date: 1 })

export const PlanningDay = models.PlanningDay || model('PlanningDay', PlanningDaySchema)
export type PlanningDayDoc = mongoose.InferSchemaType<typeof PlanningDaySchema>
