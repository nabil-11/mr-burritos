import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Printer } from 'lucide-react'
import { connectDB } from '@/lib/mongodb'
import { Recette } from '@/lib/models/Recette'
import { cashDifference, cashInDrawer, recetteOrders, recetteTotals, type RecetteTotals } from '@/lib/recette'
import { ORDER_SOURCES, orderSourceIcon, orderSourceLabel } from '@/lib/orderSource'
import RecetteMovements, { type MovementView } from '@/components/backoffice/RecetteMovements'

/**
 * Le détail d'une session de caisse : les chiffres, les mouvements d'espèces
 * (achats et dépenses payés depuis le tiroir, ajouts au fond, retraits), puis
 * les commandes.
 *
 * Une session clôturée affiche le total figé au moment de la clôture ; une
 * session encore ouverte est recalculée à chaque affichage — et peut encore
 * recevoir des mouvements, d'où le panneau interactif plus bas.
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
  const expectedCash = cashInDrawer(recette, totals)

  // Les dates deviennent des chaînes : un composant client ne reçoit pas de
  // Date, et surtout pas un ObjectId.
  const movements: MovementView[] = (recette.mouvements ?? []).map((m) => ({
    _id: String(m._id),
    kind: String(m.kind ?? ''),
    label: m.label ?? '',
    amount: Number(m.amount ?? 0),
    note: m.note ?? '',
    createdAt: m.createdAt ? new Date(m.createdAt).toISOString() : '',
    createdBy: m.createdBy?.name ?? '',
    cancelledAt: m.cancelledAt ? new Date(m.cancelledAt).toISOString() : null,
    cancelledBy: m.cancelledBy?.name ?? '',
  }))

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
        <Stat
          label="Net (après commissions)"
          value={money(totals.net)}
          hint={totals.commission > 0 ? `− ${money(totals.commission)} de commissions` : undefined}
        />
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

      {/* ── Où est l'argent ? ─────────────────────────────────────
           La question de fin de journée. Le chiffre d'affaires est une somme ;
           celle-ci dit dans quelle poche elle se trouve, et laquelle il reste
           à aller chercher. */}
      <div className="mb-2 flex items-baseline gap-3">
        <h2 className="text-sm font-bold">Où est l&apos;argent&nbsp;?</h2>
        <p className="text-xs text-muted-foreground">
          Chaque commande tombe dans une seule poche
        </p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Stat
          label="Espèces"
          value={money(totals.cashSales)}
          hint={`dans le tiroir : ${money(expectedCash)}`}
          tone="text-emerald-600 dark:text-emerald-400"
        />
        <Stat
          label="Carte"
          value={money(totals.cardSales)}
          hint="versé en banque"
          tone="text-sky-600 dark:text-sky-400"
        />
        <Stat
          label="Plateformes"
          value={money(totals.platformDue)}
          hint={
            totals.commission > 0
              ? `à recevoir · ${money(totals.commission)} de commission déduits`
              : 'à recevoir'
          }
          tone="text-violet-600 dark:text-violet-400"
        />
        <Stat
          label="Non renseigné"
          value={money(totals.unsettled)}
          hint={
            totals.unsettled > 0
              ? 'règlement non enregistré à la caisse'
              : 'tout est réparti'
          }
          tone={totals.unsettled > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
        {/* ── Caisse ──────────────────────────────────────────── */}
        <Card title="Caisse">
          <Line label="Fond à l'ouverture" value={money(recette.openingFloat || 0)} />
          <Line label="Ventes sur place" value={`+ ${money(totals.cashSales)}`} />
          {totals.apports > 0 && (
            <Line label="Ajouts au fond" value={`+ ${money(totals.apports)}`} tone="good" />
          )}
          {totals.achats > 0 && <Line label="Achats" value={`− ${money(totals.achats)}`} />}
          {totals.depenses > 0 && <Line label="Dépenses" value={`− ${money(totals.depenses)}`} />}
          {totals.retraits > 0 && <Line label="Retraits" value={`− ${money(totals.retraits)}`} />}
          <Line label={isOpen ? 'Espèces dans le tiroir' : 'Espèces attendues'} value={money(expectedCash)} strong />
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
            Les ventes sur place regroupent la caisse et la borne, hors plateformes de livraison.
            S&apos;y ajoute ce qui a été remis dans le tiroir en cours de service, et s&apos;en
            déduit tout ce qui en est sorti — achats, dépenses, retraits.
          </p>
        </Card>

        {/* ── Détail des montants ─────────────────────────────── */}
        <Card title="Montants">
          <Line label="Remises accordées" value={`− ${money(totals.discounts)}`} />
          <Line label="Majorations" value={`+ ${money(totals.surcharges)}`} />
          <Line label="Frais de livraison" value={money(totals.deliveryFees)} />
          <Line label="Commissions plateformes" value={`− ${money(totals.commission)}`} />
          <Line label="Net encaissé" value={money(totals.net)} strong />
          {(totals.achats > 0 || totals.depenses > 0) && (
            <>
              <Line label="Achats et dépenses" value={`− ${money(totals.achats + totals.depenses)}`} />
              {/* Un ajout au fond n'apparaît pas ici : il remplit le tiroir,
                  il ne gagne rien. */}
              <Line label="Solde du service" value={money(totals.solde)} strong />
            </>
          )}
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

      {/* ── Plateformes de livraison ──────────────────────────── */}
      {totals.byCompany.length > 0 ? (
        <CompaniesTable companies={totals.byCompany} />
      ) : (
        totals.commission > 0 && (
          <p className="mb-4 rounded-xl border bg-card px-4 py-3 text-xs text-muted-foreground">
            Cette recette a été clôturée avant que le détail par plateforme ne soit enregistré —
            seul le total des commissions ({money(totals.commission)}) en a été gardé.
          </p>
        )
      )}

      {/* ── Mouvements de caisse ──────────────────────────────── */}
      {(isOpen || movements.length > 0) && (
        <RecetteMovements
          recetteId={String(recette._id)}
          isOpen={isOpen}
          movements={movements}
          cashInDrawer={expectedCash}
          summary={{
            achats: totals.achats,
            depenses: totals.depenses,
            apports: totals.apports,
            retraits: totals.retraits,
            solde: totals.solde,
          }}
        />
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

/**
 * Une plateforme, une ligne, et le total en pied de tableau : « Glovo, 12
 * commandes, 500 DT » est la phrase que le gérant vient chercher le soir.
 *
 * Le brut n'est pas ce qu'il touchera — la colonne qui compte est la dernière.
 */
function CompaniesTable({ companies }: { companies: RecetteTotals['byCompany'] }) {
  const sum = (pick: (c: RecetteTotals['byCompany'][number]) => number) =>
    companies.reduce((s, c) => s + pick(c), 0)
  const cash = sum((c) => c.cash)
  // Tant qu'aucun livreur n'a payé au comptoir, « net » et « à recevoir » sont
  // le même nombre : une colonne de plus ne dirait rien de neuf.
  const columns = cash > 0
    ? ['Plateforme', 'Commandes', 'CA brut', 'Commission', 'Net', 'À recevoir']
    : ['Plateforme', 'Commandes', 'CA brut', 'Commission', 'À recevoir']

  return (
    <div className="bg-card rounded-xl border overflow-hidden mb-4">
      <div className="px-4 py-3 border-b">
        <p className="font-semibold text-sm">
          Plateformes de livraison{' '}
          <span className="text-muted-foreground font-normal">({companies.length})</span>
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Ce que chaque plateforme a apporté sur cette session, et ce qu&apos;elle doit reverser.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-150">
          <thead className="bg-muted/50 border-b">
            <tr>
              {columns.map((h, i) => (
                <th
                  key={h}
                  className={`px-4 py-3 font-medium text-muted-foreground ${i === 0 ? 'text-left' : 'text-right'}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {companies.map((c) => (
              <tr key={c.name} className="hover:bg-muted/50">
                <td className="px-4 py-3 font-semibold">
                  🛵 {c.name}
                  {c.cash > 0 && (
                    <span className="block text-[11px] font-normal text-muted-foreground">
                      dont {money(c.cash)} encaissés en espèces
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-muted-foreground">{c.count}</td>
                <td className="px-4 py-3 text-right font-semibold">{money(c.revenue)}</td>
                <td className="px-4 py-3 text-right">
                  <span className="text-xs font-bold text-red-600 dark:text-red-400">
                    − {money(c.commission)}
                    {c.rate !== null && ` (${c.rate}%)`}
                  </span>
                </td>
                {cash > 0 && (
                  <td className="px-4 py-3 text-right font-semibold">{money(c.net)}</td>
                )}
                <td className="px-4 py-3 text-right font-black text-violet-600 dark:text-violet-400">
                  {money(c.due)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 bg-muted/50">
            <tr>
              <td className="px-4 py-3 font-black">TOTAL</td>
              <td className="px-4 py-3 text-right font-bold">{sum((c) => c.count)}</td>
              <td className="px-4 py-3 text-right font-bold">{money(sum((c) => c.revenue))}</td>
              <td className="px-4 py-3 text-right font-bold text-red-600 dark:text-red-400">
                − {money(sum((c) => c.commission))}
              </td>
              {cash > 0 && (
                <td className="px-4 py-3 text-right font-bold">{money(sum((c) => c.net))}</td>
              )}
              <td className="px-4 py-3 text-right font-black text-violet-600 dark:text-violet-400">
                {money(sum((c) => c.due))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="px-4 py-2.5 border-t text-[11px] text-muted-foreground leading-snug">
        <b className="text-foreground">Net</b> est ce que le restaurant garde sur ces commandes ;{' '}
        <b className="text-foreground">à recevoir</b> est ce que la plateforme doit encore verser.
        {cash > 0 && (
          <>
            {' '}
            {/* Le blanc est explicite : JSX mange celui qui suit une expression. */}
            Les {money(cash)}{' '}
            encaissés en espèces sont déjà dans le tiroir — ils ne sont donc pas attendus une
            seconde fois, et sur ceux-là c&apos;est la commission qui reste due à la plateforme.
          </>
        )}
      </p>
    </div>
  )
}

function Stat({
  label,
  value,
  hint,
  accent,
  tone,
}: {
  label: string
  value: string
  hint?: string
  accent?: boolean
  tone?: string
}) {
  return (
    <div className="bg-card rounded-xl border p-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-xl font-black mt-1 ${tone ?? (accent ? 'text-[#F5A800]' : '')}`}>{value}</p>
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
