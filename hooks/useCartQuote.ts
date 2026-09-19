'use client'

import { useEffect, useRef, useState } from 'react'
import { LinePrices, toOrderLine, useCart } from '@/contexts/CartContext'
import type { WebQuote } from '@/lib/orderPricing'

/**
 * Checks the basket against today's menu whenever its contents change.
 *
 * Prices the cart saved when an item was added are corrected in place, so the
 * navbar, the drawer and the checkout all show what the order will actually
 * cost; a dish no longer on the menu comes back as a problem on its own line.
 * A failed check changes nothing: the order route prices everything again
 * anyway, this only spares the customer a surprise.
 */
export function useCartQuote(active = true) {
  const { items, hydrated, reprice } = useCart()
  const [problems, setProblems] = useState<Record<string, string>>({})
  const [checking, setChecking] = useState(false)

  // What the server prices: which dishes, which supplements, how many. Prices
  // are left out, so correcting them does not trigger another check.
  const signature = items
    .map((i) => `${i.id}:${i.productId}:${i.selectedSupplements.map((s) => s._id).join('.')}:${i.quantity}`)
    .join('|')
  const itemsRef = useRef(items)
  useEffect(() => {
    itemsRef.current = items
  })

  useEffect(() => {
    if (!active || !hydrated || !signature) return
    const snapshot = itemsRef.current
    const ctrl = new AbortController()
    const timer = setTimeout(async () => {
      setChecking(true)
      try {
        const res = await fetch('/api/orders/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: snapshot.map(toOrderLine) }),
          signal: ctrl.signal,
        })
        if (!res.ok) return
        const quote = (await res.json()) as WebQuote
        const next: Record<string, string> = {}
        const prices: LinePrices[] = []
        quote.lines.forEach((line, k) => {
          const id = snapshot[k]?.id
          if (!id) return
          if (line.ok) prices.push({ id, basePrice: line.basePrice, supplementPrices: line.supplementPrices })
          else next[id] = line.error
        })
        setProblems(next)
        reprice(prices)
      } catch {
        // offline or aborted: keep what we had
      } finally {
        if (!ctrl.signal.aborted) setChecking(false)
      }
    }, 250)
    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [signature, active, hydrated, reprice])

  // Problems for lines since removed are simply not looked up.
  const blocking = items.some((i) => problems[i.id])
  return { problems, checking, blocking }
}
