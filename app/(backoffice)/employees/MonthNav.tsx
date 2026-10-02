import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { monthLabel, shiftMonth } from '@/lib/payroll'

/** Mois précédent / suivant. Pas au-delà du mois en cours : le compte ne prévoit rien. */
export default function MonthNav({ month, thisMonth, href }: { month: string; thisMonth: string; href: (m: string) => string }) {
  const arrow = 'p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground'
  return (
    <div className="inline-flex items-center gap-1 rounded-xl border bg-card p-1">
      <Link href={href(shiftMonth(month, -1))} aria-label="Mois précédent" className={arrow}>
        <ChevronLeft size={16} />
      </Link>
      <span className="px-2 text-sm font-semibold capitalize min-w-32 text-center">{monthLabel(month)}</span>
      {month < thisMonth ? (
        <Link href={href(shiftMonth(month, 1))} aria-label="Mois suivant" className={arrow}>
          <ChevronRight size={16} />
        </Link>
      ) : (
        <span className="p-1.5 text-muted-foreground/30" aria-hidden>
          <ChevronRight size={16} />
        </span>
      )}
      {month !== thisMonth && (
        <Link href={href(thisMonth)} className="ml-1 rounded-lg px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">
          Ce mois-ci
        </Link>
      )}
    </div>
  )
}
