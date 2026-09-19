'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState, ReactNode } from 'react'

export interface CartSupplement {
  _id: string
  name: { ar: string; fr: string }
  price: number
}

export interface CartItem {
  id: string // unique cart item id
  productId: string
  name: { ar: string; fr: string }
  price: number
  quantity: number
  image: string
  selectedSupplements: CartSupplement[]
  notes: string
}

interface CartState {
  items: CartItem[]
  /** The saved basket has been read — before that, "empty" means "not loaded yet". */
  hydrated?: boolean
}

/** The server refuses more than this on one line; the cart never asks for it. */
export const MAX_LINE_QTY = 99

/** Today's prices for one line, as POST /api/orders/quote reported them. */
export interface LinePrices {
  id: string
  basePrice: number
  supplementPrices: Record<string, number>
}

type CartAction =
  | { type: 'ADD_ITEM'; payload: CartItem }
  | { type: 'REMOVE_ITEM'; payload: string }
  | { type: 'UPDATE_QTY'; payload: { id: string; quantity: number } }
  | { type: 'REPRICE'; payload: LinePrices[] }
  | { type: 'HYDRATE'; payload: CartState }
  | { type: 'CLEAR' }

/**
 * Two lines are the same dish when the product, every supplement (in any
 * order, counted — a double escalope is two entries) and the note all match.
 * Adding one of those again raises the quantity instead of stacking a
 * duplicate line the customer then has to manage twice.
 */
const configKey = (item: Pick<CartItem, 'productId' | 'selectedSupplements' | 'notes'>) =>
  `${item.productId}|${item.selectedSupplements.map((s) => s._id).sort().join(',')}|${item.notes ?? ''}`

const clampQty = (n: number) => Math.min(MAX_LINE_QTY, Math.max(1, Math.round(n) || 1))

/**
 * Line ids used to be `${productId}-${Date.now()}`: adding "3×" in one click
 * made three lines with the same id, and removing one removed all three.
 */
const newLineId = (productId: string) =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${productId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

/** A saved cart is only trusted as far as its shape: anything malformed is dropped, not crashed on. */
function sanitize(raw: unknown): CartState {
  const list = (raw as { items?: unknown })?.items
  if (!Array.isArray(list)) return { items: [] }
  const seen = new Set<string>()
  const items: CartItem[] = []
  for (const it of list as Partial<CartItem>[]) {
    if (!it || typeof it.productId !== 'string' || typeof it.price !== 'number' || !it.name?.fr) continue
    let id = typeof it.id === 'string' && it.id ? it.id : newLineId(it.productId)
    if (seen.has(id)) id = newLineId(it.productId)
    seen.add(id)
    items.push({
      id,
      productId: it.productId,
      name: { fr: it.name.fr, ar: it.name.ar ?? '' },
      price: it.price,
      quantity: clampQty(Number(it.quantity)),
      image: typeof it.image === 'string' ? it.image : '',
      selectedSupplements: Array.isArray(it.selectedSupplements)
        ? it.selectedSupplements.filter((s) => s && typeof s._id === 'string' && typeof s.price === 'number')
        : [],
      notes: typeof it.notes === 'string' ? it.notes : '',
    })
  }
  return { items }
}

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'HYDRATE':
      return { items: action.payload.items, hydrated: true }
    case 'ADD_ITEM': {
      const key = configKey(action.payload)
      const existing = state.items.find((i) => configKey(i) === key)
      if (existing) {
        return {
          ...state,
          items: state.items.map((i) =>
            i === existing ? { ...i, quantity: clampQty(i.quantity + action.payload.quantity) } : i
          ),
        }
      }
      return { ...state, items: [...state.items, { ...action.payload, quantity: clampQty(action.payload.quantity) }] }
    }
    case 'REMOVE_ITEM':
      return { ...state, items: state.items.filter((i) => i.id !== action.payload) }
    case 'UPDATE_QTY':
      if (action.payload.quantity < 1) return { ...state, items: state.items.filter((i) => i.id !== action.payload.id) }
      return {
        ...state,
        items: state.items.map((i) =>
          i.id === action.payload.id ? { ...i, quantity: clampQty(action.payload.quantity) } : i
        ),
      }
    case 'REPRICE': {
      let changed = false
      const byId = new Map(action.payload.map((p) => [p.id, p]))
      const items = state.items.map((i) => {
        const p = byId.get(i.id)
        if (!p) return i
        const supplements = i.selectedSupplements.map((s) => {
          const now = p.supplementPrices[s._id]
          return typeof now === 'number' && now !== s.price ? { ...s, price: now } : s
        })
        const moved = p.basePrice !== i.price || supplements.some((s, k) => s !== i.selectedSupplements[k])
        if (!moved) return i
        changed = true
        return { ...i, price: p.basePrice, selectedSupplements: supplements }
      })
      // Same state back when nothing moved, so the quote does not re-run forever.
      return changed ? { ...state, items } : state
    }
    case 'CLEAR':
      return { ...state, items: [] }
    default:
      return state
  }
}

export const lineUnitPrice = (item: Pick<CartItem, 'price' | 'selectedSupplements'>) =>
  item.price + item.selectedSupplements.reduce((s, sup) => s + sup.price, 0)

interface CartContextType {
  items: CartItem[]
  addItem: (item: Omit<CartItem, 'id'>) => void
  removeItem: (id: string) => void
  updateQty: (id: string, quantity: number) => void
  reprice: (prices: LinePrices[]) => void
  clearCart: () => void
  /** Food total before the online promo. */
  total: number
  itemCount: number
  hydrated: boolean
  /** The cart drawer, opened from anywhere: the navbar, the mobile bar, an "ajouté" toast. */
  drawerOpen: boolean
  setDrawerOpen: (open: boolean) => void
}

const CartContext = createContext<CartContextType | null>(null)
const STORAGE_KEY = 'cart'

export function CartProvider({ children }: { children: ReactNode }) {
  // Start empty so the server-rendered HTML matches the first client render,
  // then load the saved cart from localStorage after mount to avoid a
  // hydration mismatch.
  const [state, dispatch] = useReducer(cartReducer, { items: [], hydrated: false })
  const hydrated = state.hydrated === true
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    let saved: CartState = { items: [] }
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) saved = sanitize(JSON.parse(raw))
    } catch {
      // corrupted or blocked storage: start with an empty cart
    }
    dispatch({ type: 'HYDRATE', payload: saved })

    // A cart filled in one tab shows up in the others, instead of the last
    // tab to write silently throwing the rest away.
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return
      try {
        dispatch({ type: 'HYDRATE', payload: sanitize(e.newValue ? JSON.parse(e.newValue) : null) })
      } catch {
        // ignore a half-written value
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  useEffect(() => {
    // Only persist once we've loaded the saved cart, so the initial empty
    // state doesn't overwrite it before hydration completes.
    if (!hydrated) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ items: state.items }))
    } catch {
      // storage full or blocked: the cart still works for this visit
    }
  }, [state.items, hydrated])

  const addItem = useCallback(
    (item: Omit<CartItem, 'id'>) => dispatch({ type: 'ADD_ITEM', payload: { ...item, id: newLineId(item.productId) } }),
    []
  )
  const removeItem = useCallback((id: string) => dispatch({ type: 'REMOVE_ITEM', payload: id }), [])
  const updateQty = useCallback(
    (id: string, quantity: number) => dispatch({ type: 'UPDATE_QTY', payload: { id, quantity } }),
    []
  )
  const reprice = useCallback((prices: LinePrices[]) => dispatch({ type: 'REPRICE', payload: prices }), [])
  const clearCart = useCallback(() => dispatch({ type: 'CLEAR' }), [])

  const value = useMemo<CartContextType>(() => {
    const total = Math.round(state.items.reduce((sum, i) => sum + lineUnitPrice(i) * i.quantity, 0) * 100) / 100
    const itemCount = state.items.reduce((sum, i) => sum + i.quantity, 0)
    return {
      items: state.items,
      addItem,
      removeItem,
      updateQty,
      reprice,
      clearCart,
      total,
      itemCount,
      hydrated,
      drawerOpen,
      setDrawerOpen,
    }
  }, [state.items, addItem, removeItem, updateQty, reprice, clearCart, hydrated, drawerOpen])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}

/** A cart line as POST /api/orders and /api/orders/quote read it. */
export const toOrderLine = (item: CartItem) => ({
  product: item.productId,
  productName: item.name,
  quantity: item.quantity,
  unitPrice: item.price,
  supplements: item.selectedSupplements.map((s) => ({ supplement: s._id, name: s.name, price: s.price })),
  notes: item.notes,
})
