/**
 * Les prix tels qu'un client tunisien les lit : « 12,50 DT », virgule et
 * espace insécable, jamais « 12.50 DT ». Une seule fonction pour tout le site,
 * pour que le menu, le panier et le suivi ne se contredisent pas.
 *
 * Aucun import serveur : la carte (serveur) et le panier (client) s'en servent.
 */

const NBSP = ' '

/** 12.5 → « 12,50 DT ». `sign` ajoute « + » devant un supplément. */
export function formatDT(amount: number, { sign = false }: { sign?: boolean } = {}): string {
  const n = Math.round((Number(amount) || 0) * 100) / 100
  const body = Math.abs(n).toFixed(2).replace('.', ',')
  const prefix = n < 0 ? '−' : sign && n > 0 ? '+' : ''
  return `${prefix}${body}${NBSP}DT`
}

/** Sans décimales inutiles : 11 → « 11 DT », 9.35 → « 9,35 DT » — pour les titres. */
export function formatDTShort(amount: number): string {
  const n = Math.round((Number(amount) || 0) * 100) / 100
  return Number.isInteger(n) ? `${n}${NBSP}DT` : formatDT(n)
}
