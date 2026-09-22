import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { User } from '@/lib/models/User'
import { getTokenFromRequest } from '@/lib/auth'

/**
 * GET /api/auth/me — qui porte ce jeton.
 *
 * La caisse garde sa session d'un service à l'autre et la vérifie ici au
 * démarrage. Le compte est relu en base plutôt que déduit du jeton : un compte
 * désactivé ou supprimé doit cesser d'ouvrir la caisse tout de suite, pas au
 * bout des sept jours de validité du jeton.
 *
 * 401 dans tous les cas douteux — la caisse ne distingue pas « jeton expiré »
 * de « compte fermé » : elle redemande les identifiants.
 */
export async function GET(req: NextRequest) {
  try {
    const payload = getTokenFromRequest(req)
    if (!payload) return NextResponse.json({ error: 'Session expirée' }, { status: 401 })

    await connectDB()
    const user = await User.findOne({ _id: payload.userId, isActive: true })
      .select('name email role')
      .lean<{ _id: unknown; name?: string; email?: string; role?: string } | null>()
    if (!user) return NextResponse.json({ error: 'Compte introuvable' }, { status: 401 })

    return NextResponse.json({
      user: { id: String(user._id), name: user.name ?? '', email: user.email ?? '', role: user.role ?? '' },
    })
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
