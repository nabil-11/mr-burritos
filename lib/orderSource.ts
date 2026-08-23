/**
 * Where an order was taken — the *channel*, not the fulfilment mode.
 *
 * `type` (delivery / pickup) already says how the food leaves the kitchen.
 * `source` says which of our three front-ends punched the order in, which is
 * what the counter needs to read off a ticket ("is this someone standing here
 * or someone waiting at home?") and what the reports need to split revenue by.
 *
 * No mongoose import here on purpose: client components ('use client') import
 * these labels, and pulling the model in would drag mongoose into the browser
 * bundle.
 */

export const ORDER_SOURCES = ['website', 'counter', 'kiosk'] as const

export type OrderSource = (typeof ORDER_SOURCES)[number]

/** Anything that reaches the API without declaring itself is the public site. */
export const DEFAULT_ORDER_SOURCE: OrderSource = 'website'

export const ORDER_SOURCE_LABELS: Record<OrderSource, string> = {
  website: 'Site web',
  counter: 'Caisse',
  kiosk: 'Borne sur place',
}

/** Short form for the places where a full label does not fit (tickets, badges). */
export const ORDER_SOURCE_SHORT: Record<OrderSource, string> = {
  website: 'EN LIGNE',
  counter: 'CAISSE',
  kiosk: 'SUR PLACE',
}

export const ORDER_SOURCE_ICONS: Record<OrderSource, string> = {
  website: '🌐',
  counter: '🧾',
  kiosk: '🖥️',
}

export function isOrderSource(value: unknown): value is OrderSource {
  return typeof value === 'string' && (ORDER_SOURCES as readonly string[]).includes(value)
}

/** Coerces client input to a known source — never trust the request body. */
export function normalizeOrderSource(value: unknown): OrderSource {
  return isOrderSource(value) ? value : DEFAULT_ORDER_SOURCE
}

/**
 * Label for display. Orders taken before this field existed carry no source at
 * all; they show as "—" rather than being silently counted as web orders.
 */
export function orderSourceLabel(value: unknown, fallback = '—'): string {
  return isOrderSource(value) ? ORDER_SOURCE_LABELS[value] : fallback
}

export function orderSourceIcon(value: unknown, fallback = ''): string {
  return isOrderSource(value) ? ORDER_SOURCE_ICONS[value] : fallback
}
