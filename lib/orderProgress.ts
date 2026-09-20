/**
 * How a website order's progress reads to the customer who placed it.
 *
 * The statuses are the kitchen's (lib/models/Order): what they mean to someone
 * waiting at home is not the same thing. "pending" is not "confirmed" — the old
 * confirmation page said "Commande confirmée !" the moment an order was sent,
 * before anyone in the restaurant had seen it. Everything the tracker says
 * comes from here, so the order page and the tracking drawer agree.
 *
 * No server imports: used by client components.
 */

export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled'

/** The fields GET /api/orders/track returns — nothing that identifies the customer. */
export interface TrackedOrder {
  _id: string
  orderNumber: string
  status: OrderStatus | string
  total: number
  deliveryFee?: number
  type: 'delivery' | 'pickup' | string
  createdAt: string
  confirmedAt?: string | null
  preparationDuration?: number | null
}

const SHOP_TZ = 'Africa/Tunis'

/**
 * What the customer actually hands over: the food, plus the delivery fee once
 * the shop has set it. The tracker and the order page must not disagree.
 */
export const payableTotal = (order: Pick<TrackedOrder, 'total' | 'deliveryFee' | 'type'>) =>
  Math.round((Number(order.total ?? 0) + (order.type === 'delivery' ? Number(order.deliveryFee ?? 0) : 0)) * 100) / 100

/** Nothing changes on an order once it is here, so the tracker stops asking. */
export const isFinal = (status: string) => status === 'delivered' || status === 'cancelled'

export interface ProgressStep {
  status: OrderStatus
  label: string
}

export function progressSteps(type: string): ProgressStep[] {
  return [
    { status: 'pending', label: 'Envoyée' },
    { status: 'confirmed', label: 'Confirmée' },
    { status: 'preparing', label: 'En cuisine' },
    { status: 'ready', label: 'Prête' },
    { status: 'delivered', label: type === 'delivery' ? 'Livrée' : 'Récupérée' },
  ]
}

/** Index of the step the order has reached; -1 when it was cancelled. */
export function stepIndex(status: string): number {
  return ['pending', 'confirmed', 'preparing', 'ready', 'delivered'].indexOf(status)
}

/** When the kitchen expects it done: confirmation plus the time it announced. */
export function readyAt(order: Pick<TrackedOrder, 'status' | 'confirmedAt' | 'preparationDuration'>): Date | null {
  if (order.status !== 'confirmed' && order.status !== 'preparing') return null
  if (!order.confirmedAt || !order.preparationDuration) return null
  const at = new Date(new Date(order.confirmedAt).getTime() + order.preparationDuration * 60_000)
  return Number.isNaN(at.getTime()) ? null : at
}

/** "20:45", on the restaurant's clock whatever the visitor's device says. */
export const shopClock = (d: Date) =>
  d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: SHOP_TZ })

export type Tone = 'wait' | 'progress' | 'done' | 'bad'

export interface Headline {
  title: string
  detail: string
  tone: Tone
  emoji: string
}

export function headline(order: TrackedOrder): Headline {
  const delivery = order.type === 'delivery'
  const eta = readyAt(order)
  const when = eta ? `Prête vers ${shopClock(eta)}` : ''
  switch (order.status) {
    case 'pending':
      return {
        title: 'Commande envoyée',
        detail: 'Le restaurant la confirme dans quelques minutes.',
        tone: 'wait',
        emoji: '📨',
      }
    case 'confirmed':
      return {
        title: 'Commande confirmée',
        detail: when ? `${when}${delivery ? ', puis en route vers vous' : ''}.` : 'Elle passe bientôt en cuisine.',
        tone: 'progress',
        emoji: '👍',
      }
    case 'preparing':
      return {
        title: 'En cuisine',
        detail: when ? `${when}${delivery ? ', puis en route vers vous' : ''}.` : 'Nous la préparons.',
        tone: 'progress',
        emoji: '👨‍🍳',
      }
    case 'ready':
      return delivery
        ? { title: 'Prête !', detail: 'Elle part en livraison.', tone: 'done', emoji: '🛵' }
        : { title: 'Prête !', detail: 'Passez la récupérer au restaurant.', tone: 'done', emoji: '✅' }
    case 'delivered':
      return {
        title: delivery ? 'Livrée' : 'Récupérée',
        detail: 'Bon appétit !',
        tone: 'done',
        emoji: '🌯',
      }
    case 'cancelled':
      return {
        title: 'Commande annulée',
        detail: 'Une question ? Appelez-nous, nous vous répondons.',
        tone: 'bad',
        emoji: '✖️',
      }
    default:
      return { title: 'Commande reçue', detail: '', tone: 'wait', emoji: '📨' }
  }
}

/** Short badge text for lists. */
export const STATUS_SHORT: Record<string, string> = {
  pending: 'En attente',
  confirmed: 'Confirmée',
  preparing: 'En cuisine',
  ready: 'Prête',
  delivered: 'Terminée',
  cancelled: 'Annulée',
}
