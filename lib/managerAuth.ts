import mongoose from 'mongoose'
import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { User } from '@/lib/models/User'
import { getTokenFromRequest } from '@/lib/auth'

/**
 * La garde des routes /api/manager : qui demande, et a-t-il le droit.
 *
 * Le jeton d'abord, puis le compte lui-même, relu en base comme le fait
 * /api/auth/me : un compte fermé ou rétrogradé perd l'accès tout de suite, pas
 * à l'expiration du jeton. Le rôle vient de la base, jamais du jeton.
 *
 * Rend l'utilisateur, ou une Response `{ error, code }` en no-store :
 * 401 unauthorized, 403 forbidden. Une panne de base est levée : à la route de
 * la rendre en 500.
 */

export const MANAGER_ROLES = ['admin', 'manager']

/** `extra` rides next to { error, code } (a refusal that carries data, like a fresh recette). */
export const failJson = (status: number, code: string, error: string, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ ...extra, error, code }, { status, headers: { 'Cache-Control': 'no-store' } })

export interface ManagerUser {
  _id: unknown
  role: string
  /** The account's email as the database holds it: the author of a write. */
  email: string
}

/**
 * `bearerOnly` is for writes: the Authorization header and nothing else. A
 * cookie rides along with any request a browser makes, so accepting it on a
 * POST would let another site act as the manager. No Bearer header: 401.
 */
export async function requireManager(
  req: NextRequest,
  opts: { bearerOnly?: boolean } = {}
): Promise<ManagerUser | Response> {
  if (opts.bearerOnly && !req.headers.get('authorization')?.startsWith('Bearer ')) {
    return failJson(401, 'unauthorized', 'Session expirée')
  }
  const payload = getTokenFromRequest(req)
  if (!payload) return failJson(401, 'unauthorized', 'Session expirée')

  // Un filtre `undefined` est ignoré par mongoose : sans id valide, on tomberait
  // sur le premier compte actif.
  if (!mongoose.isValidObjectId(payload.userId)) return failJson(401, 'unauthorized', 'Session expirée')

  await connectDB()
  const user = await User.findOne({ _id: payload.userId, isActive: true })
    .select('role email')
    .lean<{ _id: unknown; role?: string; email?: string } | null>()
  if (!user) return failJson(401, 'unauthorized', 'Compte introuvable')
  if (!MANAGER_ROLES.includes(String(user.role))) return failJson(403, 'forbidden', 'Accès réservé aux managers')
  return { _id: user._id, role: String(user.role), email: String(user.email ?? '') }
}
