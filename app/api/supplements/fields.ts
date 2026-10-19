import mongoose from 'mongoose'
import { Product } from '@/lib/models/Product'

const TYPES = ['sauce', 'size', 'viande', 'extra']

/**
 * The editable fields of a supplement, read from a request body. Only the keys
 * present are returned, so a partial update — the "Actif" switch sends
 * `{ isActive }` alone — leaves everything else as it was.
 */
export function supplementFields(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (body.name && typeof body.name === 'object') {
    const n = body.name as { fr?: unknown; ar?: unknown }
    out.name = { fr: String(n.fr ?? '').trim(), ar: String(n.ar ?? '').trim() }
  }
  if (body.price !== undefined) {
    const price = Number(body.price)
    if (!Number.isFinite(price) || price < 0) throw new Error('Prix invalide')
    out.price = Math.round(price * 100) / 100
  }
  if (body.type !== undefined) {
    if (!TYPES.includes(String(body.type))) throw new Error('Type invalide')
    out.type = String(body.type)
  }
  if (body.meatCount !== undefined) out.meatCount = Math.max(1, Math.round(Number(body.meatCount) || 1))
  if (body.image !== undefined) out.image = String(body.image)
  if (body.layerImage !== undefined) out.layerImage = String(body.layerImage)
  if (body.isActive !== undefined) out.isActive = Boolean(body.isActive)
  return out
}

/**
 * Makes exactly `productIds` offer this supplement: added where missing,
 * removed from every other product. Absent `productIds` means "don't touch the
 * links" — the switch and other partial updates never send it.
 */
export async function syncProducts(supplementId: string, productIds: unknown) {
  if (!Array.isArray(productIds)) return
  const ids = productIds.map(String).filter((id) => mongoose.isValidObjectId(id))
  await Promise.all([
    Product.updateMany({ _id: { $in: ids } }, { $addToSet: { supplements: supplementId } }),
    Product.updateMany({ _id: { $nin: ids }, supplements: supplementId }, { $pull: { supplements: supplementId } }),
  ])
}
