import mongoose from 'mongoose'
import { DeliveryCompany } from './models/DeliveryCompany'
import { Product } from './models/Product'
import { Supplement } from './models/Supplement'
import { normalizeOrderSource, type OrderSource } from './orderSource'
import { applyWebPromo } from './promo'

/**
 * Turns what a client posted into the order the shop keeps.
 *
 * Nothing that costs money is taken on trust. Every price comes from the menu
 * in the database — product plus supplements, times quantity, the one rule the
 * website and the till both follow — and the online promo is applied here, not
 * in the browser. A client may post any figure it likes; the order records what
 * the food actually costs. When the two differ the order still goes through at
 * the real price (a stale basket is a customer, not an attacker), and the
 * caller is told, so the till can show it and refresh its menu.
 *
 * What a channel may add on top is the channel's to decide:
 *  - website: the online promo, nothing else;
 *  - kiosk: full price;
 *  - counter (the till): a remise and a supplement typed by the cashier, held
 *    within bounds, and platform orders keyed in as a bare amount.
 *
 * Only known fields are copied. Spreading the request body into the order let
 * any caller choose its own status, recette, or auto-ready flag.
 */

export class OrderInputError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100
const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi)

const MAX_ITEMS = 100
const MAX_QTY = 99
const MAX_AMOUNT = 100_000
/** The schema's own ceiling on a delivery fee. */
const MAX_DELIVERY_FEE = 10

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}
const objectId = (v: unknown): string | null => {
  const s = String(v ?? '')
  return mongoose.isValidObjectId(s) ? s : null
}

type Localized = { fr?: string; ar?: string }
type ProductDoc = { _id: unknown; name?: Localized; price?: number; isActive?: boolean; isAvailable?: boolean }
type SupplementDoc = { _id: unknown; name?: Localized; price?: number; isActive?: boolean }
type ItemInput = { product?: unknown; quantity?: unknown; supplements?: unknown; notes?: unknown }

export const PAYMENT_METHODS = ['cash', 'card', 'other'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export interface PricedOrder {
  doc: {
    customer: Record<string, unknown>
    items: Record<string, unknown>[]
    subtotal: number
    discount: { label: string; rate: number; amount: number }
    surcharge: { label: string; amount: number }
    total: number
    type: 'delivery' | 'pickup'
    source: OrderSource
    status: 'pending' | 'confirmed' | 'preparing'
    deliveryCompany: { companyId: unknown; name: string; commission: number }
    deliveryFee: number
    reference: string
    notes: string
    preparationDuration: number
    payment?: { method: PaymentMethod; received: number | null; change: number | null }
  }
  /** What the client said it came to, when that was not what it comes to. */
  claimedTotal: number | null
}

/** Every line priced from the database; a line that cannot be is refused. */
async function priceItems(rawItems: ItemInput[]) {
  if (rawItems.length > MAX_ITEMS) throw new OrderInputError("Trop d'articles dans la commande")

  const productIds = rawItems.map((i) => objectId(i.product))
  if (productIds.some((id) => id === null)) throw new OrderInputError('Article inconnu')
  const supplementLists = rawItems.map((i) => (Array.isArray(i.supplements) ? i.supplements : []) as { supplement?: unknown }[])
  const supplementIds = supplementLists.flat().map((s) => objectId(s?.supplement))
  if (supplementIds.some((id) => id === null)) throw new OrderInputError('Supplement inconnu')

  const [products, supplements] = await Promise.all([
    Product.find({ _id: { $in: [...new Set(productIds)] } }).lean() as Promise<ProductDoc[]>,
    supplementIds.length
      ? (Supplement.find({ _id: { $in: [...new Set(supplementIds)] } }).lean() as Promise<SupplementDoc[]>)
      : Promise.resolve([] as SupplementDoc[]),
  ])
  const productById = new Map(products.map((p) => [String(p._id), p]))
  const supplementById = new Map(supplements.map((s) => [String(s._id), s]))

  return rawItems.map((raw, i) => {
    const product = productById.get(String(productIds[i]))
    if (!product) throw new OrderInputError("Un article de la commande n'existe plus", 409)
    if (product.isActive === false || product.isAvailable === false) {
      throw new OrderInputError(`« ${product.name?.fr ?? 'Article'} » n'est plus disponible`, 409)
    }
    const quantity = Number(raw.quantity)
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QTY) {
      throw new OrderInputError('Quantite invalide')
    }
    const lineSupplements = supplementLists[i].map((s) => {
      const supplement = supplementById.get(String(s?.supplement))
      if (!supplement) throw new OrderInputError("Un supplement de la commande n'existe plus", 409)
      if (supplement.isActive === false) {
        throw new OrderInputError(`« ${supplement.name?.fr ?? 'Supplement'} » n'est plus disponible`, 409)
      }
      return { supplement: supplement._id, name: supplement.name, price: Number(supplement.price) || 0 }
    })
    return {
      product: product._id,
      productName: product.name,
      quantity,
      unitPrice: Number(product.price) || 0,
      supplements: lineSupplements,
      notes: text(raw.notes, 200),
    }
  })
}

/** A platform the till names: its commission is read from its record, not from the request. */
async function platformOf(raw: unknown) {
  const dc = (raw ?? {}) as Record<string, unknown>
  const id = objectId(dc.companyId)
  if (id) {
    const found = (await DeliveryCompany.findById(id).lean()) as { _id: unknown; name?: string; commission?: number } | null
    if (found) return { companyId: found._id, name: found.name ?? '', commission: clamp(Number(found.commission) || 0, 0, 100) }
  }
  const name = text(dc.name, 60)
  return name
    ? { companyId: null, name, commission: clamp(num(dc.commission) ?? 0, 0, 100) }
    : { companyId: null, name: '', commission: 0 }
}

export async function priceOrder(body: Record<string, unknown>): Promise<PricedOrder> {
  const source = normalizeOrderSource(body.source)
  const counter = source === 'counter'
  const type = body.type === 'delivery' ? 'delivery' : 'pickup'

  const c = (body.customer ?? {}) as Record<string, unknown>
  const latitude = num(c.latitude)
  const longitude = num(c.longitude)
  const customer = {
    name: text(c.name, 80) || (counter ? 'Comptoir' : ''),
    phone: text(c.phone, 30) || (counter ? '—' : ''),
    email: text(c.email, 120),
    address: text(c.address, 300),
    ...(latitude !== null && longitude !== null ? { latitude, longitude } : {}),
  }

  // ── Lines and subtotal ───────────────────────────────────────────────────
  const rawItems = Array.isArray(body.items) ? (body.items as ItemInput[]) : []
  const items = rawItems.length ? await priceItems(rawItems) : []
  let subtotal = round2(
    items.reduce((sum, it) => sum + (it.unitPrice + it.supplements.reduce((s, x) => s + x.price, 0)) * it.quantity, 0)
  )
  if (!items.length) {
    // Only the till keys an order in as a bare amount — a delivery platform's
    // ticket. Anyone else posting no items is posting an empty basket.
    if (!counter) throw new OrderInputError('Le panier est vide')
    const amount = num(body.total) ?? num(body.subtotal)
    if (amount === null || amount <= 0 || amount > MAX_AMOUNT) throw new OrderInputError('Montant invalide')
    subtotal = round2(amount)
  }

  // ── What each channel may take off or add ───────────────────────────────
  let discount = { label: '', rate: 0, amount: 0 }
  let surcharge = { label: '', amount: 0 }
  if (source === 'website') {
    discount = applyWebPromo(subtotal).discount
  } else if (counter) {
    const d = (body.discount ?? {}) as Record<string, unknown>
    const off = num(d.amount) ?? 0
    if (off > 0) {
      discount = {
        label: text(d.label, 60) || 'Remise',
        rate: clamp(num(d.rate) ?? 0, 0, 1),
        amount: round2(Math.min(off, subtotal)),
      }
    }
    const s = (body.surcharge ?? {}) as Record<string, unknown>
    const on = num(s.amount) ?? 0
    if (on > 0) surcharge = { label: text(s.label, 60) || 'Supplement', amount: round2(Math.min(on, MAX_AMOUNT)) }
  }
  const deliveryFee = counter ? round2(clamp(num(body.deliveryFee) ?? 0, 0, MAX_DELIVERY_FEE)) : 0
  const total = round2(subtotal - discount.amount + surcharge.amount + deliveryFee)

  // ── Status ───────────────────────────────────────────────────────────────
  // The public site places orders; it does not get to mark them confirmed or
  // delivered. The till and the kiosk take theirs in hand as they ring them up.
  const requested = String(body.status ?? '')
  const status =
    source !== 'website' && (requested === 'confirmed' || requested === 'preparing') ? requested : 'pending'

  // ── How it was paid, where someone was there to take the money ──────────
  let payment: PricedOrder['doc']['payment']
  const p = (body.payment ?? {}) as Record<string, unknown>
  const method = (PAYMENT_METHODS as readonly string[]).includes(String(p.method)) ? (p.method as PaymentMethod) : null
  if (method && (counter || source === 'kiosk')) {
    const given = method === 'cash' ? num(p.received) : null
    const received = given !== null && given > 0 && given <= MAX_AMOUNT ? round2(given) : null
    payment = { method, received, change: received !== null && received >= total ? round2(received - total) : null }
  }

  const claimed = num(body.total)
  return {
    doc: {
      customer,
      items,
      subtotal,
      discount,
      surcharge,
      total,
      type,
      source,
      status,
      deliveryCompany: counter ? await platformOf(body.deliveryCompany) : { companyId: null, name: '', commission: 0 },
      deliveryFee,
      reference: counter ? text(body.reference, 60) : '',
      notes: text(body.notes, 500),
      preparationDuration: clamp(Math.round(num(body.preparationDuration) ?? 30), 1, 180),
      ...(payment ? { payment } : {}),
    },
    claimedTotal: claimed !== null && Math.abs(claimed - total) > 0.009 ? claimed : null,
  }
}
