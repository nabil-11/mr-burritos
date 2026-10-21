import { NextResponse } from 'next/server'
import { PromoCodeInputError } from '@/lib/promoCodes'

/**
 * Les codes promo du site. Lire demande un compte ; créer, modifier ou
 * supprimer un code, c'est accorder de l'argent : un gérant ou un admin.
 */
export const canManagePromos = (role: unknown) => role === 'admin' || role === 'manager'

export function failPromo(e: unknown) {
  const msg = e instanceof Error ? e.message : 'Erreur serveur'
  if (msg === 'Unauthorized') return NextResponse.json({ error: msg }, { status: 401 })
  if (msg === 'Forbidden') return NextResponse.json({ error: 'Réservé aux gérants et aux admins' }, { status: 403 })
  if (e instanceof PromoCodeInputError) return NextResponse.json({ error: msg }, { status: 400 })
  if ((e as { code?: number })?.code === 11000) return NextResponse.json({ error: 'Ce code existe déjà' }, { status: 409 })
  return NextResponse.json({ error: msg }, { status: 500 })
}
