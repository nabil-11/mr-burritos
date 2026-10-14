import type { ExportDocument, ExportTable, ExportValue } from './tableExport'
import type { RecetteTotals } from './recette'
import { MOVEMENT_META, isMovementKind } from './movementKinds'
import { ORDER_SOURCES, orderSourceLabel } from './orderSource'
import { DEFAULT_TIME_ZONE } from './reportTime'

/**
 * Les recettes, mises en tableaux pour l'export (PDF, Excel, Word, CSV).
 *
 * Mêmes chiffres, mêmes libellés que les pages `/recettes` : ces fonctions ne
 * calculent rien, elles rangent. Les sorties d'argent sont des nombres
 * négatifs — dans Excel, une colonne s'additionne sans y penser.
 */

// À l'heure du restaurant : le serveur, lui, tourne en UTC.
const TZ = DEFAULT_TIME_ZONE
const dateFr = (d: unknown) => (d ? new Date(d as string).toLocaleDateString('fr-FR', { timeZone: TZ }) : '')
const timeFr = (d: unknown) =>
  d ? new Date(d as string).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: TZ }) : ''
const stamp = (d: unknown) => (d ? `${dateFr(d)} ${timeFr(d)}` : '')
const round2 = (n: number) => Math.round(n * 100) / 100

export interface RecetteListRow {
  number?: string
  status?: string
  openedAt?: Date
  closedAt?: Date | null
  openedBy?: string
  closedBy?: string
  totals: RecetteTotals
  gap: number | null
}

/**
 * La liste des recettes : une ligne par session, comme à l'écran — filtres
 * compris. `filters` les dit en clair dans l'en-tête : un export sans sa
 * période ne veut rien dire.
 */
export function recettesListExport(
  rows: RecetteListRow[],
  { filters, filename }: { filters: string; filename: string }
): ExportDocument {
  const sum = (pick: (r: RecetteListRow) => number) => round2(rows.reduce((s, r) => s + pick(r), 0))
  const counted = rows.filter((r) => r.gap !== null)

  return {
    filename,
    title: 'Recettes',
    subtitle: [
      `${rows.length} session${rows.length > 1 ? 's' : ''} de caisse`,
      `recettes ouvertes ${filters}`,
      rows.some((r) => r.status === 'open') ? 'une recette encore ouverte : chiffres provisoires' : '',
    ]
      .filter(Boolean)
      .join(' · '),
    tables: [
      {
        title: 'Recettes',
        note: "Encaissé : espèces, TPE et plateformes déjà réglées. À recevoir : ce que les plateformes doivent encore. Écart : espèces comptées moins espèces attendues.",
        columns: [
          { label: 'N°' },
          { label: 'Statut' },
          { label: 'Ouverture' },
          { label: 'Ouverte par' },
          { label: 'Clôture' },
          { label: 'Clôturée par' },
          { label: 'Commandes', type: 'number' },
          { label: 'Annulées', type: 'number' },
          { label: "Chiffre d'affaires", type: 'money' },
          { label: 'Espèces', type: 'money' },
          { label: 'TPE', type: 'money' },
          { label: 'Encaissé', type: 'money' },
          { label: 'À recevoir', type: 'money' },
          { label: 'Écart caisse', type: 'money' },
        ],
        rows: rows.map((r) => [
          r.number ?? '',
          r.status === 'open' ? 'Ouverte' : 'Clôturée',
          stamp(r.openedAt),
          r.openedBy ?? '',
          stamp(r.closedAt),
          r.closedBy ?? '',
          r.totals.orders,
          r.totals.cancelled,
          r.totals.revenue,
          r.totals.cashSales,
          r.totals.cardSales,
          r.totals.collected,
          r.totals.receivable,
          r.gap === null ? 'non compté' : r.gap,
        ]),
        foot: [
          'TOTAL', '', '', '', '', '',
          sum((r) => r.totals.orders),
          sum((r) => r.totals.cancelled),
          sum((r) => r.totals.revenue),
          sum((r) => r.totals.cashSales),
          sum((r) => r.totals.cardSales),
          sum((r) => r.totals.collected),
          sum((r) => r.totals.receivable),
          counted.length > 0 ? round2(counted.reduce((s, r) => s + (r.gap ?? 0), 0)) : '',
        ],
      },
    ],
  }
}

export interface RecetteDetailInput {
  recette: {
    number?: string
    status?: string
    openedAt?: Date
    closedAt?: Date | null
    openedBy?: { name?: string }
    closedBy?: { name?: string }
    openingFloat?: number
    closingCash?: number | null
    notes?: string
  }
  totals: RecetteTotals
  gap: number | null
  expectedCash: number
  movements: {
    kind: string
    label: string
    amount: number
    note: string
    createdAt: string
    createdBy: string
    cancelledAt: string | null
    cancelledBy: string
  }[]
  orders: Record<string, unknown>[]
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente', confirmed: 'Confirmée', preparing: 'En préparation',
  ready: 'Prête', delivered: 'Livrée', cancelled: 'Annulée',
}

/** Une recette : sa synthèse, sa caisse, ses plateformes, ses mouvements, ses commandes. */
export function recetteDetailExport({ recette, totals: t, gap, expectedCash, movements, orders }: RecetteDetailInput): ExportDocument {
  const isOpen = recette.status === 'open'
  const kv = (title: string, rows: [string, ExportValue][], note?: string): ExportTable => ({
    title,
    note,
    columns: [{ label: 'Libellé' }, { label: 'Montant', type: 'money' }],
    rows,
  })

  const tables: ExportTable[] = [
    kv('Synthèse', [
      ["Chiffre d'affaires", t.revenue],
      ['Commandes', String(t.orders)],
      ['Commandes annulées', String(t.cancelled)],
      ['Panier moyen', t.orders > 0 ? round2(t.revenue / t.orders) : 0],
      ['Remises accordées', -t.discounts],
      ['Majorations', t.surcharges],
      ['Frais de livraison', t.deliveryFees],
      ['Commissions plateformes', -t.commission],
      ['Net après commissions', t.net],
      ['Achats', -t.achats],
      ['Dépenses', -t.depenses],
      ['Solde du service', t.solde],
    ]),
    kv(
      'Encaissé ou à recevoir',
      [
        ['Encaissé — l’argent est arrivé', t.collected],
        ['  dont espèces (dans le tiroir)', t.cashSales],
        ['  dont TPE (en banque)', t.cardSales],
        ...(t.platformPaid > 0 ? [['  dont plateformes déjà réglées', t.platformPaid] as [string, ExportValue]] : []),
        ['À recevoir — pas encore payé', t.receivable],
        ['  dont plateformes', round2(t.platformDue - t.platformPaid)],
        ['  dont règlement non renseigné', t.unsettled],
      ],
      'Chaque commande tombe dans une seule poche.'
    ),
    kv('Caisse', [
      ["Fond à l'ouverture", recette.openingFloat || 0],
      ['Ventes sur place (espèces)', t.cashSales],
      ...(t.apports > 0 ? [['Ajouts au fond', t.apports] as [string, ExportValue]] : []),
      ...(t.achats > 0 ? [['Achats', -t.achats] as [string, ExportValue]] : []),
      ...(t.depenses > 0 ? [['Dépenses', -t.depenses] as [string, ExportValue]] : []),
      ...(t.retraits > 0 ? [['Retraits', -t.retraits] as [string, ExportValue]] : []),
      [isOpen ? 'Espèces dans le tiroir' : 'Espèces attendues', expectedCash],
      ['Espèces comptées', typeof recette.closingCash === 'number' ? recette.closingCash : 'non compté'],
      ['Écart', gap === null ? '—' : gap],
    ]),
    {
      title: 'Répartition',
      columns: [{ label: 'Catégorie' }, { label: 'Commandes', type: 'number' }, { label: "Chiffre d'affaires", type: 'money' }],
      rows: [
        ['Livraison', t.byType.delivery.count, t.byType.delivery.revenue],
        ['À emporter', t.byType.pickup.count, t.byType.pickup.revenue],
        ...[...ORDER_SOURCES, 'unknown' as const]
          .filter((k) => (t.bySource?.[k]?.count ?? 0) > 0)
          .map((k): ExportValue[] => [
            `Origine : ${orderSourceLabel(k, 'inconnue')}`,
            t.bySource[k].count,
            t.bySource[k].revenue,
          ]),
      ],
    },
  ]

  if (t.byCompany.length > 0) {
    const sum = (pick: (c: RecetteTotals['byCompany'][number]) => number) =>
      round2(t.byCompany.reduce((s, c) => s + pick(c), 0))
    tables.push({
      title: 'Plateformes de livraison',
      note: 'Net : ce que le restaurant garde. À recevoir : ce que la plateforme doit encore verser.',
      columns: [
        { label: 'Plateforme' },
        { label: 'Commandes', type: 'number' },
        { label: 'CA brut', type: 'money' },
        { label: 'Taux %', type: 'number' },
        { label: 'Commission', type: 'money' },
        { label: 'Net', type: 'money' },
        { label: 'Espèces au comptoir', type: 'money' },
        { label: 'Réglé', type: 'money' },
        { label: 'À recevoir', type: 'money' },
      ],
      rows: t.byCompany.map((c) => [
        c.name, c.count, c.revenue, c.rate, -c.commission, c.net, c.cash, c.settled ?? 0, round2(c.due - (c.settled ?? 0)),
      ]),
      foot: [
        'TOTAL', sum((c) => c.count), sum((c) => c.revenue), null, -sum((c) => c.commission), sum((c) => c.net),
        sum((c) => c.cash), sum((c) => c.settled ?? 0), sum((c) => c.due - (c.settled ?? 0)),
      ],
    })
  }

  if (movements.length > 0) {
    const live = movements.filter((m) => !m.cancelledAt)
    const signed = (m: (typeof movements)[number]) =>
      isMovementKind(m.kind) ? MOVEMENT_META[m.kind].sign * m.amount : m.amount
    tables.push({
      title: 'Mouvements de caisse',
      note: 'Achats et dépenses coûtent ; ajouts et retraits déplacent seulement l’argent. Les lignes annulées sont hors du total.',
      columns: [
        { label: 'Heure' },
        { label: 'Type' },
        { label: 'Libellé' },
        { label: 'Note' },
        { label: 'Par' },
        { label: 'Montant', type: 'money' },
        { label: 'Annulé' },
      ],
      rows: movements.map((m) => [
        stamp(m.createdAt),
        isMovementKind(m.kind) ? MOVEMENT_META[m.kind].label : m.kind,
        m.label,
        m.note,
        m.createdBy,
        signed(m),
        m.cancelledAt ? `le ${stamp(m.cancelledAt)}${m.cancelledBy ? ` par ${m.cancelledBy}` : ''}` : '',
      ]),
      foot: ['TOTAL', '', '', '', '', round2(live.reduce((s, m) => s + signed(m), 0)), ''],
    })
  }

  const kept = orders.filter((o) => o.status !== 'cancelled')
  tables.push({
    title: 'Commandes',
    columns: [
      { label: 'N° commande' },
      { label: 'Heure' },
      { label: 'Client' },
      { label: 'Type' },
      { label: 'Origine' },
      { label: 'Statut' },
      { label: 'Total', type: 'money' },
    ],
    rows: orders.map((o) => {
      const status = String(o.status ?? '')
      return [
        String(o.orderNumber ?? ''),
        timeFr(o.createdAt),
        String((o.customer as { name?: string } | undefined)?.name ?? ''),
        o.type === 'delivery' ? 'Livraison' : 'À emporter',
        orderSourceLabel(o.source),
        STATUS_LABELS[status] ?? status,
        Number(o.total ?? 0),
      ]
    }),
    foot: [`TOTAL hors annulées (${kept.length})`, '', '', '', '', '', round2(kept.reduce((s, o) => s + Number(o.total ?? 0), 0))],
  })

  if (recette.notes) {
    tables.push({ title: 'Note', columns: [{ label: 'Note' }], rows: [[recette.notes]] })
  }

  const opened = `Ouverte le ${dateFr(recette.openedAt)} à ${timeFr(recette.openedAt)}${recette.openedBy?.name ? ` par ${recette.openedBy.name}` : ''}`
  const closed = recette.closedAt
    ? `clôturée le ${dateFr(recette.closedAt)} à ${timeFr(recette.closedAt)}${recette.closedBy?.name ? ` par ${recette.closedBy.name}` : ''}`
    : 'encore ouverte — chiffres provisoires'

  return {
    filename: `recette_${recette.number ?? 'sans-numero'}`,
    title: `Recette ${recette.number ?? ''}`.trim(),
    subtitle: `${opened} · ${closed}`,
    tables,
  }
}
