/**
 * The date ranges the orders list can be filtered by.
 *
 * Bounds are computed in the server's local time, which is the kitchen's time —
 * a "today" that started at midnight UTC would cut the evening service in half.
 * `from` is inclusive, `to` exclusive.
 */

export const RANGE_KEYS = ['today', 'yesterday', 'week', 'month', 'year', 'all'] as const

export type RangeKey = (typeof RANGE_KEYS)[number]

/** What the list shows when nobody has chosen: the service running right now. */
export const DEFAULT_RANGE: RangeKey = 'today'

export const RANGE_LABELS: Record<RangeKey, string> = {
  today: "Aujourd'hui",
  yesterday: 'Hier',
  week: 'Cette semaine',
  month: 'Ce mois',
  year: 'Cette année',
  all: 'Tout',
}

export function normalizeRange(value: unknown): RangeKey {
  return typeof value === 'string' && (RANGE_KEYS as readonly string[]).includes(value)
    ? (value as RangeKey)
    : DEFAULT_RANGE
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

export function rangeBounds(key: RangeKey, now: Date = new Date()): { from?: Date; to?: Date } {
  const today = startOfDay(now)

  switch (key) {
    case 'today':
      return { from: today }
    case 'yesterday': {
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      return { from: yesterday, to: today }
    }
    case 'week': {
      // Weeks start on Monday here, like the rota does.
      const monday = new Date(today)
      monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
      return { from: monday }
    }
    case 'month':
      return { from: new Date(now.getFullYear(), now.getMonth(), 1) }
    case 'year':
      return { from: new Date(now.getFullYear(), 0, 1) }
    case 'all':
      return {}
  }
}
