import Link from 'next/link'
import { connectDB } from '@/lib/mongodb'
import { Recette } from '@/lib/models/Recette'
import { cashDifference, recetteTotals, type RecetteTotals } from '@/lib/recette'

/**
 * Les sessions de caisse, de la plus récente à la plus ancienne.
 *
 * La session ouverte est calculée à la volée (elle bouge encore), les autres
 * affichent le total figé à la clôture.
 *
 * Le chiffre d'affaires d'une journée ne dit pas où est l'argent : les deux
 * colonnes qui suivent le disent — ce qui est passé par le tiroir, et ce que
 * les plateformes doivent encore.
 */

// Une session par service : deux ans de caisse tiennent largement là-dedans.
const MAX_ROWS = 200

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

const dateFr = (d: unknown) => (d ? new Date(d as string).toLocaleDateString('fr-FR') : '')
const timeFr = (d: unknown) =>
  d ? new Date(d as string).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''
const money = (n: number) => `${(n || 0).toFixed(2)} DT`

export default async function RecettesPage() {
  await connectDB()
  const docs = (await Recette.find().sort({ openedAt: -1 }).limit(MAX_ROWS).lean()) as Doc[]

  const rows = await Promise.all(
    docs.map(async (r) => {
      const totals = await recetteTotals(r)
      return { doc: r, totals, gap: cashDifference(r, totals) }
    })
  )

  const open = rows.find((r) => r.doc.status === 'open')

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold">Recettes</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Sessions de caisse — chaque commande est rattachée à la recette ouverte au moment où
            elle est prise.
          </p>
        </div>
      </div>

      {open ? (
        <div className="mb-4 rounded-xl border border-[#F5A800]/40 bg-[#F5A800]/10 px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-1">
          <span className="flex items-center gap-2 text-sm font-bold">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            Caisse ouverte — {open.doc.number}
          </span>
          <span className="text-sm text-muted-foreground">
            depuis {timeFr(open.doc.openedAt)} · {open.totals.orders} commande
            {open.totals.orders > 1 ? 's' : ''} · <b className="text-foreground">{money(open.totals.revenue)}</b>
          </span>
          <Link
            href={`/recettes/${String(open.doc._id)}`}
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

      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-250">
            <thead className="bg-muted/50 border-b">
              <tr>
                {['N°', 'Ouverture', 'Clôture', 'Commandes', 'Chiffre d’affaires', 'Espèces', 'Plateformes', 'Net', 'Écart caisse', 'Statut'].map((h) => (
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
                  {/* Ce que les plateformes doivent encore pour cette journée. */}
                  <td className="px-4 py-3">
                    {totals.platformDue > 0 ? (
                      <span className="font-semibold text-violet-600 dark:text-violet-400">
                        {money(totals.platformDue)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{money(totals.net)}</td>
                  <td className="px-4 py-3">
                    {gap === null ? (
                      <span className="text-muted-foreground">non compté</span>
                    ) : (
                      <span
                        className={`font-semibold ${
                          Math.abs(gap) < 0.005
                            ? 'text-green-600 dark:text-green-400'
                            : gap > 0
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {gap > 0 ? '+' : ''}{gap.toFixed(2)} DT
                      </span>
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
          </table>
        </div>
        {rows.length === 0 && (
          <p className="text-center text-muted-foreground py-10 text-sm">Aucune recette pour l’instant</p>
        )}
      </div>
    </div>
  )
}
