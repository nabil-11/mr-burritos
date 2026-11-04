import mongoose, { Schema, model, models } from 'mongoose'

/**
 * Le pointage d'un employé pour un jour de service : présent (et à quelles
 * heures) ou absent (justifié ou non). Voir lib/attendance pour les règles.
 *
 * Un document par employé et par jour. Les minutes (retard, départ anticipé,
 * heures en plus, heures faites) sont toujours calculées par le serveur, jamais
 * lues d'un corps de requête. Le planning d'alors est figé dans `planned` — son
 * statut, ses horaires, sa provenance, sans la note du planning ni le motif
 * d'une maladie (`maladie` y devient `absence`) : relire un vieux pointage ne
 * dépend pas du planning d'aujourd'hui.
 *
 * `history` garde les 20 dernières modifications ; `historyDropped` compte
 * celles qui sont sorties. `created` épingle qui a créé la ligne (et avec quoi) :
 * le plafond de l'historique ne l'enlève jamais. L'historique est écrit par le serveur seulement.
 * Les dates sont des chaînes AAAA-MM-JJ à l'heure de Tunis, comme PlanningDay.
 */
const ShiftSchema = new Schema({ from: { type: String, required: true }, to: { type: String, required: true } }, { _id: false })

const PlannedSchema = new Schema(
  {
    status: { type: String, enum: ['travail', 'repos', 'conge', 'absence', 'none'], required: true },
    shifts: { type: [ShiftSchema], default: [] },
    source: { type: String, enum: ['semaine', 'exception', 'none'], default: 'none' },
  },
  { _id: false }
)

const HistorySchema = new Schema(
  {
    at: { type: Date, required: true },
    by: { type: String, default: '' },
    // { status, justification, shifts, note } — null à la création.
    before: { type: Schema.Types.Mixed, default: null },
    after: { type: Schema.Types.Mixed, required: true },
  },
  { _id: false }
)

const AttendanceSchema = new Schema({
  employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
  date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  status: { type: String, enum: ['present', 'absent'], required: true },
  justification: { type: String, enum: ['justifiee', 'non_justifiee', null], default: null },
  shifts: { type: [ShiftSchema], default: [] },
  unplanned: { type: Boolean, default: false },
  lateMinutes: { type: Number, default: 0, min: 0 },
  earlyMinutes: { type: Number, default: 0, min: 0 },
  extraMinutes: { type: Number, default: 0, min: 0 },
  workedMinutes: { type: Number, default: 0, min: 0 },
  note: { type: String, default: '', trim: true, maxlength: 200 },
  planned: { type: PlannedSchema, required: true },
  updatedBy: {
    user: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    name: { type: String, default: '' },
  },
  /** La dernière modification des données (pas un simple rafraîchissement du planning figé). */
  updatedAt: { type: Date, default: null },
  createdAt: { type: Date, default: null },
  history: { type: [HistorySchema], default: [] },
  created: {
    type: new Schema({ at: { type: Date, required: true }, by: { type: String, default: '' }, after: { type: Schema.Types.Mixed, required: true } }, { _id: false }),
    default: null,
  },
  historyDropped: { type: Number, default: 0, min: 0 },
})

AttendanceSchema.index({ employee: 1, date: 1 }, { unique: true })
AttendanceSchema.index({ date: 1 })

export const Attendance = models.Attendance || model('Attendance', AttendanceSchema)
export type AttendanceDoc = mongoose.InferSchemaType<typeof AttendanceSchema>
