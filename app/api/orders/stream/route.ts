import { NextRequest } from 'next/server'
import { getTokenFromRequest } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import { Order } from '@/lib/models/Order'

export const dynamic = 'force-dynamic'

/** Waits `ms` milliseconds, but resolves immediately if the signal is aborted. */
function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => { clearTimeout(t); resolve() }, { once: true })
  })
}

export async function GET(req: NextRequest) {
  // Require authenticated manager / admin
  const user = getTokenFromRequest(req)
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  // `since` lets the client resume after a reconnect without missing orders
  const sinceParam = searchParams.get('since')
  let lastChecked: Date = sinceParam ? new Date(sinceParam) : new Date()

  const encoder = new TextEncoder()
  const signal = req.signal

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Confirm connection to the client immediately
      controller.enqueue(encoder.encode(': connected\n\n'))

      let heartbeatAt = Date.now()

      try {
        await connectDB()

        while (!signal.aborted) {
          // ── Poll for orders created after `lastChecked` ──────────────────
          const newOrders = await Order.find(
            { createdAt: { $gt: lastChecked } },
            // Send only the fields the desktop app needs for the alert
            { orderNumber: 1, type: 1, total: 1, customer: 1, status: 1, createdAt: 1 }
          )
            .sort({ createdAt: 1 })
            .lean()

          if (newOrders.length > 0) {
            lastChecked = new Date()
            for (const order of newOrders) {
              const msg = `event: new-order\ndata: ${JSON.stringify(order)}\n\n`
              controller.enqueue(encoder.encode(msg))
            }
          }

          // ── Heartbeat every 20 s to prevent proxy / Vercel timeouts ──────
          if (Date.now() - heartbeatAt >= 20_000) {
            controller.enqueue(encoder.encode(': ping\n\n'))
            heartbeatAt = Date.now()
          }

          await sleep(2_000, signal)
        }
      } catch {
        // DB error or abort — let the stream end cleanly
      } finally {
        try { controller.close() } catch { /* already closed */ }
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection':    'keep-alive',
      'X-Accel-Buffering': 'no', // Disable Nginx / Vercel buffering
    },
  })
}
