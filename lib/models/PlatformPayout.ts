import mongoose, { Schema, model, models } from 'mongoose'
import { PAYOUT_METHODS } from '../platformSettlement'

/**
 * Un versement de plateforme : le virement Glovo du lundi, l'espèce remise par
 * un coursier en fin de mois.
 *
 * Pointer les commandes payées suffirait à savoir ce qui reste dû. Ce document
 * existe pour la question d'après, celle qui coûte de l'argent quand personne
 * ne la pose : **la plateforme a-t-elle versé ce qu'elle devait ?** D'où les
 * deux montants côte à côte — `expected`, la somme des nets pointés, et
 * `amount`, ce qui est réellement arrivé sur le compte — et leur écart, figé au
 * moment du pointage.
 *
 * Figé, parce qu'un versement est un fait daté. Une commission renégociée le
 * mois suivant, une commande corrigée, ne doivent pas réécrire un écart qui a
 * déjà été constaté et discuté avec la plateforme.
 */
const PlatformPayoutSchema = new Schema(
  {
    company: {
      companyId: { type: Schema.Types.ObjectId, ref: 'DeliveryCompany', default: null },
      name: { type: String, required: true, trim: true },
    },
    /** Ce que la plateforme a réellement versé. */
    amount: { type: Number, required: true, min: 0 },
    /** Ce que les commandes pointées valaient, net de commission. */
    expected: { type: Number, required: true, min: 0 },
    /** `amount − expected` : négatif, la plateforme a versé moins que dû. */
    gap: { type: Number, required: true },
    /** Combien de commandes ce versement solde. */
    orderCount: { type: Number, required: true, min: 0 },
    /** La période couverte, déduite des commandes pointées — pas saisie. */
    from: { type: Date, default: null },
    to: { type: Date, default: null },
    method: { type: String, enum: PAYOUT_METHODS, default: 'transfer' },
    /** « Glovo S38 », un numéro de virement — ce qui permet de le retrouver. */
    reference: { type: String, default: '', trim: true },
    note: { type: String, default: '' },
    recordedBy: { type: String, default: '' },
  },
  { timestamps: true }
)

// L'écran des règlements liste les versements d'une société, le dernier
// d'abord ; le tableau de bord les liste toutes sur une période.
PlatformPayoutSchema.index({ 'company.name': 1, createdAt: -1 })

export const PlatformPayout =
  models.PlatformPayout || model('PlatformPayout', PlatformPayoutSchema)
export type PlatformPayoutDoc = mongoose.InferSchemaType<typeof PlatformPayoutSchema>
