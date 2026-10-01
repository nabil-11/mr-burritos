import Link from 'next/link'
import { BarChart3, ClipboardPlus, Wallet } from 'lucide-react'
import { getDashboard } from '@/lib/dashboard'
import { addDays, hourOf } from '@/lib/reportTime'
import LiveRefresh from './LiveRefresh'
import {
  Alerts,
  Delta,
  HourlyChart,
  Kpi,
  MixPanel,
  Panel,
  PassPanel,
  PlatformsPanel,
  ReservationsPanel,
  TopProducts,
  TrendChart,
  money,
  timeTn,
  weekdayShort,
} from './widgets'

/**
 * Le tableau de bord : le service en cours, d'un coup d'œil.
 *
 * De haut en bas, dans l'ordre où un gérant pose ses questions : y a-t-il
 * quelque chose à faire ? comment se passe la journée ? qu'est-ce qui attend en
 * cuisine ? et seulement ensuite, les tendances. La logique est dans
 * lib/dashboard ; cette page ne fait que l'afficher.
 */

export default async function DashboardPage() {
  const d = await getDashboard()
  const now = new Date(d.now)
  const lastWeekDay = addDays(d.today, -7)
  const vsLabel = `vs ${weekdayShort(lastWeekDay)} dernier à ${timeTn(d.now)}`
  const dateLong = new Date(`${d.today}T12:00:00Z`).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })

  return (
    <div className="space-y-5">
      {/* ── En-tête ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Tableau de bord</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="capitalize">{dateLong}</span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
                d.shop.open
                  ? 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${d.shop.open ? 'bg-green-500' : 'bg-muted-foreground'}`} />
              {d.shop.open ? `Ouvert · ferme à ${d.shop.at}` : `Fermé · ouvre à ${d.shop.at}`}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LiveRefresh generatedAt={d.now} />
          <Link
            href="/reports"
            className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-2 text-sm font-medium hover:bg-muted transition-colors"
          >
            <BarChart3 size={15} /> Rapports
          </Link>
          <Link
            href="/orders/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#F5A800] px-3 py-2 text-sm font-semibold text-black hover:bg-[#F5A800]/85 transition-colors"
          >
            <ClipboardPlus size={15} /> Nouvelle commande
          </Link>
        </div>
      </div>

      {/* ── À traiter ───────────────────────────────────────────── */}
      <Alerts alerts={d.alerts} />

      {/* ── La journée en quatre chiffres ───────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <Kpi label="Ventes du jour" value={money(d.sales.revenue)} accent>
          <Delta current={d.sales.revenue} previous={d.sameTimeLastWeek.revenue} label={vsLabel} />
        </Kpi>
        <Kpi label="Commandes" value={String(d.sales.orders)}>
          <Delta current={d.sales.orders} previous={d.sameTimeLastWeek.orders} label={vsLabel} />
          {d.sales.cancelled > 0 && (
            <p className="text-[11px] text-muted-foreground">
              {d.sales.cancelled} annulée{d.sales.cancelled > 1 ? 's' : ''}, non comptée{d.sales.cancelled > 1 ? 's' : ''}
            </p>
          )}
        </Kpi>
        <Kpi label="Panier moyen" value={money(d.sales.avgTicket)}>
          <Delta current={d.sales.avgTicket} previous={d.sameTimeLastWeek.avgTicket} label={vsLabel} />
        </Kpi>
        {d.till.open ? (
          <Kpi label={`Caisse · ${d.till.number}`} value={money(d.till.cashInDrawer)} href={`/recettes/${d.till.id}`}>
            <p className="text-[11px] text-muted-foreground">
              Espèces attendues dans le tiroir · ouverte à {timeTn(d.till.openedAt)}
              {d.till.openedBy && ` par ${d.till.openedBy}`}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {d.till.totals.orders} cmd · {money(d.till.totals.revenue)} · encaissé{' '}
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">{money(d.till.totals.collected)}</span>
            </p>
          </Kpi>
        ) : (
          <Kpi label="Caisse" value="Fermée" href="/recettes">
            <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Wallet size={12} /> Ouvrez-la depuis la barre latérale avant le service.
            </p>
          </Kpi>
        )}
      </div>

      {/* ── Le service, heure par heure — et ce qui attend ──────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Panel
          className="xl:col-span-2"
          title="Ventes par heure"
          subtitle={`Aujourd'hui contre ${weekdayShort(lastWeekDay)} dernier — la journée entière en fond, pour voir venir le coup de feu`}
          href="/reports"
          action="Rapport du jour"
        >
          <HourlyChart hours={d.hours} lastWeekDay={lastWeekDay} nowHour={hourOf(now, 'Africa/Tunis')} />
        </Panel>
        <PassPanel pass={d.pass} />
      </div>

      {/* ── Tendance et répartition ─────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Panel
          className="xl:col-span-2"
          title="14 derniers jours"
          subtitle={
            <div className="inline-flex flex-wrap items-center gap-x-2">
              7 jours : <b className="text-foreground">{money(d.week.current.revenue)}</b> · {d.week.current.orders} cmd
              <Delta
                current={d.week.current.revenue}
                previous={d.week.previous.revenue}
                label="vs les 7 jours précédents, à heure égale"
              />
            </div>
          }
        >
          <TrendChart days={d.days} />
        </Panel>
        <MixPanel sales={d.sales} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <TopProducts top={d.topProducts} />
        <PlatformsPanel platforms={d.platforms} />
        <ReservationsPanel reservations={d.reservations} />
      </div>
    </div>
  )
}
