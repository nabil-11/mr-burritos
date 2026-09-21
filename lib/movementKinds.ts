/**
 * Les mouvements d'espèces d'une session de caisse.
 *
 * Quatre gestes, deux questions à leur poser :
 *
 *   — dans quel sens l'argent bouge-t-il ? (`sign`)
 *   — le restaurant s'appauvrit-il, ou l'argent ne fait-il que changer de
 *     poche ? (`expense`)
 *
 * Un achat et une dépense sortent du tiroir *et* coûtent. Un ajout au fond et
 * un retrait déplacent des espèces sans rien coûter : le patron complète la
 * monnaie à midi, dépose l'excédent à la banque le soir. Confondre les deux
 * fausserait le solde du service — d'où les deux colonnes.
 *
 * Ce fichier ne connaît ni Mongo ni le serveur : il est importé aussi bien par
 * `lib/recette.ts` que par les écrans du back-office.
 */

export const MOVEMENT_KINDS = ['achat', 'depense', 'apport', 'retrait'] as const
export type MovementKind = (typeof MOVEMENT_KINDS)[number]

export interface MovementMeta {
  kind: MovementKind
  /** Sur un bouton. */
  label: string
  /** Sur une pastille de tableau. */
  short: string
  /** +1 : l'argent entre dans le tiroir. −1 : il en sort. */
  sign: 1 | -1
  /** Vrai si le mouvement coûte au restaurant, faux s'il déplace seulement des espèces. */
  expense: boolean
  /** Une ligne pour lever le doute au moment de choisir. */
  hint: string
  /** Libellés fréquents, proposés d'un tap — le clavier d'une caisse est lent. */
  suggestions: string[]
  /** Pastille de tableau. */
  badge: string
  /** Bouton d'action, sur fond clair comme sur fond sombre. */
  accent: string
  /** Le montant, dans une liste. */
  amountTone: string
}

export const MOVEMENT_META: Record<MovementKind, MovementMeta> = {
  achat: {
    kind: 'achat',
    label: 'Achat',
    short: 'Achat',
    sign: -1,
    expense: true,
    hint: 'Marchandise pour la cuisine : pain, légumes, viande, boissons, emballage, gaz.',
    suggestions: ['Pain', 'Légumes', 'Viande', 'Fromage', 'Boissons', 'Emballage', 'Gaz', 'Sauces'],
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
    accent:
      'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20',
    amountTone: 'text-amber-700 dark:text-amber-400',
  },
  depense: {
    kind: 'depense',
    label: 'Dépense',
    short: 'Dépense',
    sign: -1,
    expense: true,
    hint: "Tout le reste payé en espèces : livreur, avance sur salaire, réparation, transport.",
    suggestions: ['Livreur', 'Avance salaire', 'Transport', 'Réparation', 'Ménage', 'Électricité'],
    badge: 'bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300',
    accent:
      'border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300 hover:bg-orange-500/20',
    amountTone: 'text-orange-700 dark:text-orange-400',
  },
  apport: {
    kind: 'apport',
    label: 'Ajout au fond',
    short: 'Ajout au fond',
    sign: 1,
    expense: false,
    hint: "De l'argent remis dans le tiroir : monnaie d'appoint, avance du patron, retour de banque.",
    suggestions: ['Appoint monnaie', 'Avance patron', 'Retour banque', 'Coffre'],
    badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
    accent:
      'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20',
    amountTone: 'text-emerald-700 dark:text-emerald-400',
  },
  retrait: {
    kind: 'retrait',
    label: 'Retrait',
    short: 'Retrait',
    sign: -1,
    expense: false,
    hint: "Des espèces sorties du tiroir sans être dépensées : dépôt en banque, coffre, prélèvement.",
    suggestions: ['Dépôt banque', 'Coffre', 'Prélèvement patron', 'Fin de service'],
    badge: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300',
    accent: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300 hover:bg-sky-500/20',
    amountTone: 'text-sky-700 dark:text-sky-400',
  },
}

/** Les quatre, dans l'ordre où ils sont proposés : le plus fréquent d'abord. */
export const MOVEMENT_LIST: MovementMeta[] = MOVEMENT_KINDS.map((k) => MOVEMENT_META[k])

export function isMovementKind(value: unknown): value is MovementKind {
  return (MOVEMENT_KINDS as readonly string[]).includes(String(value))
}

/** Ce que le mouvement fait au tiroir : positif il le remplit, négatif il le vide. */
export function movementDelta(kind: unknown, amount: number): number {
  return isMovementKind(kind) ? MOVEMENT_META[kind].sign * (Number(amount) || 0) : 0
}

/** Le libellé d'un genre, y compris pour une vieille ligne au genre inconnu. */
export function movementLabel(kind: unknown, fallback = 'Mouvement'): string {
  return isMovementKind(kind) ? MOVEMENT_META[kind].short : fallback
}
