/**
 * Les corrections d'une recette, en mots — sans Mongo ni serveur : les écrans
 * du back-office les importent aussi. La logique vit dans lib/recetteCorrection.
 */

/** Qui peut réécrire les comptes d'un service passé. */
export const CORRECTION_ROLES = ['admin', 'manager']

export const CORRECTION_ACTIONS = [
  'order.settle',
  'order.amount',
  'order.cancel',
  'order.restore',
  'order.add',
  'count',
  'movement.add',
  'movement.cancel',
] as const
export type CorrectionAction = (typeof CORRECTION_ACTIONS)[number]

export const CORRECTION_LABELS: Record<CorrectionAction, string> = {
  'order.settle': 'Plateforme / règlement',
  'order.amount': 'Montant',
  'order.cancel': 'Commande annulée',
  'order.restore': 'Commande rétablie',
  'order.add': 'Vente ajoutée',
  count: 'Comptage',
  'movement.add': 'Mouvement ajouté',
  'movement.cancel': 'Mouvement annulé',
}

/** Comment l'argent d'une commande est arrivé, tel qu'on le choisit dans une correction. */
export const SETTLE_PAYMENTS = ['platform', 'cash', 'card', 'other'] as const
export type SettlePayment = (typeof SETTLE_PAYMENTS)[number]
