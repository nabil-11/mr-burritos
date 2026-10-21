import { Order } from './models/Order'
import { PromoCode } from './models/PromoCode'
import { normalizePromoCode, type PromoTerms } from './promo'
import { DEFAULT_TIME_ZONE, addDays, dayOf, isDay, nextDay, startOfDay } from './reportTime'

/**
 * May this promo code be used, now, by this customer?
 *
 * What a code is worth is lib/promo's business and is computed the same way in
 * the browser; whether it may be used at all is only ever answered here: it
 * exists, it is switched on, its dates are around today, and it has uses left —
 * in total and for this phone number.
 *
 * A use is a website order carrying the code that was not cancelled, so an
 * order called off at the till hands its use back without anyone doing it.
 */

export type CodeDoc = {
  _id: unknown
  code: string
  description?: string
  kind: 'percent' | 'fixed'
  value: number
  minSubtotal?: number
  startsAt?: Date | null
  expiresAt: Date
  maxUses?: number
  maxUsesPerCustomer?: number
  stackable?: boolean
  isActive?: boolean
}

export type PromoCheck = { ok: true; terms: PromoTerms } | { ok: false; error: string }

const STILL_COUNTS = { $ne: 'cancelled' }

const frDay = (d: Date) =>
  new Intl.DateTimeFormat('fr-FR', { timeZone: DEFAULT_TIME_ZONE, day: 'numeric', month: 'long' }).format(d)

/** The last day a code works — the day before the instant it stops. */
export const lastValidDay = (expiresAt: Date) => dayOf(expiresAt.getTime() - 1, DEFAULT_TIME_ZONE)

export const termsOf = (c: CodeDoc): PromoTerms => ({
  code: c.code,
  description: c.description ?? '',
  kind: c.kind,
  value: c.value,
  minSubtotal: c.minSubtotal ?? 0,
  stackable: Boolean(c.stackable),
  expiresAt: new Date(c.expiresAt.getTime() - 1).toISOString(),
})

/** Used, in total, by orders that still count. */
export const usesOf = (code: string) => Order.countDocuments({ 'promo.code': code, status: STILL_COUNTS })

export async function checkPromoCode(raw: unknown, { phone, now = new Date() }: { phone?: string | null; now?: Date } = {}): Promise<PromoCheck> {
  const code = normalizePromoCode(raw)
  if (!code) return { ok: false, error: 'Saisissez un code promo' }
  const found = (await PromoCode.findOne({ code }).lean()) as CodeDoc | null
  if (!found) return { ok: false, error: `Le code ${code} n'existe pas` }
  if (found.isActive === false) return { ok: false, error: `Le code ${code} n'est plus actif` }
  if (found.startsAt && now < found.startsAt) {
    return { ok: false, error: `Le code ${code} sera valable à partir du ${frDay(found.startsAt)}` }
  }
  if (now >= found.expiresAt) {
    return { ok: false, error: `Le code ${code} a expiré le ${frDay(new Date(found.expiresAt.getTime() - 1))}` }
  }
  if (found.maxUses && (await usesOf(code)) >= found.maxUses) {
    return { ok: false, error: `Le code ${code} a déjà été utilisé le nombre de fois prévu` }
  }
  if (phone && found.maxUsesPerCustomer) {
    const mine = await Order.countDocuments({ 'promo.code': code, 'customer.phone': phone, status: STILL_COUNTS })
    if (mine >= found.maxUsesPerCustomer) {
      return {
        ok: false,
        error:
          found.maxUsesPerCustomer === 1
            ? `Vous avez déjà utilisé le code ${code}`
            : `Vous avez déjà utilisé le code ${code} ${found.maxUsesPerCustomer} fois`,
      }
    }
  }
  return { ok: true, terms: termsOf(found) }
}

export class PromoCodeInputError extends Error {}

const money = (v: unknown, what: string) => {
  const n = Number(String(v ?? '').replace(',', '.'))
  if (!Number.isFinite(n) || n < 0) throw new PromoCodeInputError(`${what} invalide`)
  return Math.round(n * 100) / 100
}
const count = (v: unknown, what: string) => {
  const n = v === '' || v === null ? 0 : Number(v)
  if (!Number.isInteger(n) || n < 0) throw new PromoCodeInputError(`${what} invalide`)
  return n
}

/**
 * The editable fields of a code, read from a request body. Only the keys
 * present are returned, so the "Actif" switch, which sends `{ isActive }`
 * alone, leaves the rest as it was. Dates arrive as days (AAAA-MM-JJ) and are
 * read in the shop's time zone: a code "valable jusqu'au 31" works until
 * midnight in Tunis on the 31st, whatever the server's clock says.
 */
export function promoCodeFields(body: Record<string, unknown>, creating: boolean): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (body.code !== undefined || creating) {
    const code = normalizePromoCode(body.code)
    if (code.length < 3) throw new PromoCodeInputError('Le code doit faire au moins 3 caractères (lettres, chiffres, - ou _)')
    out.code = code
  }
  if (body.description !== undefined) out.description = String(body.description ?? '').trim().slice(0, 120)
  if (body.kind !== undefined || creating) {
    if (body.kind !== 'percent' && body.kind !== 'fixed') throw new PromoCodeInputError('Type de réduction invalide')
    out.kind = body.kind
  }
  if (body.value !== undefined || creating) {
    const value = money(body.value, 'Valeur')
    if (value <= 0) throw new PromoCodeInputError('La réduction doit être supérieure à 0')
    if (out.kind === 'percent' && value > 100) throw new PromoCodeInputError('Un pourcentage ne dépasse pas 100')
    out.value = value
  }
  if (body.minSubtotal !== undefined) out.minSubtotal = money(body.minSubtotal, 'Montant minimum')
  if (body.startsOn !== undefined) {
    const day = String(body.startsOn ?? '')
    if (day && !isDay(day)) throw new PromoCodeInputError('Date de début invalide')
    out.startsAt = day ? startOfDay(day, DEFAULT_TIME_ZONE) : null
  }
  if (body.expiresOn !== undefined || creating) {
    const day = String(body.expiresOn ?? '')
    if (!isDay(day)) throw new PromoCodeInputError("La date d'expiration est requise")
    out.expiresAt = startOfDay(nextDay(day), DEFAULT_TIME_ZONE)
  }
  if (out.startsAt instanceof Date && out.expiresAt instanceof Date && out.startsAt >= out.expiresAt) {
    throw new PromoCodeInputError("La date d'expiration doit suivre la date de début")
  }
  if (body.maxUses !== undefined) out.maxUses = count(body.maxUses, "Nombre d'utilisations")
  if (body.maxUsesPerCustomer !== undefined) out.maxUsesPerCustomer = count(body.maxUsesPerCustomer, 'Utilisations par client')
  if (body.stackable !== undefined) out.stackable = Boolean(body.stackable)
  if (body.isActive !== undefined) out.isActive = Boolean(body.isActive)
  return out
}

/** A field edited alone must still agree with the ones already stored. */
export function checkAgainstStored(fields: Record<string, unknown>, stored: CodeDoc) {
  const kind = (fields.kind as string | undefined) ?? stored.kind
  const value = (fields.value as number | undefined) ?? stored.value
  if (kind === 'percent' && value > 100) throw new PromoCodeInputError('Un pourcentage ne dépasse pas 100')
  const startsAt = 'startsAt' in fields ? (fields.startsAt as Date | null) : stored.startsAt
  const expiresAt = (fields.expiresAt as Date | undefined) ?? stored.expiresAt
  if (startsAt && startsAt >= expiresAt) throw new PromoCodeInputError("La date d'expiration doit suivre la date de début")
}

/** A month from today, the form's suggestion for a new code. */
export const defaultExpiry = () => addDays(dayOf(new Date(), DEFAULT_TIME_ZONE), -30)
