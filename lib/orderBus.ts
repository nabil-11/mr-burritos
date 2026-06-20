/**
 * orderBus — global in-process event bus for instant order notifications.
 *
 * When the POST /api/orders route creates a new order it emits 'new-order'
 * on this bus.  The SSE /api/orders/stream route subscribes to the same bus
 * so it can push the event to the manager instantly (< 10 ms), instead of
 * waiting for the next 500 ms poll cycle.
 *
 * We attach the emitter to `globalThis` so that Next.js hot-reload (dev) and
 * multiple imports from different route handlers always share the same
 * singleton instance inside the same Node.js process.
 */

import { EventEmitter } from 'events'

declare global {
  // eslint-disable-next-line no-var
  var __orderBus: EventEmitter | undefined
}

if (!globalThis.__orderBus) {
  globalThis.__orderBus = new EventEmitter()
  // Allow up to 200 concurrent SSE listeners (one per connected manager tab)
  globalThis.__orderBus.setMaxListeners(200)
}

export const orderBus: EventEmitter = globalThis.__orderBus
