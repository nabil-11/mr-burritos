import Link from 'next/link'
import { connectDB } from '@/lib/mongodb'
import { Recette } from '@/lib/models/Recette'
import { cashDifference, recetteTotals, type RecetteTotals } from '@/lib/recette'
import { recettesListExport } from '@/lib/recetteExport'
import { DEFAULT_TIME_ZONE, dayOf, nextDay, startOfDay } from '@/lib/reportTime'
import ExportButtons from '@/components/backoffice/ExportButtons'
import RecettesFilters from './RecettesFilters'
import { DEFAULT_PERIOD, filtersText, filtersToQuery, isRefined, parseFilters, periodText, type GapFilter } from './filters'

/**
 * Les sessions de caisse, filtrées par période, statut, écart, caissier.
 *
 * La période et les filtres simples (statut, caissier, numéro) partent dans la
 * requête Mongo ; l'écart, lui, se calcule — une recette ouverte n'a pas de
 * total figé —, il se filtre donc après coup, sur des lignes déjà bornées.
 *
 * La session ouverte est calculée à la volée (elle bouge encore), les autres
 * affichent le total figé à la clôture. Le bandeau de la caisse ouverte reste
 * affiché quels que soient les filtres : c'est l'état du restaurant, pas un
 * résultat de recherche.
 *
 * Le chiffre d'affaires d'une journée ne dit pas où est l'argent : les deux
 * colonnes qui suivent le disent — ce qui est passé par le tiroir, et ce que
 * les plateformes doivent encore.
 */

// Deux services par jour sur plus de huit mois. Au-delà, la page le dit.
const MAX_ROWS = 500
const TZ = DEFAULT_TIME_ZONE

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
  totals?: RecetteTotals | null
}

type Row = { doc: Doc; totals: RecetteTotals; gap: number | null }

const dateFr = (d: unknown) => (d ? new Date(d as string).toLocaleDateString('fr-FR', { timeZone: TZ }) : '')
const timeFr = (d: unknown) =>
  d ? new Date(d as string).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: TZ }) : ''
const money = (n: number) => `${(n || 0).toFixed(2)} DT`
const signed = (n: number) => `${n > 0.004 ? '+' : ''}${n.toFixed(2)} DT`
const round2 = (n: number) => Math.round(n * 100) / 100
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Vert si juste, ambre si excédent, rouge si manquant. */
const gapTone = (gap: number) =>
  Math.abs(gap) < 0.005
    ? 'text-green-600 dark:text-green-400'
    : gap > 0
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-red-600 dark:text-red-400'

/**
 * Une recette encore ouverte n'a pas été comptée : elle n'est ni « non
 * comptée » ni « à vérifier » — seulement pas finie.
 */
function matchesGap(row: Row, filter: GapFilter): boolean {
  const { gap } = row
  const closed = row.doc.status !== 'open'
  switch (filter) {
    case 'balanced':
      return gap !== null && Math.abs(gap) < 0.005
    case 'short':
      return gap !== null && gap <= -0.005
    case 'over':
      return gap !== null && gap >= 0.005
    case 'uncounted':
      return closed && gap === null
    case 'issue':
      return closed && (gap === null || Math.abs(gap) >= 0.005)
    default:
      return true
  }
}

export default async function RecettesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await connectDB()
  const today = dayOf(new Date(), TZ)
  const filters = parseFilters(await searchParams, today)

  // Une recette appartient au jour de son ouverture, à l'heure du restaurant.
  const period: Record<string, unknown> =
    filters.from && filters.to
      ? { openedAt: { $gte: startOfDay(filters.from, TZ), $lt: startOfDay(nextDay(filters.to), TZ) } }
      : {}
  const query: Record<string, unknown> = { ...period }
  if (filters.status !== 'all') query.status = filters.status
  if (filters.q) query.number = { $regex: escapeRegex(filters.q), $options: 'i' }
  if (filters.cashier) query.$or = [{ 'openedBy.name': filters.cashier }, { 'closedBy.name': filters.cashier }]

  const [docs, matching, openers, closers, openDoc] = await Promise.all([
    Recette.find(query).sort({ openedAt: -1 }).limit(MAX_ROWS).lean() as Promise<Doc[]>,
    Recette.countDocuments(query),
    // Les caissiers de la période, pour le menu — pas ceux de toute l'histoire.
    Recette.distinct('openedBy.name', period) as Promise<string[]>,
    Recette.distinct('closedBy.name', period) as Promise<string[]>,
    Recette.findOne({ status: 'open' }).lean() as Promise<Doc | null>,
  ])
  const truncated = matching > docs.length
  const touched = filters.period !== DEFAULT_PERIOD || isRefined(filters)

  const all: Row[] = await Promise.all(
    docs.map(async (doc) => {
      const totals = await recetteTotals(doc)
      return { doc, totals, gap: cashDifference(doc, totals) }
    })
  )
  const rows = all.filter((r) => matchesGap(r, filters.gap))
  if (filters.sort === 'oldest') rows.reverse()
  else if (filters.sort === 'revenue') rows.sort((a, b) => b.totals.revenue - a.totals.revenue)
  else if (filters.sort === 'gap') {
    // Les non comptées en dernier : on cherche d'abord les tiroirs qui ne tombent pas juste.
    const size = (r: Row) => (r.gap === null ? -1 : Math.abs(r.gap))
    rows.sort((a, b) => size(b) - size(a))
  }

  const open = openDoc
    ? all.find((r) => String(r.doc._id) === String(openDoc._id))?.totals ?? (await recetteTotals(openDoc))
    : null

  const cashiers = [...new Set([...openers, ...closers].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'))

  // ── Les totaux de ce qui est affiché ───────────────────────────
  const sum = (pick: (t: RecetteTotals) => number) => round2(rows.reduce((s, r) => s + pick(r.totals), 0))
  const counted = rows.filter((r) => r.gap !== null)
  const closedCount = rows.filter((r) => r.doc.status !== 'open').length
  const ecart = round2(counted.reduce((s, r) => s + (r.gap ?? 0), 0))
  const shortRows = counted.filter((r) => (r.gap ?? 0) <= -0.005)
  const summary = {
    orders: sum((t) => t.orders),
    revenue: sum((t) => t.revenue),
    net: sum((t) => t.net),
    cashSales: sum((t) => t.cashSales),
    cardSales: sum((t) => t.cardSales),
    collected: sum((t) => t.collected),
    receivable: sum((t) => t.receivable),
  }

  const exportDoc = recettesListExport(
    rows.map(({ doc, totals, gap }) => ({
      number: doc.number,
      status: doc.status,
      openedAt: doc.openedAt,
      closedAt: doc.closedAt,
      openedBy: doc.openedBy?.name,
      closedBy: doc.closedBy?.name,
      totals,
      gap,
    })),
    {
      filters: filtersText(filters),
      filename: `recettes_${filters.from ?? 'debut'}_${filters.to ?? today}`,
    }
  )

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold">Recettes</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Sessions de caisse — chaque commande est rattachée à la recette ouverte au moment où
            elle est prise.
          </p>
        </div>
        <ExportButtons doc={exportDoc} />
      </div>

      {openDoc && open ? (
        <div className="mb-4 rounded-xl border border-[#F5A800]/40 bg-[#F5A800]/10 px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-1">
          <span className="flex items-center gap-2 text-sm font-bold">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            Caisse ouverte — {openDoc.number}
          </span>
          <span className="text-sm text-muted-foreground">
            depuis {timeFr(openDoc.openedAt)} · {open.orders} commande
            {open.orders > 1 ? 's' : ''} · <b className="text-foreground">{money(open.revenue)}</b>
          </span>
          <Link
            href={`/recettes/${String(openDoc._id)}`}
            className="text-sm font-semibold text-[#F5A800] hover:underline ml-auto"
          >
            Voir le détail →
          </Link>
        </div>
      ) : (
        <p className="mb-4 rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground">
          Aucune caisse ouverte. Utilisez <b className="text-foreground">Ouvrir la caisse</b> dans la
          barre latérale — les commandes prises en attendant ne seront rattachées à aucune recette.
        </p>
      )}

      {/* La clé remonte la barre à chaque nouvelle URL : ses champs repartent de l'URL. */}
      <RecettesFilters key={filtersToQuery(filters)} filters={filters} cashiers={cashiers} today={today} />

      {/* ── Ce que donnent ces filtres ────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 mb-4">
        <Stat
          label="Recettes"
          value={String(rows.length)}
          hint={`${summary.orders} commande${summary.orders > 1 ? 's' : ''} · ${periodText(filters)}`}
        />
        <Stat
          label="Chiffre d'affaires"
          value={money(summary.revenue)}
          hint={`Net ${money(summary.net)} · panier ${money(summary.orders > 0 ? summary.revenue / summary.orders : 0)}`}
          tone="text-[#F5A800]"
        />
        <Stat
          label="Encaissé"
          value={money(summary.collected)}
          hint={`Espèces ${money(summary.cashSales)} · TPE ${money(summary.cardSales)}`}
          tone="text-emerald-600 dark:text-emerald-400"
        />
        <Stat
          label="À recevoir"
          value={money(summary.receivable)}
          hint="plateformes et règlements non notés"
          tone={summary.receivable > 0 ? 'text-amber-600 dark:text-amber-400' : undefined}
        />
        <Stat
          label="Écart de caisse"
          value={counted.length > 0 ? signed(ecart) : '—'}
          hint={
            counted.length > 0
              ? `${counted.length}/${closedCount} comptées${shortRows.length > 0 ? ` · ${shortRows.length} manquant${shortRows.length > 1 ? 's' : ''}` : ''}`
              : 'aucun tiroir compté'
          }
          tone={counted.length > 0 ? gapTone(ecart) : undefined}
        />
      </div>

      {truncated && (
        <p className="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
          {matching} recettes correspondent — seules les {MAX_ROWS} plus récentes sont lues, et les totaux
          ci-dessus ne portent que sur elles. Resserrez la période pour tout voir.
        </p>
      )}

      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-250 whitespace-nowrap">
            <thead className="bg-muted/50 border-b">
              <tr>
                {['N°', 'Ouverture', 'Clôture', 'Commandes', 'Chiffre d’affaires', 'Espèces', 'TPE', 'Encaissé', 'À recevoir', 'Écart caisse', 'Statut'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map(({ doc, totals, gap }) => (
                <tr key={String(doc._id)} className="hover:bg-muted/50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/recettes/${String(doc._id)}`}
                      className="font-bold text-foreground hover:text-[#F5A800] transition-colors"
                    >
                      {doc.number}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <p>{dateFr(doc.openedAt)} à {timeFr(doc.openedAt)}</p>
                    {doc.openedBy?.name && (
                      <p className="text-xs text-muted-foreground">{doc.openedBy.name}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {doc.closedAt ? (
                      <>
                        <p>{dateFr(doc.closedAt)} à {timeFr(doc.closedAt)}</p>
                        {doc.closedBy?.name && (
                          <p className="text-xs text-muted-foreground">{doc.closedBy.name}</p>
                        )}
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {totals.orders}
                    {totals.cancelled > 0 && (
                      <span className="text-xs text-muted-foreground"> · {totals.cancelled} annulée{totals.cancelled > 1 ? 's' : ''}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-bold">{money(totals.revenue)}</td>
                  <td className="px-4 py-3">{money(totals.cashSales)}</td>
                  {/* Payé, mais jamais passé par le tiroir. */}
                  <td className="px-4 py-3">{money(totals.cardSales)}</td>
                  {/* Les deux colonnes de la fin de journée : ce qui est arrivé,
                      et ce qu'il reste à aller chercher. */}
                  <td className="px-4 py-3 font-semibold text-emerald-600 dark:text-emerald-400">
                    {money(totals.collected)}
                  </td>
                  <td className="px-4 py-3">
                    {totals.receivable > 0 ? (
                      <span className="font-semibold text-amber-600 dark:text-amber-400">
                        {money(totals.receivable)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {gap === null ? (
                      <span className="text-muted-foreground">{doc.status === 'open' ? 'en cours' : 'non compté'}</span>
                    ) : (
                      <span className={`font-semibold ${gapTone(gap)}`}>{signed(gap)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${
                        doc.status === 'open'
                          ? 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {doc.status === 'open' ? 'Ouverte' : 'Clôturée'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            {rows.length > 1 && (
              <tfoot className="border-t-2 bg-muted/50 font-bold">
                <tr>
                  <td className="px-4 py-3" colSpan={3}>
                    TOTAL · {rows.length} recettes
                  </td>
                  <td className="px-4 py-3">{summary.orders}</td>
                  <td className="px-4 py-3">{money(summary.revenue)}</td>
                  <td className="px-4 py-3">{money(summary.cashSales)}</td>
                  <td className="px-4 py-3">{money(summary.cardSales)}</td>
                  <td className="px-4 py-3 text-emerald-600 dark:text-emerald-400">{money(summary.collected)}</td>
                  <td className="px-4 py-3 text-amber-600 dark:text-amber-400">
                    {summary.receivable > 0 ? money(summary.receivable) : '—'}
                  </td>
                  <td className={`px-4 py-3 ${counted.length > 0 ? gapTone(ecart) : 'text-muted-foreground'}`}>
                    {counted.length > 0 ? signed(ecart) : '—'}
                  </td>
                  <td className="px-4 py-3" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        {rows.length === 0 && (
          <div className="py-10 text-center text-sm text-muted-foreground">
            <p>
              {touched
                ? `Aucune recette ne correspond à ces filtres — ${filtersText(filters)}.`
                : `Aucune recette ${periodText(filters)}.`}
            </p>
            <Link
              href={touched ? '/recettes' : '/recettes?period=all'}
              className="mt-2 inline-block font-semibold text-[#F5A800] hover:underline"
            >
              {touched ? 'Réinitialiser les filtres' : 'Voir toutes les recettes'}
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="bg-card rounded-xl border p-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-xl font-black mt-1 tabular-nums ${tone ?? ''}`}>{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{hint}</p>}
    </div>
  )
}
