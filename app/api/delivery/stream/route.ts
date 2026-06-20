/**
 * GET /api/delivery/stream
 *
 * Server-Sent Events stream for the delivery-app.
 * Pushes 'confirmed-delivery' events instantly via the in-process orderBus
 * when a manager confirms a delivery order.
 * A 500 ms DB poll acts as fallback for cross-instance scenarios (Vercel).
 *
 * Requires delivery or admin JWT.
 */

import { NextRequest } from 'next/server'
import { getTokenFromRequest } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import { Order } from '@/lib/models/Order'
import { orderBus } from '@/lib/orderBus'

export const dynamic = 'force-dynamic'

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => { clearTimeout(t); resolve() }, { once: true })
  })
}

export async function GET(req: NextRequest) {
  const user = getTokenFromRequest(req)
  if (!user || (user.role !== 'delivery' && user.role !== 'admin')) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const sinceParam = searchParams.get('since')
  let lastChecked: Date = sinceParam ? new Date(sinceParam) : new Date()

  const encoder = new TextEncoder()
  const signal = req.signal

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode(': connected\n\n'))

      function send(order: Record<string, unknown>) {
        if (signal.aborted) return
        try {
          if (order.confirmedAt) lastChecked = new Date(order.confirmedAt as string)
          else if (order.createdAt) lastChecked = new Date(order.createdAt as string)
          const msg = `event: confirmed-delivery\ndata: ${JSON.stringify(order)}\n\n`
          controller.enqueue(encoder.encode(msg))
        } catch { /* stream already closed */ }
      }

      // Primary: instant push via in-process event bus
      orderBus.on('confirmed-delivery', send)

      let heartbeatAt = Date.now()

      try {
        await connectDB()

        while (!signal.aborted) {
          // Fallback poll: catches orders confirmed on a different server instance
          const missed = await Order.find(
            {
              type: 'delivery',
              status: 'confirmed',
              confirmedAt: { $gt: lastChecked },
            },
            { orderNumber: 1, type: 1, total: 1, customer: 1, status: 1, confirmedAt: 1, deliveryFee: 1, preparationDuration: 1 }
          )
            .sort({ confirmedAt: 1 })
            .lean()

          for (const order of missed) {
            send(order as Record<string, unknown>)
          }

          if (Date.now() - heartbeatAt >= 20_000) {
            controller.enqueue(encoder.encode(': ping\n\n'))
            heartbeatAt = Date.now()
          }

          await sleep(500, signal)
        }
      } catch {
        // DB error or abort
      } finally {
        orderBus.off('confirmed-delivery', send)
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
