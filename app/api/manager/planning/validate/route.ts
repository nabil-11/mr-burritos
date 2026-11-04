import { NextRequest, NextResponse } from 'next/server'
import { PlanningValidation } from '@/lib/models/PlanningValidation'
import { failJson as fail, requireManager } from '@/lib/managerAuth'
import { badRequest, readBody } from '@/lib/managerWrite'
import { parseValidateWeek } from '@/lib/planningDeadline'
import { DEFAULT_TIME_ZONE, dayOf } from '@/lib/reportTime'

export const dynamic = 'force-dynamic'

/**
 * POST /api/manager/planning/validate — le gérant valide une semaine de planning.
 *
 * Body : { week: 'AAAA-MM-JJ' } — le lundi de cette semaine ou l'un des 2
 * suivants ; un lundi plus loin : 400 bad_request (sinon on fait taire le
 * rappel pour un an).
 *
 * Idempotent : un upsert `$setOnInsert` sur `weekStart` (unique). Le premier
 * qui valide reste celui qu'on lit ; un second appel rend les mêmes
 * `validatedBy` / `validatedAt` avec `alreadyValidated: true`. On ne dévalide
 * pas : il n'y a pas de route pour cela.
 *
 * Écriture : l'en-tête Bearer seul, jamais le cookie. L'auteur est l'e-mail du
 * compte, relu en base.
 *
 * Returns `{ ok, week, validatedBy, validatedAt, alreadyValidated }`. Errors are
 * `{ error, code }`: 401 unauthorized, 403 forbidden, 400 bad_request,
 * 400 past_week, 500 server_error.
 */

type Mark = { validatedBy?: { name?: string } | null; validatedAt?: Date }

export async function POST(req: NextRequest) {
  try {
    const who = await requireManager(req, { bearerOnly: true })
    if (who instanceof Response) return who

    const body = await readBody(req)
    if (!body) return badRequest('Corps JSON attendu')
    const week = parseValidateWeek(body.week, dayOf(new Date(), DEFAULT_TIME_ZONE))
    if (!week.ok) {
      return week.code === 'past_week'
        ? fail(400, 'past_week', 'Cette semaine est déjà passée')
        : badRequest('week invalide : le lundi de cette semaine ou des 2 suivantes, AAAA-MM-JJ')
    }

    const mine = { user: who._id, name: who.email }
    const at = new Date()
    let before: Mark | null
    try {
      // `returnDocument: 'before'` : null veut dire que ce passage a créé le marqueur.
      before = (await PlanningValidation.findOneAndUpdate(
        { weekStart: week.monday },
        { $setOnInsert: { weekStart: week.monday, validatedBy: mine, validatedAt: at } },
        { upsert: true, returnDocument: 'before' }
      ).lean()) as Mark | null
    } catch (e) {
      // Deux validations au même instant : l'autre a gagné l'index unique.
      if ((e as { code?: number })?.code !== 11000) throw e
      before = (await PlanningValidation.findOne({ weekStart: week.monday }).lean()) as Mark | null
    }

    const by = before ? (before.validatedBy?.name ?? '') : who.email
    const when = before?.validatedAt ? new Date(before.validatedAt) : at
    return NextResponse.json(
      { ok: true, week: week.monday, validatedBy: by, validatedAt: when.toISOString(), alreadyValidated: Boolean(before) },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch {
    return fail(500, 'server_error', 'Erreur serveur')
  }
}
