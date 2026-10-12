import mongoose, { model, models, Schema } from 'mongoose'

/**
 * Un employé du restaurant — pas un compte : il ne se connecte à rien.
 *
 * Chaque employé a un compte courant, tenu par lib/payroll : son salaire y
 * entre chaque mois, les avances et les paiements en sortent, primes et
 * retenues l'ajustent, et ce qui reste dû passe au mois suivant. Les
 * mouvements eux-mêmes vivent ailleurs — les avances et salaires payés en
 * espèces dans les recettes (c'est le tiroir qui les a versés), le reste dans
 * EmployeeEntry. Ce document ne porte que la fiche et le barème.
 */

/** Un salaire mensuel, valable à partir d'un mois. Changer de salaire n'efface pas le passé. */
const SalarySchema = new Schema(
  {
    from: { type: String, required: true, match: /^\d{4}-\d{2}$/ },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
)

const EmployeeSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true, maxlength: 60 },
    /** Cuisinier, caissier, livreur… */
    poste: { type: String, default: '', trim: true, maxlength: 40 },
    phone: { type: String, default: '', trim: true, maxlength: 30 },
    cin: { type: String, default: '', trim: true, maxlength: 20 },
    address: { type: String, default: '', trim: true, maxlength: 120 },
    hireDate: { type: Date, default: null },
    /** Le salaire mensuel actuel — le dernier du barème, gardé ici pour l'affichage. */
    salary: { type: Number, default: 0, min: 0 },
    /** Le barème complet, du plus ancien au plus récent. */
    salaries: { type: [SalarySchema], default: [] },
    /**
     * Premier mois suivi dans le compte. Un employé là depuis des années n'a
     * pas à voir ses salaires de 2019 s'accumuler : on commence le suivi le
     * jour où on l'inscrit, avec ce qui était dû à ce moment-là.
     */
    trackFrom: { type: String, default: null, match: /^\d{4}-\d{2}$/ },
    /** Ce qui lui était dû au début du suivi (négatif : ce qu'il devait). */
    openingBalance: { type: Number, default: 0 },
    notes: { type: String, default: '', trim: true, maxlength: 500 },
    /**
     * Sa semaine type : les créneaux qui se répètent chaque semaine. `day` de
     * 0 (lundi) à 6 (dimanche) ; un jour absent est un jour de repos. Les
     * exceptions d'un jour précis vivent dans PlanningDay — voir lib/planning.
     */
    schedule: {
      type: [
        new Schema(
          {
            day: { type: Number, required: true, min: 0, max: 6 },
            from: { type: String, required: true },
            to: { type: String, required: true },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    isActive: { type: Boolean, default: true },
    /** Quand il a été désactivé : son salaire cesse de courir après ce mois-là. */
    leftAt: { type: Date, default: null },
  },
  { timestamps: true }
)

export const Employee = models.Employee || model('Employee', EmployeeSchema)
export type EmployeeDoc = mongoose.InferSchemaType<typeof EmployeeSchema>
