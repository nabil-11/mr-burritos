/**
 * What the website remembers on the customer's own device — never on the
 * server, never shared: their contact details, so a second order is two taps
 * rather than a form, and the orders placed from here, so "suivre" shows them
 * without asking for a phone number.
 *
 * Every access is guarded: storage can be full, disabled, or blocked in a
 * private window, and none of that may break ordering.
 */

import { ATTRIBUTION_DAYS, normalizeRef } from './commerce'

const CUSTOMER_KEY = 'mb.customer'
const ORDERS_KEY = 'mb.orders'
const MAX_ORDERS = 10

export interface RememberedCustomer {
  name: string
  phone: string
  address: string
  type: 'delivery' | 'pickup'
  /** Le quartier de livraison (lib/commerce DELIVERY_ZONES), vide s'il n'a jamais été choisi. */
  zone?: string
}

export interface RememberedOrder {
  id: string
  number: string
  at: string
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage full or blocked: forgetting is fine, failing the order is not.
  }
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')

export function loadCustomer(): RememberedCustomer | null {
  const c = read<Partial<RememberedCustomer>>(CUSTOMER_KEY)
  if (!c || typeof c !== 'object') return null
  return {
    name: str(c.name, 80),
    phone: str(c.phone, 30),
    address: str(c.address, 300),
    type: c.type === 'pickup' ? 'pickup' : 'delivery',
    zone: str(c.zone, 40),
  }
}

export const saveCustomer = (c: RememberedCustomer) => write(CUSTOMER_KEY, c)

export function loadOrders(): RememberedOrder[] {
  const list = read<RememberedOrder[]>(ORDERS_KEY)
  return Array.isArray(list)
    ? list.filter((o) => o && typeof o.id === 'string' && typeof o.number === 'string').slice(0, MAX_ORDERS)
    : []
}

export function rememberOrder(order: RememberedOrder) {
  write(ORDERS_KEY, [order, ...loadOrders().filter((o) => o.id !== order.id)].slice(0, MAX_ORDERS))
}

/**
 * La provenance d'une visite : « /?src=sac » sur le QR code du sac, « ?src=insta »
 * dans la bio… Gardée ATTRIBUTION_DAYS jours, puis oubliée ; une nouvelle
 * provenance remplace l'ancienne. Envoyée avec la commande, nettoyée par le serveur.
 */
const REF_KEY = 'mb.ref'

export function captureRef(search: string) {
  const ref = normalizeRef(new URLSearchParams(search).get('src'))
  if (ref) write(REF_KEY, { ref, at: Date.now() })
}

export function loadRef(): string {
  const saved = read<{ ref?: unknown; at?: unknown }>(REF_KEY)
  const at = Number(saved?.at)
  if (!saved || !Number.isFinite(at) || Date.now() - at > ATTRIBUTION_DAYS * 86_400_000) return ''
  return normalizeRef(saved.ref)
}
