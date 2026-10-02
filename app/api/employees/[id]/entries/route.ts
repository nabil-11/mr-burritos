import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { connectDB } from '@/lib/mongodb'
import { requireAuth } from '@/lib/auth'
import { callerFrom } from '@/lib/caisseCaller'
import { Employee } from '@/lib/models/Employee'
import { EmployeeEntry, ENTRY_KINDS, PAYMENT_METHODS } from '@/lib/models/EmployeeEntry'
import { RecetteError, addMovements, getOpenRecette } from '@/lib/recette'
import { DEFAULT_TIME_ZONE, dayOf, isDay, startOfDay } from '@/lib/reportTime'
import { EmployeeInputError, amountOf, employeeError } from '../../fields'

type Ctx = { params: Promise<{ id: string }> }

/**
 * POST /api/employees/[id]/entries — une ligne sur le compte de l'employé.
 *
 * Body : { kind: 'prime' | 'retenue' | 'paiement', amount, date?, note?, method? }
 *
 * Un paiement avec `method: 'caisse'` sort du tiroir : il ne s'écrit pas ici
 * mais sur la recette ouverte, comme une dépense « Salaire · Houssine » — sans
 * quoi le tiroir ne tomberait plus juste. Refusé si aucune recette n'est
 * ouverte. Les autres méthodes (virement, chèque, espèces du patron) ne
 * touchent pas le tiroir et restent sur le compte de l'employé.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    requireAuth(req)
    const { id } = await params
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: 'Non trouvé' }, { status: 404 })
    const body = await req.json().catch(() => ({}))
    const caller = callerFrom(req)

    const kind = String(body.kind)
    if (!(ENTRY_KINDS as readonly string[]).includes(kind)) throw new EmployeeInputError('Type de ligne invalide')
    const amount = amountOf(body.amount)
    if (amount <= 0) throw new EmployeeInputError('Montant invalide')
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 200) : ''

    await connectDB()
    const employee = (await Employee.findById(id).select('name').lean()) as { name: string } | null
    if (!employee) return NextResponse.json({ error: 'Non trouvé' }, { status: 404 })

    if (kind === 'paiement' && body.method === 'caisse') {
      const open = await getOpenRecette()
      if (!open) throw new EmployeeInputError('Aucune recette ouverte : ouvrez la caisse, ou choisissez un autre moyen', 409)
      const recette = await addMovements(
        String(open._id),
        [{ kind: 'depense', label: '', amount, note, employeeId: id, employeeReason: 'salaire' }],
        caller.name
      )
      return NextResponse.json({ recetteId: String(recette._id), source: 'caisse' }, { status: 201 })
    }

    const method = kind === 'paiement' ? String(body.method || 'especes') : null
    if (method && !(PAYMENT_METHODS as readonly string[]).includes(method)) {
      throw new EmployeeInputError('Moyen de paiement invalide')
    }

    // Le jour choisi, ou maintenant. Jamais dans le futur : le compte dit ce
    // qui s'est passé, pas ce qui est prévu.
    const tz = DEFAULT_TIME_ZONE
    const today = dayOf(new Date(), tz)
    const day = typeof body.date === 'string' && body.date ? body.date : today
    if (!isDay(day)) throw new EmployeeInputError('Date invalide')
    if (day > today) throw new EmployeeInputError('Date dans le futur')
    const date = day === today ? new Date() : new Date(startOfDay(day, tz).getTime() + 12 * 3600_000)

    const entry = await EmployeeEntry.create({
      employee: id,
      kind,
      amount,
      date,
      method,
      note,
      createdBy: { name: caller.name },
    })
    return NextResponse.json(entry, { status: 201 })
  } catch (e: unknown) {
    if (e instanceof RecetteError) return NextResponse.json({ error: e.message }, { status: e.status })
    return employeeError(e)
  }
}
