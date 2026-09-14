import { NextRequest, NextResponse } from 'next/server'
import { callerFrom } from '@/lib/caisseCaller'
import { RecetteError, addMovement } from '@/lib/recette'

type Ctx = { params: Promise<{ id: string }> }

/**
 * POST /api/recettes/[id]/mouvements — une sortie de caisse.
 *
 * Body : { kind: 'achat' | 'depense', label, amount, note?, userName? }
 *
 * Refusée avec 409 une fois la recette clôturée : ses chiffres sont figés.
 * Ouverte comme les autres routes de recette — voir lib/caisseCaller.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const caller = callerFrom(req, body.userName)
    const recette = await addMovement(id, { ...body, userName: caller.name })
    return NextResponse.json(recette, { status: 201 })
  } catch (e: unknown) {
    return fail(e)
  }
}

function fail(e: unknown) {
  if (e instanceof RecetteError) return NextResponse.json({ error: e.message }, { status: e.status })
  const msg = e instanceof Error ? e.message : 'Erreur serveur'
  return NextResponse.json({ error: msg }, { status: 500 })
}
