'use client'

import { createContext, useContext, useReducer, useEffect, ReactNode } from 'react'

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
  | { type: 'CLEAR' }

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
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
}

const CartContext = createContext<CartContextType | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, { items: [] }, (init) => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('cart')
      if (saved) return JSON.parse(saved) as CartState
    }
    return init
  })

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(state))
  }, [state])

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
    <CartContext.Provider value={{ items: state.items, addItem, removeItem, updateQty, clearCart, total, itemCount }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
