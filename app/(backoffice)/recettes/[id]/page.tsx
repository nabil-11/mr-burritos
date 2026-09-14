import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Printer } from 'lucide-react'
import { connectDB } from '@/lib/mongodb'
import { Recette } from '@/lib/models/Recette'
import { cashDifference, recetteOrders, recetteTotals, type RecetteTotals } from '@/lib/recette'
import { ORDER_SOURCES, orderSourceIcon, orderSourceLabel } from '@/lib/orderSource'

/**
 * Le détail d'une session de caisse : les chiffres, les sorties de caisse
 * (achats et dépenses payés depuis le tiroir), puis les commandes.
 *
 * Une session clôturée affiche le total figé au moment de la clôture ; une
 * session encore ouverte est recalculée à chaque affichage.
 */

type Doc = {
  _id: unknown
  number?: string
  status?: string
  openedAt?: Date
  closedAt?: Date | null
  openedBy?: { name?: string }
  closedBy?: { name?: string }
  openingFloat?: number
  closingCash?: number | null
  notes?: string
  mouvements?: MovementDoc[]
  totals?: RecetteTotals | null
}

type MovementDoc = {
  _id: unknown
  kind?: string
  label?: string
  amount?: number
  note?: string
  createdAt?: Date
  createdBy?: { name?: string }
  cancelledAt?: Date | null
  cancelledBy?: { name?: string }
}

type OrderDoc = Record<string, unknown>

const statusLabels: Record<string, string> = {
  pending: 'En attente', confirmed: 'Confirmée', preparing: 'En préparation',
  ready: 'Prête', delivered: 'Livrée', cancelled: 'Annulée',
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-300',
  confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300',
  preparing: 'bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300',
  ready: 'bg-purple-100 text-purple-800 dark:bg-purple-500/15 dark:text-purple-300',
  delivered: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300',
}

const money = (n: number) => `${(n || 0).toFixed(2)} DT`
const dateFr = (d: unknown) => (d ? new Date(d as string).toLocaleDateString('fr-FR') : '')
const timeFr = (d: unknown) =>
  d ? new Date(d as string).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''

export default async function RecetteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await connectDB()
  const { id } = await params
  const recette = (await Recette.findById(id).lean()) as Doc | null
  if (!recette) notFound()

  const [totals, orders] = await Promise.all([
    recetteTotals(recette),
    recetteOrders(recette._id) as Promise<OrderDoc[]>,
  ])
  const gap = cashDifference(recette, totals)
  const isOpen = recette.status === 'open'
  const expectedCash = (recette.openingFloat || 0) + totals.cashExpected

  return (
    <div>
      <Link
        href="/recettes"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3"
      >
        <ArrowLeft size={15} /> Recettes
      </Link>

      <div className="flex flex-wrap items-center gap-3 mb-1">
        <h1 className="text-2xl font-bold">{recette.number}</h1>
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
            isOpen
              ? 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          {isOpen && <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />}
          {isOpen ? 'Ouverte' : 'Clôturée'}
        </span>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Ouverte le {dateFr(recette.openedAt)} à {timeFr(recette.openedAt)}
        {recette.openedBy?.name && ` par ${recette.openedBy.name}`}
        {recette.closedAt && (
          <> · clôturée le {dateFr(recette.closedAt)} à {timeFr(recette.closedAt)}
            {recette.closedBy?.name && ` par ${recette.closedBy.name}`}</>
        )}
        {isOpen && ' · les chiffres bougent encore'}
      </p>

      {/* ── Chiffres clés ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Stat label="Chiffre d'affaires" value={money(totals.revenue)} accent />
        <Stat label="Net (après commissions)" value={money(totals.net)} />
        <Stat
          label="Commandes"
          value={String(totals.orders)}
          hint={totals.cancelled > 0 ? `${totals.cancelled} annulée${totals.cancelled > 1 ? 's' : ''}` : undefined}
        />
        <Stat
          label="Panier moyen"
          value={money(totals.orders > 0 ? totals.revenue / totals.orders : 0)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
        {/* ── Caisse ──────────────────────────────────────────── */}
        <Card title="Caisse">
          <Line label="Fond de caisse" value={money(recette.openingFloat || 0)} />
          <Line label="Ventes sur place" value={`+ ${money(totals.cashSales)}`} />
          {totals.achats > 0 && <Line label="Achats" value={`− ${money(totals.achats)}`} />}
          {totals.depenses > 0 && <Line label="Dépenses" value={`− ${money(totals.depenses)}`} />}
          <Line label="Espèces attendues" value={money(expectedCash)} strong />
          <Line
            label="Espèces comptées"
            value={typeof recette.closingCash === 'number' ? money(recette.closingCash) : 'non compté'}
          />
          <Line
            label="Écart"
            value={gap === null ? '—' : `${gap > 0 ? '+' : ''}${gap.toFixed(2)} DT`}
            tone={
              gap === null ? undefined : Math.abs(gap) < 0.005 ? 'good' : gap > 0 ? 'warn' : 'bad'
            }
            strong
          />
          <p className="px-3 pt-2 text-[11px] text-muted-foreground leading-snug">
            Les ventes sur place regroupent la caisse et la borne, hors plateformes de livraison —
            le mode de paiement n&apos;est pas enregistré. Les achats et dépenses payés depuis le
            tiroir en sont déduits.
          </p>
        </Card>

        {/* ── Détail des montants ─────────────────────────────── */}
        <Card title="Montants">
          <Line label="Remises accordées" value={`− ${money(totals.discounts)}`} />
          <Line label="Majorations" value={`+ ${money(totals.surcharges)}`} />
          <Line label="Frais de livraison" value={money(totals.deliveryFees)} />
          <Line label="Commissions plateformes" value={`− ${money(totals.commission)}`} />
          <Line label="Net encaissé" value={money(totals.net)} strong />
        </Card>

        {/* ── Répartition ─────────────────────────────────────── */}
        <Card title="Répartition">
          <Line
            label="🛵 Livraison"
            value={`${totals.byType.delivery.count} · ${money(totals.byType.delivery.revenue)}`}
          />
          <Line
            label="🥡 À emporter"
            value={`${totals.byType.pickup.count} · ${money(totals.byType.pickup.revenue)}`}
          />
          <div className="h-px bg-border my-1" />
          {[...ORDER_SOURCES, 'unknown' as const].map((key) => {
            const bucket = totals.bySource?.[key]
            if (!bucket || bucket.count === 0) return null
            return (
              <Line
                key={key}
                label={`${orderSourceIcon(key, '•')} ${orderSourceLabel(key, 'Origine inconnue')}`}
                value={`${bucket.count} · ${money(bucket.revenue)}`}
              />
            )
          })}
        </Card>
      </div>

      {/* ── Sorties de caisse ─────────────────────────────────── */}
      {(recette.mouvements?.length ?? 0) > 0 && (
        <MovementsTable movements={recette.mouvements ?? []} totals={totals} />
      )}

      {recette.notes && (
        <div className="mb-4 rounded-xl border bg-card px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Note</p>
          <p className="text-sm whitespace-pre-wrap">{recette.notes}</p>
        </div>
      )}

      {/* ── Commandes de la session ───────────────────────────── */}
      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="px-4 py-3 border-b">
          <p className="font-semibold text-sm">
            Commandes de la recette{' '}
            <span className="text-muted-foreground font-normal">({orders.length})</span>
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-150">
            <thead className="bg-muted/50 border-b">
              <tr>
                {['N° Commande', 'Heure', 'Client', 'Type', 'Origine', 'Statut', 'Total', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {orders.map((order) => {
                const customer = (order.customer ?? {}) as Record<string, string>
                const status = String(order.status)
                return (
                  <tr key={String(order._id)} className="hover:bg-muted/50">
                    <td className="px-4 py-3 font-semibold">{String(order.orderNumber ?? '')}</td>
                    <td className="px-4 py-3 text-muted-foreground">{timeFr(order.createdAt)}</td>
                    <td className="px-4 py-3">{customer.name ?? ''}</td>
                    <td className="px-4 py-3">{order.type === 'delivery' ? '🛵 Livraison' : '🥡 À emporter'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {orderSourceIcon(order.source)} {orderSourceLabel(order.source)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${statusColors[status] ?? 'bg-muted text-muted-foreground'}`}>
                        {statusLabels[status] ?? status}
                      </span>
                    </td>
                    <td className={`px-4 py-3 font-bold ${status === 'cancelled' ? 'line-through text-muted-foreground' : ''}`}>
                      {money(Number(order.total ?? 0))}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/orders/${String(order._id)}/print`}
                        title="Ticket"
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      >
                        <Printer size={15} />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {orders.length === 0 && (
          <p className="text-center text-muted-foreground py-10 text-sm">
            Aucune commande rattachée à cette recette
          </p>
        )}
      </div>
    </div>
  )
}

/** Every cash-out, cancelled ones included and struck through — nothing is erased. */
function MovementsTable({ movements, totals }: { movements: MovementDoc[]; totals: RecetteTotals }) {
  return (
    <div className="bg-card rounded-xl border overflow-hidden mb-4">
      <div className="px-4 py-3 border-b flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-sm">
          Sorties de caisse <span className="text-muted-foreground font-normal">({movements.length})</span>
        </p>
        <p className="text-xs text-muted-foreground">
          Achats {money(totals.achats)} · Dépenses {money(totals.depenses)} · Solde après sorties{' '}
          <span className="font-semibold text-foreground">{money(totals.solde)}</span>
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-150">
          <thead className="bg-muted/50 border-b">
            <tr>
              {['Heure', 'Type', 'Libellé', 'Note', 'Par', 'Montant'].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {movements.map((m) => {
              const cancelled = Boolean(m.cancelledAt)
              return (
                <tr key={String(m._id)} className={cancelled ? 'text-muted-foreground' : 'hover:bg-muted/50'}>
                  <td className="px-4 py-3">{timeFr(m.createdAt)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${
                        m.kind === 'achat'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
                          : 'bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300'
                      } ${cancelled ? 'opacity-50' : ''}`}
                    >
                      {m.kind === 'achat' ? 'Achat' : 'Dépense'}
                    </span>
                  </td>
                  <td className={`px-4 py-3 font-medium ${cancelled ? 'line-through' : ''}`}>{m.label}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {cancelled
                      ? `Annulée le ${dateFr(m.cancelledAt)} à ${timeFr(m.cancelledAt)}${
                          m.cancelledBy?.name ? ` par ${m.cancelledBy.name}` : ''
                        }`
                      : m.note || '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{m.createdBy?.name || '—'}</td>
                  <td
                    className={`px-4 py-3 font-bold whitespace-nowrap ${
                      cancelled ? 'line-through' : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    − {money(m.amount ?? 0)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  hint,
  accent,
}: {
  label: string
  value: string
  hint?: string
  accent?: boolean
}) {
  return (
    <div className="bg-card rounded-xl border p-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-xl font-black mt-1 ${accent ? 'text-[#F5A800]' : ''}`}>{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-xl border p-3">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-3 pb-1">
        {title}
      </p>
      <dl className="divide-y">{children}</dl>
    </div>
  )
}

function Line({
  label,
  value,
  strong,
  tone,
}: {
  label: string
  value: string
  strong?: boolean
  tone?: 'good' | 'warn' | 'bad'
}) {
  const toneClass =
    tone === 'good'
      ? 'text-green-600 dark:text-green-400'
      : tone === 'warn'
        ? 'text-amber-600 dark:text-amber-400'
        : tone === 'bad'
          ? 'text-red-600 dark:text-red-400'
          : ''
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`${strong ? 'font-black' : 'font-semibold'} ${toneClass || 'text-foreground'}`}>
        {value}
      </dd>
    </div>
  )
}
