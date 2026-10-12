import mongoose from 'mongoose'
import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { getTokenFromRequest } from '@/lib/auth'
import { Employee } from '@/lib/models/Employee'
import { PlanningDay } from '@/lib/models/PlanningDay'
import { PlanningError, cleanSchedule, cleanShifts, isDayKind } from '@/lib/planning'
import { canEditPlanning, cleanCopy, copyPlanning, loadPlanning } from '@/lib/planningData'
import { isDay } from '@/lib/reportTime'

export const dynamic = 'force-dynamic'

/**
 * Le planning du personnel — voir lib/planning pour la règle : la semaine type
 * de chacun, et par-dessus les exceptions posées jour par jour.
 *
 * Lu par le back-office et par la caisse. Tout compte connecté peut le lire —
 * un équipier a le droit de savoir quand il travaille ; seuls un gérant ou un
 * admin le modifient.
 */

/** GET /api/planning?from=AAAA-MM-JJ&to=AAAA-MM-JJ — sans dates, la semaine en cours. */
export async function GET(req: NextRequest) {
  try {
    const caller = getTokenFromRequest(req)
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { searchParams } = req.nextUrl
    return NextResponse.json(
      await loadPlanning(searchParams.get('from'), searchParams.get('to'), canEditPlanning(caller.role)),
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (e: unknown) {
    return fail(e)
  }
}

/**
 * PUT /api/planning — ce qu'un employé fait un jour précis.
 *
 * Body : { employeeId, date, kind, shifts?, note? }
 *   kind : 'travail' (avec `shifts`, ou sans pour reprendre ceux de la semaine
 *          type) · 'repos' · 'conge' · 'maladie' · 'absence'
 *          'semaine' — retire l'exception : le jour revient à la semaine type.
 */
export async function PUT(req: NextRequest) {
  try {
    const editor = editorOf(req)
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const employeeId = await employeeIdOf(body.employeeId)
    if (!isDay(body.date as string)) throw new PlanningError('Jour invalide')
    const date = body.date as string

    if (body.kind === 'semaine') {
      await PlanningDay.deleteOne({ employee: employeeId, date })
      return NextResponse.json({ ok: true })
    }
    if (!isDayKind(body.kind)) throw new PlanningError('Type de jour invalide')
    const shifts = body.kind === 'travail' ? cleanShifts(body.shifts) : []
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 200) : ''
    await PlanningDay.findOneAndUpdate(
      { employee: employeeId, date },
      { $set: { kind: body.kind, shifts, note, updatedBy: { name: editor } } },
      { upsert: true, runValidators: true }
    )
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return fail(e)
  }
}

/**
 * PATCH /api/planning — la semaine type d'un employé.
 *
 * Body : { employeeId, schedule: [{ day, from, to }] } — `day` de 0 (lundi) à
 * 6 (dimanche), deux créneaux par jour au plus. Un jour absent de la liste est
 * un jour de repos ; une liste vide, un employé sans planning.
 */
export async function PATCH(req: NextRequest) {
  try {
    editorOf(req)
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const employeeId = await employeeIdOf(body.employeeId)
    const schedule = cleanSchedule(body.schedule)
    await Employee.updateOne({ _id: employeeId }, { $set: { schedule } })
    return NextResponse.json({ ok: true, schedule })
  } catch (e: unknown) {
    return fail(e)
  }
}

/**
 * POST /api/planning — dupliquer.
 *
 * Body, au choix :
 *   { mode: 'day',   employeeId, from: 'AAAA-MM-JJ', to: ['AAAA-MM-JJ', …] }
 *   { mode: 'week',  from: 'AAAA-MM-JJ' (un jour de la semaine), weeks: 1…12, employeeId? }
 *   { mode: 'month', from: 'AAAA-MM', to?: 'AAAA-MM' (le mois suivant par défaut), employeeId? }
 *
 * Sans `employeeId`, la semaine ou le mois est recopié pour tous les employés
 * actifs. Ce qui se trouvait sur les jours d'arrivée est remplacé.
 */
export async function POST(req: NextRequest) {
  try {
    const editor = editorOf(req)
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    return NextResponse.json({ ok: true, ...(await copyPlanning(cleanCopy(body), editor)) })
  } catch (e: unknown) {
    return fail(e)
  }
}

/** Le nom de qui modifie — ou le refus, s'il n'en a pas le droit. */
function editorOf(req: NextRequest): string {
  const caller = getTokenFromRequest(req)
  if (!caller) throw new PlanningError('Unauthorized', 401)
  if (!canEditPlanning(caller.role)) throw new PlanningError('Seul un gérant peut modifier le planning', 403)
  return caller.email
}

async function employeeIdOf(raw: unknown): Promise<string> {
  const id = String(raw ?? '')
  if (!mongoose.isValidObjectId(id)) throw new PlanningError('Employé introuvable', 404)
  await connectDB()
  if (!(await Employee.exists({ _id: id }))) throw new PlanningError('Employé introuvable', 404)
  return id
}

function fail(e: unknown) {
  if (e instanceof PlanningError) return NextResponse.json({ error: e.message }, { status: e.status })
  const msg = e instanceof Error ? e.message : 'Erreur serveur'
  return NextResponse.json({ error: msg }, { status: 500 })
}
