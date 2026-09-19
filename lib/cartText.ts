/**
 * How a dish's supplements read to a customer. Shared by the cart (client) and
 * the order page (server), so a line reads the same before and after ordering.
 *
 * "Taille XL (Tacos), Escalope, Escalope, Algérienne" → "XL · 2× Escalope ·
 * Algérienne": the size reads as a size, a double portion as one, and the
 * backoffice's family suffix stays in the backoffice.
 */
export function describeSupplements(list: { name?: { fr?: string } }[] | undefined): string {
  const counts = new Map<string, number>()
  for (const s of list ?? []) {
    const fr = s?.name?.fr
    if (!fr) continue
    const label = fr.replace(/^Taille\s+/i, '').replace(/\s*\([^)]*\)\s*$/, '')
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  return [...counts].map(([label, n]) => (n > 1 ? `${n}× ${label}` : label)).join(' · ')
}
