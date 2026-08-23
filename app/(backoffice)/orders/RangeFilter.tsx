import Link from 'next/link'
import { RANGE_KEYS, RANGE_LABELS, RangeKey } from './dateRange'

/**
 * Period picker for the orders list.
 *
 * Plain links rather than a client component: the page is server-rendered per
 * request anyway, so a `?range=` href does the whole job without shipping any
 * JavaScript, and each period stays bookmarkable.
 */
export default function RangeFilter({ active }: { active: RangeKey }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {RANGE_KEYS.map((key) => {
        const selected = key === active
        return (
          <Link
            key={key}
            href={`/orders?range=${key}`}
            aria-current={selected ? 'page' : undefined}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              selected
                ? 'bg-[#F5A800] border-[#F5A800] text-black'
                : 'bg-card border-border text-muted-foreground hover:border-[#F5A800]/50 hover:text-foreground'
            }`}
          >
            {RANGE_LABELS[key]}
          </Link>
        )
      })}
    </div>
  )
}
