/**
 * Ce que les plateformes doivent, et ce qu'elles ont déjà versé.
 *
 * Une commande Glovo est vendue aujourd'hui et payée plus tard : la plateforme
 * encaisse le client, prend sa commission, et reverse le reste à la semaine ou
 * au mois. Entre les deux, le restaurant a livré de la nourriture contre une
 * promesse — une créance, pas de l'argent.
 *
 * D'où le drapeau porté par chaque commande plateforme (`deliveryCompany.paid`)
 * et le versement qui le lève (lib/models/PlatformPayout). Trois questions, et
 * l'ordre dans lequel les poser compte :
 *
 *   1. l'argent est-il déjà arrivé ? → `moneyPocket`
 *      Un livreur qui paie en espèces au comptoir, une carte passée sur le
 *      terminal du restaurant : la plateforme ne doit rien, l'argent est là.
 *   2. sinon, combien doit-elle ? → `receivableOf`
 *      Le net : le brut moins sa commission. Jamais le brut — il n'arrivera
 *      jamais.
 *   3. a-t-elle payé ? → `settlementOf`
 *      Tant que non, la créance court, et son âge est ce qui doit inquiéter.
 *
 * Ce fichier ne connaît ni Mongo ni le serveur : il est lu par les routes, par
 * les écrans du back-office, et sa logique est reprise à l'identique dans
 * `lib/recette.ts` — une seule règle pour décider dans quelle poche tombe une
 * commande, sinon le tiroir et les créances finissent par se contredire.
 */

/** La poche où l'argent d'une commande a atterri — elles ne se recouvrent pas. */
export type MoneyPocket =
  /** Le tiroir : espèces prises sur place. */
  | 'drawer'
  /** La banque : carte passée sur le terminal du restaurant. */
  | 'bank'
  /** Chez la plateforme : elle a encaissé, elle reversera. */
  | 'platform'
  /** Nulle part de connu : aucun règlement n'a été enregistré. */
  | 'unknown'

/** Ce que l'état d'un règlement plateforme dit d'une commande. */
export type SettlementState =
  /** Aucune plateforme n'attend d'être payée sur cette commande. */
  | 'none'
  /** La plateforme doit encore verser ce net. */
  | 'unpaid'
  /** Le versement est arrivé et a été pointé. */
  | 'paid'

export interface PlatformOrderLike {
  type?: string
  status?: string
  source?: string
  total?: number
  payment?: { method?: string } | null
  deliveryCompany?: {
    name?: string
    commission?: number
    /** Recopié sur le versement pour le relier à la société, jamais lu ici. */
    companyId?: unknown
    paid?: boolean
    paidAt?: Date | string | null
    payoutRef?: string
  } | null
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** Le nom de la plateforme, ou une chaîne vide s'il n'y en a pas. */
export function companyOf(order: PlatformOrderLike): string {
  return order.deliveryCompany?.name?.trim() ?? ''
}

/**
 * La commission retenue, en dinars. Seules les livraisons en portent : un taux
 * resté sur une commande passée à emporter ne coûte rien.
 */
export function commissionOf(order: PlatformOrderLike): number {
  if (order.type !== 'delivery') return 0
  const rate = order.deliveryCompany?.commission ?? 0
  return round2((order.total || 0) * (rate / 100))
}

/** Ce que le restaurant garde : le brut moins la commission. */
export function netOf(order: PlatformOrderLike): number {
  return round2((order.total || 0) - commissionOf(order))
}

/**
 * Où est l'argent de cette commande.
 *
 * L'ordre des tests est la règle : ce qui est déjà encaissé l'emporte sur la
 * plateforme. Une commande Glovo payée en espèces au livreur a mis l'argent
 * dans le tiroir — la compter aussi comme créance la ferait attendre deux fois.
 *
 * Les commandes d'avant que la caisse demande le mode de règlement n'en portent
 * aucun : prises sur place et sans plateforme, on les suppose en espèces, comme
 * elles ont toujours été comptées. Sinon, elles restent « inconnues » — ni un
 * reproche, ni un oubli à cacher.
 */
export function moneyPocket(order: PlatformOrderLike): MoneyPocket {
  const method = order.payment?.method
  const company = companyOf(order)
  const onPremises = order.source === 'counter' || order.source === 'kiosk'
  if (method ? method === 'cash' : onPremises && !company) return 'drawer'
  if (method === 'card') return 'bank'
  return company ? 'platform' : 'unknown'
}

/**
 * Ce que la plateforme doit encore verser sur cette commande, réglée ou non :
 * 0 dès que l'argent est arrivé par un autre chemin. Une commande annulée ne
 * doit rien — elle n'a jamais été livrée.
 */
export function receivableOf(order: PlatformOrderLike): number {
  if (order.status === 'cancelled') return 0
  return moneyPocket(order) === 'platform' ? netOf(order) : 0
}

/** Vrai si le versement de la plateforme a été pointé sur cette commande. */
export function isPaid(order: PlatformOrderLike): boolean {
  return order.deliveryCompany?.paid === true
}

export interface Settlement {
  state: SettlementState
  /** La plateforme concernée, vide si aucune. */
  company: string
  /** Le net attendu d'elle, ou 0 si elle ne doit rien. */
  amount: number
}

/** L'état de règlement d'une commande, prêt à afficher. */
export function settlementOf(order: PlatformOrderLike): Settlement {
  const amount = receivableOf(order)
  const company = companyOf(order)
  if (amount <= 0) return { state: 'none', company, amount: 0 }
  return { state: isPaid(order) ? 'paid' : 'unpaid', company, amount }
}

export interface SettlementMeta {
  label: string
  /** Sur une pastille de tableau, fond clair comme fond sombre. */
  badge: string
  /** Une ligne pour lever le doute. */
  hint: string
}

export const SETTLEMENT_META: Record<Exclude<SettlementState, 'none'>, SettlementMeta> = {
  unpaid: {
    label: 'À recevoir',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
    hint: "La plateforme a encaissé le client et n'a pas encore reversé ce net.",
  },
  paid: {
    label: 'Réglé',
    badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
    hint: 'Le versement de la plateforme est arrivé et a été pointé.',
  },
}

/** Combien de jours une créance attend. 0 le jour même. */
export function ageInDays(since: Date | string | null | undefined, now = new Date()): number {
  if (!since) return 0
  const at = new Date(since).getTime()
  if (!Number.isFinite(at)) return 0
  return Math.max(0, Math.floor((now.getTime() - at) / 86_400_000))
}

/** Les modes par lesquels une plateforme verse. */
export const PAYOUT_METHODS = ['transfer', 'cash', 'cheque', 'other'] as const
export type PayoutMethod = (typeof PAYOUT_METHODS)[number]

export const PAYOUT_METHOD_LABELS: Record<PayoutMethod, string> = {
  transfer: 'Virement',
  cash: 'Espèces',
  cheque: 'Chèque',
  other: 'Autre',
}

export function isPayoutMethod(value: unknown): value is PayoutMethod {
  return (PAYOUT_METHODS as readonly string[]).includes(String(value))
}
