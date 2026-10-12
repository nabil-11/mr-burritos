import Link from 'next/link'
import { cookies } from 'next/headers'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { verifyToken } from '@/lib/auth'
import { mondayOf } from '@/lib/planning'
import { canEditPlanning, loadPlanning } from '@/lib/planningData'
import { DEFAULT_TIME_ZONE, addDays, dayOf, isDay } from '@/lib/reportTime'
import PlanningBoard from './PlanningBoard'

/**
 * Le planning de la semaine : qui travaille quel jour, à quelles heures, et
 * qui manque. La règle est dans lib/planning — la semaine type de chacun, et
 * les exceptions posées par-dessus, jour par jour.
 */

const dayFr = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' })

export default async function PlanningPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const sp = await searchParams
  const today = dayOf(new Date(), DEFAULT_TIME_ZONE)
  const monday = mondayOf(isDay(sp.week) ? sp.week : today)
  const thisMonday = mondayOf(today)

  const token = (await cookies()).get('token')?.value
  const role = token ? verifyToken(token)?.role : null
  const planning = await loadPlanning(monday, addDays(monday, 6), canEditPlanning(role))

  const arrow = 'p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground'

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold">Planning</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            La semaine type de chacun se répète ; un congé, une absence ou des horaires changés se
            notent sur le jour concerné.
          </p>
        </div>
        <div className="inline-flex items-center gap-1 rounded-xl border bg-card p-1">
          <Link href={`/planning?week=${addDays(monday, -7)}`} aria-label="Semaine précédente" className={arrow}>
            <ChevronLeft size={16} />
          </Link>
          <span className="px-2 text-sm font-semibold min-w-48 text-center">
            {dayFr(monday)} – {dayFr(addDays(monday, 6))}
          </span>
          <Link href={`/planning?week=${addDays(monday, 7)}`} aria-label="Semaine suivante" className={arrow}>
            <ChevronRight size={16} />
          </Link>
          {monday !== thisMonday && (
            <Link
              href="/planning"
              className="ml-1 rounded-lg px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Cette semaine
            </Link>
          )}
        </div>
      </div>

      <PlanningBoard planning={planning} />
    </div>
  )
}
