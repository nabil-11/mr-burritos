import { createHash, timingSafeEqual } from 'crypto'
import { NextRequest } from 'next/server'
import { getTokenFromRequest } from './auth'

/**
 * Who is asking — a back-office session, or the till.
 *
 * The caisse is a desktop application with no login: it is a machine bolted to
 * a counter, not a person, so it carries a shared key instead of a password.
 * The key lives in `CAISSE_KEY` on the server and in the till's settings.
 *
 * Nothing falls back to "open" here. With no key configured the till is simply
 * refused, because the alternative — treating an unset variable as permission —
 * would put "open and close the day's takings" on the public internet.
 */

export interface Caller {
  /** Null for the till: it is a device, not a user account. */
  userId: string | null
  /** Printed onto the session as whoever opened or closed it. */
  name: string
  role: string
}

/**
 * Constant-time comparison. Both secrets are hashed first so that strings of
 * different lengths can be compared at all, and so the loop never leaks how
 * many leading characters a guess got right.
 */
function sameSecret(a: string, b: string): boolean {
  return timingSafeEqual(
    createHash('sha256').update(a).digest(),
    createHash('sha256').update(b).digest()
  )
}

/** A manager's token, or the till's key. Throws `Unauthorized` otherwise. */
export function requireCaisseOrAuth(req: NextRequest): Caller {
  const payload = getTokenFromRequest(req)
  if (payload) return { userId: payload.userId, name: payload.email, role: payload.role }

  const expected = process.env.CAISSE_KEY?.trim()
  const sent = req.headers.get('x-caisse-key')?.trim()
  if (expected && sent && sameSecret(expected, sent)) {
    return { userId: null, name: 'Caisse', role: 'caisse' }
  }
  throw new Error('Unauthorized')
}
