import Link from 'next/link'
import { AlertOctagon, AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, CheckCircle2, Info, Minus } from 'lucide-react'
import type { Alert, Dashboard, DayPoint, HourPoint, PassItem } from '@/lib/dashboard'
import { ORDER_SOURCE_ICONS, ORDER_SOURCE_LABELS, type OrderSource } from '@/lib/orderSource'

/**
 * Les briques du tableau de bord. Rendues côté serveur : aucun graphique ici
 * n'a besoin de JavaScript pour s'afficher, le survol passe par CSS.
 */

const TZ = 'Africa/Tunis'

export const money = (n: number) => `${(n || 0).toFixed(2)} DT`
export const timeTn = (iso: string) =>
  iso ? new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: TZ }) : ''
export const weekdayShort = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'short', timeZone: 'UTC' })
const dayLabel = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', timeZone: 'UTC' })

// ── Cadre ──────────────────────────────────────────────────────

export function Panel({
  title,
  subtitle,
  href,
  action,
  className = '',
  children,
}: {
  title: string
  subtitle?: React.ReactNode
  href?: string
  action?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <section className={`bg-card rounded-xl border flex flex-col ${className}`}>
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
        <div className="min-w-0">
          <h2 className="font-semibold text-sm">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {href && (
          <Link
            href={href}
            className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-[#F5A800] transition-colors"
          >
            {action ?? 'Voir'} <ArrowRight size={12} />
          </Link>
        )}
      </div>
      <div className="flex-1">{children}</div>
    </section>
  )
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-4 pb-6 pt-2 text-center text-sm text-muted-foreground">{children}</p>
}

// ── Comparaison ────────────────────────────────────────────────

/**
 * L'évolution contre un repère. Flèche et signe en plus de la couleur : la
 * couleur seule ne dit rien à qui ne la voit pas.
 */
export function Delta({ current, previous, label }: { current: number; previous: number; label: string }) {
  if (previous <= 0) {
    return <p className="text-[11px] text-muted-foreground">Pas de repère {label}</p>
  }
  const pct = ((current - previous) / previous) * 100
  const flat = Math.abs(pct) < 1
  const Icon = flat ? Minus : pct > 0 ? ArrowUpRight : ArrowDownRight
  const tone = flat
    ? 'text-muted-foreground bg-muted'
    : pct > 0
      ? 'text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-500/15'
      : 'text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-500/15'
  return (
    <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
      <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-bold ${tone}`}>
        <Icon size={12} />
        {flat ? '=' : `${pct > 0 ? '+' : ''}${pct.toFixed(0)} %`}
      </span>
      {label}
    </p>
  )
}

export function Kpi({
  label,
  value,
  children,
  accent,
  href,
}: {
  label: string
  value: string
  children?: React.ReactNode
  accent?: boolean
  href?: string
}) {
  const body = (
    <>
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl xl:text-3xl font-black tabular-nums ${accent ? 'text-[#F5A800]' : 'text-foreground'}`}>
        {value}
      </p>
      <div className="mt-1.5 space-y-1">{children}</div>
    </>
  )
  const cls = 'bg-card rounded-xl border p-4 block'
  return href ? (
    <Link href={href} className={`${cls} hover:border-[#F5A800]/60 transition-colors`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}

// ── À traiter ──────────────────────────────────────────────────

const ALERT_STYLE: Record<Alert['level'], { icon: typeof Info; box: string; icon_: string }> = {
  critical: {
    icon: AlertOctagon,
    box: 'border-red-500/40 bg-red-500/5',
    icon_: 'text-red-600 dark:text-red-400',
  },
  warning: {
    icon: AlertTriangle,
    box: 'border-amber-500/40 bg-amber-500/5',
    icon_: 'text-amber-600 dark:text-amber-400',
  },
  info: {
    icon: Info,
    box: 'border-border bg-card',
    icon_: 'text-blue-600 dark:text-blue-400',
  },
}

export function Alerts({ alerts }: { alerts: Alert[] }) {
  if (alerts.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-green-500/30 bg-green-500/5 px-4 py-3 text-sm">
        <CheckCircle2 size={16} className="text-green-600 dark:text-green-400" />
        <span className="font-semibold">Rien à traiter</span>
        <span className="text-muted-foreground">— aucune commande en attente, caisse et créances en ordre.</span>
      </div>
    )
  }
  // Ce qui presse a droit à une carte ; le reste tient sur une ligne de
  // pastilles, pour ne pas repousser les chiffres du jour sous la ligne de
  // flottaison — surtout sur un téléphone.
  const urgent = alerts.filter((a) => a.level !== 'info')
  const minor = alerts.filter((a) => a.level === 'info')
  return (
    <div className="space-y-2">
      {urgent.length > 0 && (
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {urgent.map((a, i) => {
            const s = ALERT_STYLE[a.level]
            return (
              <Link
                key={i}
                href={a.href}
                className={`group flex items-start gap-3 rounded-xl border px-4 py-3 transition-colors hover:border-[#F5A800]/60 ${s.box}`}
              >
                <s.icon size={18} className={`mt-0.5 shrink-0 ${s.icon_}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{a.title}</p>
                  {a.detail && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{a.detail}</p>}
                  <p className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground group-hover:text-[#F5A800]">
                    {a.action} <ArrowRight size={12} />
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      )}
      {minor.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {minor.map((a, i) => (
            <Link
              key={i}
              href={a.href}
              title={a.detail}
              className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs hover:border-[#F5A800]/60 hover:text-[#F5A800] transition-colors"
            >
              <Info size={13} className={ALERT_STYLE.info.icon_} />
              <span className="font-medium">{a.title}</span>
              <ArrowRight size={12} className="text-muted-foreground" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Graphiques ─────────────────────────────────────────────────

/** Les deux séries du graphique horaire, nommées par une légende et pas par la couleur seule. */
function Legend({ items }: { items: { label: string; swatch: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5">
          <span className={`inline-block h-2.5 w-2.5 rounded-sm ${it.swatch}`} />
          {it.label}
        </span>
      ))}
    </div>
  )
}

function Tooltip({ children }: { children: React.ReactNode }) {
  return (
    <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border bg-popover px-2.5 py-1.5 text-[11px] text-popover-foreground shadow-md group-hover:block">
      {children}
    </div>
  )
}

/**
 * Les ventes heure par heure, contre le même jour de la semaine passée.
 *
 * La semaine passée est en fond, journée entière : elle montre la forme du
 * service, y compris les heures qui ne sont pas encore arrivées — le coup de
 * feu de 20 h qu'on voit venir.
 */
export function HourlyChart({ hours, lastWeekDay, nowHour }: { hours: HourPoint[]; lastWeekDay: string; nowHour: number }) {
  const max = Math.max(1, ...hours.map((h) => Math.max(h.revenue, h.lastWeekRevenue)))
  return (
    <div className="px-4 pb-4">
      <Legend
        items={[
          { label: "Aujourd'hui", swatch: 'bg-[#F5A800]' },
          { label: `${weekdayShort(lastWeekDay)} dernier, même jour`, swatch: 'bg-muted-foreground/25 border border-muted-foreground/50' },
        ]}
      />
      <div className="mt-3 flex h-44 items-end gap-0.5 border-b border-border">
        {hours.map((h) => (
          <div key={h.hour} className="group relative flex h-full flex-1 items-end justify-center">
            {/* La semaine passée, en fond. */}
            <div
              className="absolute bottom-0 inset-x-0.5 rounded-t border-t-2 border-muted-foreground/40 bg-muted-foreground/10"
              style={{ height: `${(h.lastWeekRevenue / max) * 100}%` }}
            />
            {/* Aujourd'hui, devant. */}
            {!h.future && h.revenue > 0 && (
              <div
                className={`relative w-3/5 rounded-t bg-[#F5A800] ${h.hour === nowHour ? 'opacity-70' : ''}`}
                style={{ height: `${(h.revenue / max) * 100}%` }}
              />
            )}
            <Tooltip>
              <p className="font-bold">
                {h.hour}h{h.hour === nowHour ? ' · en cours' : ''}
              </p>
              <p>Aujourd&apos;hui : {h.future ? '—' : `${h.orders} cmd · ${money(h.revenue)}`}</p>
              <p className="text-muted-foreground">
                {weekdayShort(lastWeekDay)} dernier : {h.lastWeekOrders} cmd · {money(h.lastWeekRevenue)}
              </p>
            </Tooltip>
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-0.5">
        {hours.map((h) => (
          <span
            key={h.hour}
            className={`flex-1 text-center text-[10px] tabular-nums ${h.hour === nowHour ? 'font-bold text-foreground' : 'text-muted-foreground'}`}
          >
            {h.hour}
          </span>
        ))}
      </div>
    </div>
  )
}

/** Quatorze jours : la semaine en cours devant, la précédente en retrait pour la comparer. */
export function TrendChart({ days }: { days: DayPoint[] }) {
  const max = Math.max(1, ...days.map((d) => d.revenue))
  const today = days[days.length - 1]?.day
  return (
    <div className="px-4 pb-4">
      <Legend
        items={[
          { label: '7 derniers jours', swatch: 'bg-[#F5A800]' },
          { label: '7 jours précédents', swatch: 'bg-muted-foreground/30' },
        ]}
      />
      <div className="mt-3 flex h-36 items-end gap-1 border-b border-border">
        {days.map((d, i) => {
          const recent = i >= days.length - 7
          const isToday = d.day === today
          return (
            <div key={d.day} className="group relative flex h-full flex-1 items-end">
              <div
                className={`w-full rounded-t ${recent ? 'bg-[#F5A800]' : 'bg-muted-foreground/30'} ${isToday ? 'opacity-60' : ''}`}
                style={{ height: d.revenue > 0 ? `max(2px, ${(d.revenue / max) * 100}%)` : '0' }}
              />
              <Tooltip>
                <p className="font-bold capitalize">
                  {dayLabel(d.day)}
                  {isToday ? ' · en cours' : ''}
                </p>
                <p>
                  {d.orders} cmd · {money(d.revenue)}
                </p>
              </Tooltip>
            </div>
          )
        })}
      </div>
      <div className="mt-1 flex gap-1">
        {days.map((d) => (
          <span
            key={d.day}
            className={`flex-1 text-center text-[10px] leading-tight capitalize ${d.day === today ? 'font-bold text-foreground' : 'text-muted-foreground'}`}
          >
            {/* Le jour en initiale, le quantième dessous : lisible même à 14 colonnes sur un téléphone. */}
            <span className="block">{weekdayShort(d.day).slice(0, 2)}</span>
            {Number(d.day.slice(8))}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── En cuisine ─────────────────────────────────────────────────

const PASS_LABELS: Record<PassItem['status'], { label: string; badge: string }> = {
  pending: { label: 'À accepter', badge: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400' },
  confirmed: { label: 'Confirmée', badge: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300' },
  preparing: { label: 'En cuisine', badge: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300' },
  ready: { label: 'Prête', badge: 'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300' },
}

const age = (min: number) => (min < 60 ? `${min} min` : min < 1440 ? `${Math.floor(min / 60)} h ${min % 60}` : `${Math.floor(min / 1440)} j`)

export function PassPanel({ pass }: { pass: Dashboard['pass'] }) {
  return (
    <Panel
      title="En cours"
      subtitle={pass.total > 0 ? `${pass.total} commande${pass.total > 1 ? 's' : ''} pas encore partie${pass.total > 1 ? 's' : ''}` : undefined}
      href="/orders"
      action="Commandes"
    >
      <div className="grid grid-cols-4 gap-1.5 px-4 pb-3">
        {(Object.keys(PASS_LABELS) as PassItem['status'][]).map((status) => (
          <div
            key={status}
            className={`rounded-lg px-2 py-1.5 text-center ${pass.counts[status] > 0 ? PASS_LABELS[status].badge : 'bg-muted text-muted-foreground'}`}
          >
            <p className="text-lg font-black tabular-nums leading-tight">{pass.counts[status]}</p>
            <p className="text-[10px] font-semibold leading-tight">{PASS_LABELS[status].label}</p>
          </div>
        ))}
      </div>
      {pass.items.length === 0 ? (
        <Empty>Aucune commande en cours.</Empty>
      ) : (
        <ul className="divide-y border-t">
          {pass.items.map((o) => (
            <li key={o.id} className={`flex items-center gap-3 px-4 py-2.5 text-sm ${o.stale ? 'opacity-60' : ''}`}>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5">
                  <span className="font-bold">{o.orderNumber}</span>
                  <span className="text-xs">{o.type === 'delivery' ? '🛵' : '🥡'}</span>
                  <span className="truncate text-muted-foreground">{o.customer}</span>
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {o.stale ? 'un autre jour' : `il y a ${age(o.ageMin)}`}
                  {o.dueInMin !== null &&
                    (o.dueInMin >= 0 ? (
                      <> · prête dans {o.dueInMin} min</>
                    ) : (
                      <span className="font-semibold text-red-600 dark:text-red-400"> · retard {age(-o.dueInMin)}</span>
                    ))}
                </p>
              </div>
              <div className="text-right shrink-0">
                <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${PASS_LABELS[o.status].badge}`}>
                  {o.late && !o.stale && '⏱ '}
                  {PASS_LABELS[o.status].label}
                </span>
                <p className="text-[11px] tabular-nums text-muted-foreground mt-0.5">{money(o.total)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

// ── Répartitions ───────────────────────────────────────────────

const SOURCES: (OrderSource | 'unknown')[] = ['counter', 'website', 'kiosk', 'unknown']
const sourceLabel = (s: OrderSource | 'unknown') =>
  s === 'unknown' ? '❔ Inconnue' : `${ORDER_SOURCE_ICONS[s]} ${ORDER_SOURCE_LABELS[s]}`

function ShareBar({ label, count, revenue, total }: { label: string; count: number; revenue: number; total: number }) {
  const pct = total > 0 ? (revenue / total) * 100 : 0
  return (
    <div>
      <div className="flex justify-between gap-2 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums">
          <span className="font-semibold">{money(revenue)}</span>
          <span className="text-xs text-muted-foreground"> · {count} · {pct.toFixed(0)} %</span>
        </span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full bg-[#F5A800]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function MixPanel({ sales }: { sales: Dashboard['sales'] }) {
  return (
    <Panel title="D'où viennent les ventes" subtitle="Aujourd'hui, annulées exclues">
      {sales.orders === 0 ? (
        <Empty>Pas encore de vente aujourd&apos;hui.</Empty>
      ) : (
        <div className="space-y-3 px-4 pb-4">
          {SOURCES.filter((s) => sales.bySource[s].count > 0).map((s) => (
            <ShareBar key={s} label={sourceLabel(s)} total={sales.revenue} {...sales.bySource[s]} />
          ))}
          <div className="h-px bg-border" />
          <ShareBar label="🛵 Livraison" total={sales.revenue} {...sales.byType.delivery} />
          <ShareBar label="🥡 À emporter / sur place" total={sales.revenue} {...sales.byType.pickup} />
        </div>
      )}
    </Panel>
  )
}

export function TopProducts({ top }: { top: Dashboard['topProducts'] }) {
  const max = Math.max(1, ...top.items.map((p) => p.quantity))
  return (
    <Panel
      title="Les plus vendus"
      subtitle={top.scope === 'today' ? "Aujourd'hui, en quantité" : "Pas encore de vente aujourd'hui — les 7 derniers jours"}
      href="/products"
      action="Produits"
    >
      {top.items.length === 0 ? (
        <Empty>Aucune vente sur la période.</Empty>
      ) : (
        <ol className="space-y-2.5 px-4 pb-4">
          {top.items.map((p, i) => (
            <li key={p.name} className="text-sm">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate">
                  <span className="mr-1.5 text-xs font-bold text-muted-foreground">{i + 1}</span>
                  {p.name}
                </span>
                <span className="shrink-0 tabular-nums">
                  <span className="font-bold">×{p.quantity}</span>
                  <span className="text-xs text-muted-foreground"> · {money(p.revenue)}</span>
                </span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-foreground/30" style={{ width: `${(p.quantity / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  )
}

export function PlatformsPanel({ platforms }: { platforms: Dashboard['platforms'] }) {
  return (
    <Panel
      title="Dû par les plateformes"
      subtitle="Net de commission, versements non encore pointés"
      href="/platform-payouts"
      action="Règlements"
    >
      {platforms.outstanding <= 0 ? (
        <Empty>Rien à recevoir : tout a été versé.</Empty>
      ) : (
        <div className="px-4 pb-4">
          <p className="text-2xl font-black tabular-nums text-amber-600 dark:text-amber-400">{money(platforms.outstanding)}</p>
          <p className="text-[11px] text-muted-foreground">
            {platforms.orders} commande{platforms.orders > 1 ? 's' : ''} · la plus ancienne a {platforms.oldestDays} j
          </p>
          <ul className="mt-3 divide-y border-t">
            {platforms.byCompany.map((c) => (
              <li key={c.name} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span>
                  🛵 <span className="font-semibold">{c.name}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {c.orders} cmd · depuis {c.oldestDays} j
                  </span>
                </span>
                <span className="font-bold tabular-nums">{money(c.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  )
}

const RESA_BADGE: Record<string, { label: string; cls: string }> = {
  pending: { label: 'À confirmer', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300' },
  confirmed: { label: 'Confirmée', cls: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400' },
}

export function ReservationsPanel({ reservations }: { reservations: Dashboard['reservations'] }) {
  const guests = reservations.reduce((s, r) => s + r.guests, 0)
  return (
    <Panel
      title="Réservations du jour"
      subtitle={reservations.length > 0 ? `${reservations.length} table${reservations.length > 1 ? 's' : ''} · ${guests} couvert${guests > 1 ? 's' : ''}` : undefined}
      href="/reservations"
      action="Réservations"
    >
      {reservations.length === 0 ? (
        <Empty>Aucune réservation aujourd&apos;hui.</Empty>
      ) : (
        <ul className="divide-y border-t">
          {reservations.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <span className="w-12 shrink-0 font-bold tabular-nums">{r.time}</span>
              <span className="min-w-0 flex-1 truncate">
                {r.name} <span className="text-xs text-muted-foreground">· {r.guests} pers.</span>
              </span>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${RESA_BADGE[r.status]?.cls ?? 'bg-muted text-muted-foreground'}`}>
                {RESA_BADGE[r.status]?.label ?? r.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
