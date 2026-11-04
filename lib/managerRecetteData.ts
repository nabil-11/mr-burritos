import { Order } from './models/Order'
import { cashInDrawer, recetteTotals } from './recette'
import {
  BLOCKERS_LISTED,
  BLOCKING_STATUSES,
  blockersOf,
  recetteOf,
  type Blockers,
  type RecetteDoc,
  type RecetteView,
} from './managerRecette'

/**
 * Les lectures de base derrière la recette ouverte de l'app du gérant. Le
 * dessin de la réponse (la liste blanche) est dans lib/managerRecette.
 */

/** Les commandes de cette recette qui empêchent de la clôturer, et celles qui sont prêtes. */
export async function blockersFor(recetteId: unknown): Promise<{ blockers: Blockers; readyCount: number }> {
  const [count, listed, readyCount] = await Promise.all([
    Order.countDocuments({ recette: recetteId, status: { $in: BLOCKING_STATUSES } }),
    Order.find({ recette: recetteId, status: { $in: BLOCKING_STATUSES } })
      .sort({ createdAt: 1 })
      .limit(BLOCKERS_LISTED)
      .select('orderNumber status')
      .lean(),
    Order.countDocuments({ recette: recetteId, status: 'ready' }),
  ])
  return { blockers: blockersOf(listed, count), readyCount }
}

/** Ce que le tiroir doit contenir à cet instant : le même chiffre que la caisse et le back-office. */
export async function drawerExpected(doc: {
  _id: unknown
  status?: string
  openingFloat?: number
  totals?: unknown
  mouvements?: unknown
}): Promise<number> {
  const totals = await recetteTotals(doc as Parameters<typeof recetteTotals>[0], { persist: false })
  return cashInDrawer(doc, totals)
}

/** Un document de recette (ouverte), hydraté ou lean, en `Obj` de l'app. */
export async function recetteView(doc: unknown): Promise<RecetteView> {
  const hydrated = doc as { toObject?: () => unknown }
  const plain = (typeof hydrated.toObject === 'function' ? hydrated.toObject() : doc) as RecetteDoc & {
    _id: unknown
    status?: string
    openingFloat?: number
  }
  const [cashExpected, { blockers, readyCount }] = await Promise.all([drawerExpected(plain), blockersFor(plain._id)])
  return recetteOf(plain, { cashExpected, blockers, readyCount })
}
