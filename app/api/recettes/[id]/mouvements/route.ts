import { NextRequest, NextResponse } from 'next/server'
import { callerFrom } from '@/lib/caisseCaller'
import { RecetteError, addMovements } from '@/lib/recette'

type Ctx = { params: Promise<{ id: string }> }

/**
 * POST /api/recettes/[id]/mouvements — un mouvement de caisse.
 *
 * Body : { kind, label, amount, note?, userName? }
 *   kind : 'achat' | 'depense' — de l'argent sort et il est dépensé
 *          'apport'           — de l'argent entre dans le tiroir (ajout au fond)
 *          'retrait'          — de l'argent sort sans être dépensé (banque, coffre)
 *
 * Ou plusieurs d'un coup : { userName?, mouvements: [ {…}, {…} ] }. Le cas qui
 * l'exige est celui du fond insuffisant — « je remets 20 DT dans le tiroir et
 * je paie les 35 DT de pain » est une seule décision : ses deux lignes sont
 * écrites ensemble, ou aucune ne l'est.
 *
 * Refusée avec 409 une fois la recette clôturée : ses chiffres sont figés.
 * Ouverte comme les autres routes de recette — voir lib/caisseCaller.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const caller = callerFrom(req, body.userName)
    const inputs = Array.isArray(body.mouvements) ? body.mouvements : [body]
    const recette = await addMovements(id, inputs, caller.name)
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
