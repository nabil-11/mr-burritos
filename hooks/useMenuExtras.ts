'use client'

import { useEffect, useState } from 'react'
import type { MenuExtras } from '@/lib/menuExtras'

/**
 * Les suggestions de la carte, demandées une fois par visite et partagées par
 * tous ceux qui les lisent (tiroir, page panier). Rien tant qu'elles ne sont
 * pas arrivées, rien du tout si la requête échoue : une suggestion n'est
 * jamais indispensable.
 */
let pending: Promise<MenuExtras | null> | null = null

const load = () =>
  (pending ??= fetch('/api/menu/extras')
    .then((r) => (r.ok ? (r.json() as Promise<MenuExtras>) : null))
    .catch(() => {
      pending = null
      return null
    }))

export function useMenuExtras(active = true): MenuExtras | null {
  const [extras, setExtras] = useState<MenuExtras | null>(null)
  useEffect(() => {
    if (!active) return
    let alive = true
    load().then((x) => {
      if (alive && x) setExtras(x)
    })
    return () => {
      alive = false
    }
  }, [active])
  return extras
}
