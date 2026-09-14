import { NextRequest, NextResponse } from 'next/server'
import { callerFrom } from '@/lib/caisseCaller'
import { RecetteError, cancelMovement } from '@/lib/recette'

type Ctx = { params: Promise<{ id: string; mid: string }> }

/**
 * POST /api/recettes/[id]/mouvements/[mid]/cancel — annule une sortie.
 *
 * Rien n'est supprimé : la ligne reste sur la recette, marquée annulée avec
 * l'heure et l'auteur, et ne compte plus dans les totaux. 409 si elle l'est
 * déjà, ou si la recette est clôturée.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const { id, mid } = await params
    const body = await req.json().catch(() => ({}))
    const caller = callerFrom(req, body.userName)
    const recette = await cancelMovement(id, mid, caller.name)
    return NextResponse.json(recette)
  } catch (e: unknown) {
    return fail(e)
  }
}

function fail(e: unknown) {
  if (e instanceof RecetteError) return NextResponse.json({ error: e.message }, { status: e.status })
  const msg = e instanceof Error ? e.message : 'Erreur serveur'
  return NextResponse.json({ error: msg }, { status: 500 })
}
