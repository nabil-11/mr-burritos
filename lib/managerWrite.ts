import { NextRequest } from 'next/server'
import { failJson } from './managerAuth'
import { AttendanceError } from './attendance'
import { PlanningError } from './planning'
import { RecetteError } from './recette'

/**
 * Ce que partagent les routes d'écriture de /api/manager : lire le corps, et
 * rendre une erreur métier en `{ error, code }`.
 *
 * Le code vient de l'erreur (`RecetteError.code`, `PlanningError.code`) ou, à
 * défaut, du statut. On ne lit jamais le texte du message pour décider : il est
 * fait pour être lu par une personne et peut changer.
 */

const BY_STATUS: Record<number, string> = {
  400: 'bad_request',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not_found',
}

/** Le corps JSON s'il est un objet, sinon null (la route répond alors 400 bad_request). */
export async function readBody(req: NextRequest): Promise<Record<string, unknown> | null> {
  const body: unknown = await req.json().catch(() => null)
  return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : null
}

export const badRequest = (message: string) => failJson(400, 'bad_request', message)

/** Une erreur métier connue en réponse ; toute autre, un 500 sans détail. */
export function failFromError(e: unknown, extra: Record<string, unknown> = {}) {
  // Le pointage porte son code (window_closed...) et parfois des données (employeeIds).
  if (e instanceof AttendanceError) return failJson(e.status, e.code, e.message, { ...extra, ...e.extra })
  if (e instanceof RecetteError || e instanceof PlanningError) {
    const code = e.code ?? BY_STATUS[e.status] ?? (e.status >= 500 ? 'server_error' : 'conflict')
    return failJson(e.status, code, e.message, extra)
  }
  return failJson(500, 'server_error', 'Erreur serveur')
}
