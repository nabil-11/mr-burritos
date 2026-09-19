/**
 * Tunisian phone numbers, as customers type them and as the shop keeps them.
 *
 * The same person turns up as "99123456", "99 123 456", "+216 99 123 456" and
 * "0021699123456". Stored as typed, those are four customers: the order
 * tracker could not find an order placed with a space in the number, and the
 * client count on the home page counted one person several times. Website
 * orders are therefore stored as the bare 8 digits, and lookups compare digits
 * only, so orders stored before this still match.
 *
 * No server imports: the cart page validates with the same rule it will be
 * held to.
 */

/** The 8-digit national number, or null when the input is not one. */
export function normalizeTnPhone(raw: unknown): string | null {
  let digits = String(raw ?? '').replace(/\D/g, '')
  if (digits.length === 13 && digits.startsWith('00216')) digits = digits.slice(5)
  else if (digits.length === 11 && digits.startsWith('216')) digits = digits.slice(3)
  return /^\d{8}$/.test(digits) ? digits : null
}

/** "99123456" → "99 123 456", the way numbers are read out in Tunisia. */
export function formatTnPhone(raw: string): string {
  const d = normalizeTnPhone(raw)
  return d ? `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5)}` : raw
}

/**
 * Matches a stored phone field holding these 8 digits in any of the ways they
 * were typed before numbers were normalized: separators anywhere, an optional
 * 216 / 00216 prefix. Digits only go into the pattern, so it is safe to build.
 */
export function tnPhonePattern(digits: string): RegExp {
  const body = digits.split('').join('\\D*')
  return new RegExp(`^\\D*(?:(?:00)?216\\D*)?${body}\\D*$`)
}
