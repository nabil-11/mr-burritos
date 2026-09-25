/**
 * Comment l'argent d'une commande est entré — et où il se trouve ensuite.
 *
 * Le mot « carte » disait comment le client avait payé ; il ne disait pas
 * l'essentiel pour qui compte le tiroir le soir : cet argent-là est bien
 * encaissé, mais il n'est pas dans la caisse. « TPE » le dit — c'est le
 * terminal qui l'a pris, et la banque qui l'a.
 *
 * Les valeurs stockées ne changent pas (`cash`, `card`, `other`) : seuls les
 * mots affichés le font. Une commande d'il y a six mois se relit donc avec le
 * vocabulaire d'aujourd'hui, sans migration.
 */

export type PaymentKey = 'cash' | 'card' | 'other' | 'unknown'

export const PAYMENT_LABELS: Record<PaymentKey, string> = {
  cash: 'Espèces',
  card: 'TPE',
  other: 'Autre',
  unknown: 'Non renseigné',
}

/** Une ligne pour dire où l'argent se trouve, pas comment il a été donné. */
export const PAYMENT_HINTS: Record<PaymentKey, string> = {
  cash: 'dans le tiroir',
  card: 'payé — en banque, pas dans le tiroir',
  other: 'payé autrement',
  unknown: 'règlement non enregistré',
}

export function paymentLabel(method: unknown): string {
  const key = String(method ?? '')
  return key in PAYMENT_LABELS ? PAYMENT_LABELS[key as PaymentKey] : PAYMENT_LABELS.unknown
}
