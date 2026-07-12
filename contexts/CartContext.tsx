'use client'

import { createContext, useContext, useReducer, useEffect, useState, ReactNode } from 'react'

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
}

type CartAction =
  | { type: 'ADD_ITEM'; payload: CartItem }
  | { type: 'REMOVE_ITEM'; payload: string }
  | { type: 'UPDATE_QTY'; payload: { id: string; quantity: number } }
  | { type: 'HYDRATE'; payload: CartState }
  | { type: 'CLEAR' }

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'HYDRATE':
      return action.payload
    case 'ADD_ITEM':
      return { items: [...state.items, action.payload] }
    case 'REMOVE_ITEM':
      return { items: state.items.filter((i) => i.id !== action.payload) }
    case 'UPDATE_QTY':
      return {
        items: state.items.map((i) =>
          i.id === action.payload.id ? { ...i, quantity: action.payload.quantity } : i
        ),
      }
    case 'CLEAR':
      return { items: [] }
    default:
      return state
  }
}

interface CartContextType {
  items: CartItem[]
  addItem: (item: Omit<CartItem, 'id'>) => void
  removeItem: (id: string) => void
  updateQty: (id: string, quantity: number) => void
  clearCart: () => void
  total: number
  itemCount: number
  hydrated: boolean
}

const CartContext = createContext<CartContextType | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  // Start empty so the server-rendered HTML matches the first client render,
  // then load the saved cart from localStorage after mount to avoid a
  // hydration mismatch.
  const [state, dispatch] = useReducer(cartReducer, { items: [] })
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('cart')
    if (saved) {
      try {
        dispatch({ type: 'HYDRATE', payload: JSON.parse(saved) as CartState })
      } catch {
        // ignore corrupted cart data
      }
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    // Only persist once we've loaded the saved cart, so the initial empty
    // state doesn't overwrite it before hydration completes.
    if (hydrated) localStorage.setItem('cart', JSON.stringify(state))
  }, [state, hydrated])

  const addItem = (item: Omit<CartItem, 'id'>) => {
    const id = `${item.productId}-${Date.now()}`
    dispatch({ type: 'ADD_ITEM', payload: { ...item, id } })
  }

  const removeItem = (id: string) => dispatch({ type: 'REMOVE_ITEM', payload: id })
  const updateQty = (id: string, quantity: number) =>
    dispatch({ type: 'UPDATE_QTY', payload: { id, quantity } })
  const clearCart = () => dispatch({ type: 'CLEAR' })

  const total = state.items.reduce((sum, item) => {
    const suppTotal = item.selectedSupplements.reduce((s, sup) => s + sup.price, 0)
    return sum + (item.price + suppTotal) * item.quantity
  }, 0)

  const itemCount = state.items.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <CartContext.Provider value={{ items: state.items, addItem, removeItem, updateQty, clearCart, total, itemCount, hydrated }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
