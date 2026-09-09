import { NextRequest } from 'next/server'
import { getTokenFromRequest } from './auth'

/**
 * Who opened or closed a session.
 *
 * The recette routes are open, like the order routes the caisse and the kiosk
 * already call: the till is a machine bolted to a counter with nobody to log
 * in as, and asking it for a credential it has no way to hold was friction for
 * its own sake. So this identifies the caller, it does not gate them.
 *
 * A manager working from the back-office carries a session, and their email is
 * used. The till carries none and says who it is instead — the counter name in
 * its settings. Either way the name is copied onto the recette at the moment
 * it happens, so renaming or deleting an account later never rewrites history.
 */

export interface Caller {
  /** Null for the till: it is a device, not a user account. */
  userId: string | null
  name: string
}

export function callerFrom(req: NextRequest, declaredName?: unknown): Caller {
  const payload = getTokenFromRequest(req)
  if (payload) return { userId: payload.userId, name: payload.email }

  const name = typeof declaredName === 'string' ? declaredName.trim() : ''
  return { userId: null, name: name || 'Caisse' }
}
