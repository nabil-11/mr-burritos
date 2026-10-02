import mongoose, { model, models, Schema } from 'mongoose'

/**
 * Ce qui touche le compte d'un employé sans passer par le tiroir.
 *
 *   prime    — s'ajoute à ce qui lui est dû (heures sup., bonus)
 *   retenue  — s'en déduit (absence, casse)
 *   paiement — un versement hors caisse : virement, chèque, espèces du patron
 *
 * Ce que le tiroir a versé (avances, salaire payé en caisse) n'est pas ici :
 * c'est un mouvement de recette, rattaché à l'employé — voir lib/payroll.
 * Annulée, jamais supprimée : le compte se justifie ligne à ligne.
 */
export const ENTRY_KINDS = ['prime', 'retenue', 'paiement'] as const
export const PAYMENT_METHODS = ['especes', 'virement', 'cheque'] as const

const EmployeeEntrySchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    kind: { type: String, enum: ENTRY_KINDS, required: true },
    amount: { type: Number, required: true, min: 0.01 },
    /** Le jour où elle compte — le mois du compte en découle. */
    date: { type: Date, required: true },
    /** Un paiement seulement : comment il a été versé. */
    method: { type: String, enum: PAYMENT_METHODS, default: null },
    note: { type: String, default: '', trim: true, maxlength: 200 },
    createdBy: { name: { type: String, default: '' } },
    cancelledAt: { type: Date, default: null },
    cancelledBy: { name: { type: String, default: '' } },
  },
  { timestamps: true }
)

export const EmployeeEntry = models.EmployeeEntry || model('EmployeeEntry', EmployeeEntrySchema)
export type EmployeeEntryDoc = mongoose.InferSchemaType<typeof EmployeeEntrySchema>
