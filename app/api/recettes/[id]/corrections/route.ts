import { NextRequest, NextResponse } from 'next/server'
import { getTokenFromRequest } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import { User } from '@/lib/models/User'
import { RecetteError } from '@/lib/recette'
import { CORRECTION_ROLES, applyCorrection } from '@/lib/recetteCorrection'

type Ctx = { params: Promise<{ id: string }> }

/**
 * POST /api/recettes/[id]/corrections — corriger une recette, clôturée ou non.
 *
 * Body : { action, reason, …champs de l'action } — voir lib/recetteCorrection.
 *
 * Contrairement aux autres routes de recette, ouvertes à la caisse, celle-ci
 * exige une session du back-office, et un responsable : elle change des
 * chiffres déjà arrêtés. Le nom inscrit au journal est celui du compte.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const token = getTokenFromRequest(req)
  if (!token) return NextResponse.json({ error: 'Connectez-vous au back-office' }, { status: 401 })
  if (!CORRECTION_ROLES.includes(token.role)) {
    return NextResponse.json({ error: 'Réservé aux responsables (admin, manager)' }, { status: 403 })
  }

  try {
    const { id } = await params
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Correction illisible' }, { status: 400 })

    await connectDB()
    const account = (await User.findById(token.userId).select('name').lean().catch(() => null)) as { name?: string } | null
    const result = await applyCorrection(id, body as Record<string, unknown>, {
      userId: token.userId,
      name: account?.name || token.email,
    })
    return NextResponse.json(result)
  } catch (e: unknown) {
    if (e instanceof RecetteError) return NextResponse.json({ error: e.message }, { status: e.status })
    const msg = e instanceof Error ? e.message : 'Erreur serveur'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
