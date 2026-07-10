import { NextRequest } from 'next/server'
import { getTokenFromRequest } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import { Order } from '@/lib/models/Order'
import { orderBus } from '@/lib/orderBus'

export const dynamic = 'force-dynamic'

/** Resolves after `ms` ms, or immediately when the AbortSignal fires. */
function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => { clearTimeout(t); resolve() }, { once: true })
  })
}

export async function GET(req: NextRequest) {
  const user = getTokenFromRequest(req)
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { searchParams } = new URL(req.url)
  const sinceParam = searchParams.get('since')
  let lastChecked: Date = sinceParam ? new Date(sinceParam) : new Date()

  const encoder = new TextEncoder()
  const signal = req.signal

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Acknowledge the connection immediately
      controller.enqueue(encoder.encode(': connected\n\n'))

      function send(order: Record<string, unknown>) {
        if (signal.aborted) return
        try {
          // Advance cursor so polling fallback doesn't re-emit the same order
          if (order.createdAt) lastChecked = new Date(order.createdAt as string)
          const msg = `event: new-order\ndata: ${JSON.stringify(order)}\n\n`
          controller.enqueue(encoder.encode(msg))
        } catch { /* stream already closed */ }
      }

      // Pushes an order-status change (e.g. delivered) WITHOUT advancing the
      // new-order cursor — a delivered order has an old createdAt and must not
      // rewind `lastChecked`, or old orders would be replayed as "new".
      function sendDelivered(order: Record<string, unknown>) {
        if (signal.aborted) return
        try {
          const msg = `event: order-delivered\ndata: ${JSON.stringify(order)}\n\n`
          controller.enqueue(encoder.encode(msg))
        } catch { /* stream already closed */ }
      }

      // ── Primary path: subscribe to the in-process event bus ──────────────
      // When the POST /api/orders route runs on the SAME server instance this
      // fires in < 10 ms with zero DB round-trips.
      orderBus.on('new-order', send)
      orderBus.on('order-delivered', sendDelivered)

      let heartbeatAt = Date.now()

      try {
        await connectDB()

        while (!signal.aborted) {
          // ── Fallback poll (500 ms) ──────────────────────────────────────────
          // Catches orders that arrived via a different server instance (e.g.
          // separate Vercel lambda) where the in-process bus didn't fire.
          const missed = await Order.find(
            { createdAt: { $gt: lastChecked } },
            { orderNumber: 1, type: 1, total: 1, customer: 1, status: 1, createdAt: 1, deliveryFee: 1 }
          )
            .sort({ createdAt: 1 })
            .lean()

          for (const order of missed) {
            send(order as Record<string, unknown>)
          }

          // ── Heartbeat every 20 s ────────────────────────────────────────────
          if (Date.now() - heartbeatAt >= 20_000) {
            controller.enqueue(encoder.encode(': ping\n\n'))
            heartbeatAt = Date.now()
          }

          await sleep(500, signal)
        }
      } catch {
        // DB error or abort — end the stream cleanly
      } finally {
        orderBus.off('new-order', send)
        orderBus.off('order-delivered', sendDelivered)
        try { controller.close() } catch { /* already closed */ }
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':      'text/event-stream',
      'Cache-Control':     'no-cache, no-transform',
      'Connection':        'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
