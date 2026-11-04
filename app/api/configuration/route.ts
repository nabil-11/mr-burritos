import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { Configuration } from '@/lib/models/Configuration'
import { failJson as fail, requireManager } from '@/lib/managerAuth'
import { DEADLINE_KEY, strictDeadline } from '@/lib/planningDeadline'
import { ATTENDANCE_DEADLINE_KEY, strictAttendanceDeadline } from '@/lib/attendanceDeadline'

const TYPES = ['string', 'number', 'boolean', 'json']

export async function GET() {
  await connectDB()
  const configs = await Configuration.find()
  return NextResponse.json(configs)
}

/**
 * POST /api/configuration — écrit un réglage.
 *
 * Admin ou manager, rôle relu en base (`requireManager`, sans `bearerOnly` : le
 * back-office passe par le cookie). Body : { key: string, value, type?,
 * description? }. Seuls value, type et description sont écrits, jamais le
 * corps tel quel : `{ key: { $ne: null } }` ne vise aucune autre clé.
 * `planning.validationDeadline` doit être `{ weekday: 0-6, time: 'HH:mm' }`
 * (objet ou JSON en texte), sinon 400 bad_request. De même
 * `attendance.validationDeadline` : { afterDays: 0-2, time: 'HH:mm' }.
 */
export async function POST(req: NextRequest) {
  try {
    const who = await requireManager(req)
    if (who instanceof Response) return who

    const body: unknown = await req.json().catch(() => null)
    if (!body || typeof body !== 'object' || Array.isArray(body)) return fail(400, 'bad_request', 'Corps JSON attendu')
    const { key, value, type, description } = body as Record<string, unknown>

    if (typeof key !== 'string' || key.trim() === '' || key.length > 120) return fail(400, 'bad_request', 'key invalide')
    if (value === undefined || value === null) return fail(400, 'bad_request', 'value requise')
    if (type !== undefined && (typeof type !== 'string' || !TYPES.includes(type))) return fail(400, 'bad_request', 'type invalide')
    if (description !== undefined && typeof description !== 'string') return fail(400, 'bad_request', 'description invalide')
    if (key === DEADLINE_KEY && !strictDeadline(value)) {
      return fail(400, 'bad_request', "Échéance invalide : { weekday: 0-6 (0 = lundi), time: 'HH:mm' }")
    }

    if (key === ATTENDANCE_DEADLINE_KEY && !strictAttendanceDeadline(value)) {
      return fail(400, 'bad_request', "Échéance invalide : { afterDays: 0-2 (jours après le jour de service), time: 'HH:mm' }")
    }

    const set: Record<string, unknown> = { value }
    if (type !== undefined) set.type = type
    if (description !== undefined) set.description = description.slice(0, 500)

    await connectDB()
    const config = await Configuration.findOneAndUpdate({ key }, { $set: set }, { upsert: true, returnDocument: 'after', runValidators: true })
    return NextResponse.json(config, { status: 201 })
  } catch {
    return fail(500, 'server_error', 'Erreur serveur')
  }
}
