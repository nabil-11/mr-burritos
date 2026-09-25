import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { Order } from '@/lib/models/Order'
import { PlatformPayout } from '@/lib/models/PlatformPayout'
import { requireAuth } from '@/lib/auth'

type Ctx = { params: Promise<{ id: string }> }

/**
 * DELETE — annuler un versement saisi par erreur.
 *
 * Un versement pointé à tort n'est pas un fait à conserver : c'est une faute de
 * frappe. On le supprime donc, et surtout on rouvre les créances qu'il avait
 * fermées — sinon l'argent que la plateforme doit encore disparaîtrait de
 * l'écran, ce qui est la seule façon de le perdre pour de bon.
 *
 * Les commandes rendues « à recevoir » sont celles que ce versement portait, pas
 * toutes celles de la plateforme : une autre semaine réglée entre-temps reste
 * réglée.
 */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    requireAuth(req)
    await connectDB()
    const { id } = await params
    const payout = await PlatformPayout.findById(id)
    if (!payout) return NextResponse.json({ error: 'Versement introuvable' }, { status: 404 })

    const { modifiedCount } = await Order.updateMany(
      { 'deliveryCompany.payout': payout._id },
      {
        $set: {
          'deliveryCompany.paid': false,
          'deliveryCompany.paidAt': null,
          'deliveryCompany.paidBy': '',
          'deliveryCompany.payout': null,
          'deliveryCompany.payoutRef': '',
        },
      }
    )
    await payout.deleteOne()

    return NextResponse.json({ success: true, reopened: modifiedCount })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur serveur'
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 })
  }
}
