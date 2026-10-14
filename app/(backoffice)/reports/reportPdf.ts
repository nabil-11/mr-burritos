import type { jsPDF } from 'jspdf'
import type { RowInput, UserOptions } from 'jspdf-autotable'
import { MOVEMENT_LIST } from '@/lib/movementKinds'
import { ORDER_SOURCE_LABELS, type OrderSource } from '@/lib/orderSource'
import type { RecetteReport } from '@/lib/recetteReport'

/**
 * Le rapport des recettes en PDF — le document qu'on envoie au comptable.
 *
 * Les mêmes chiffres que l'écran et que l'export CSV, tels que le serveur les
 * a calculés : rien n'est refait ici. La première page tient la synthèse ; les
 * tableaux suivent, une ligne par recette, par jour, par plateforme.
 *
 * Un vrai PDF, fait de texte et de tableaux — pas une capture de l'écran : il
 * se cherche, se copie, et s'imprime net. Les deux bibliothèques ne sont
 * chargées qu'au moment du clic : la page des rapports ne les porte pas.
 *
 * A4 paysage : le tableau des recettes a douze colonnes.
 */

const ACCENT: [number, number, number] = [245, 168, 0]
const INK: [number, number, number] = [26, 26, 26]
const MUTED: [number, number, number] = [110, 110, 110]
const MARGIN = 12

// Helvetica, la police intégrée du PDF, ne connaît ni l'espace fine ni le vrai
// signe moins : les montants s'écrivent donc avec un point et un trait d'union.
const num = (n: number) => (Number(n) || 0).toFixed(2)
const money = (n: number) => `${num(n)} DT`
const minus = (n: number) => (n > 0.004 ? `- ${money(n)}` : money(0))
const signed = (n: number | null) =>
  n === null ? '—' : Math.abs(n) < 0.005 ? 'juste' : `${n > 0 ? '+' : '-'} ${money(Math.abs(n))}`
const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`

const dayFr = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })
const stamp = (iso: string | null) =>
  iso
    ? `${new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} ${new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
    : '—'
const duration = (min: number | null) => (min === null ? '' : `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`)

const SOURCES: (OrderSource | 'unknown')[] = ['counter', 'website', 'kiosk', 'unknown']

/** Les alertes de l'écran, en phrases : ce qu'il faut lire avant les chiffres. */
function warnings(r: RecetteReport): string[] {
  const out: string[] = []
  if (r.orphans.count > 0) {
    out.push(
      `${plural(r.orphans.count, 'commande')} hors recette (${money(r.orphans.revenue)}) : prises caisse fermée, elles ne figurent dans aucun tiroir ni dans ce rapport.`
    )
  }
  if (r.truncated) out.push('Période trop chargée : seules les premières recettes ont été lues.')
  if (r.caisse.uncounted > 0) {
    out.push(`${plural(r.caisse.uncounted, 'recette')} clôturée${r.caisse.uncounted > 1 ? 's' : ''} sans comptage des espèces : écart inconnu.`)
  }
  if (r.summary.open > 0) out.push('Une recette est encore ouverte : ses chiffres sont provisoires.')
  return out
}

export async function downloadReportPdf(r: RecetteReport): Promise<void> {
  const [{ jsPDF: PDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc: jsPDF = new PDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const s = r.summary
  const c = r.caisse
  const period = r.period.from === r.period.to ? `Le ${dayFr(r.period.from)}` : `Du ${dayFr(r.period.from)} au ${dayFr(r.period.to)}`

  /** Où le prochain bloc commence. */
  let y = MARGIN
  const lastY = () => (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y

  const table = (options: UserOptions) => {
    autoTable(doc, {
      theme: 'grid',
      margin: { left: MARGIN, right: MARGIN, bottom: 14 },
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.6, textColor: INK, lineColor: [215, 215, 215], lineWidth: 0.1 },
      headStyles: { fillColor: INK, textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
      footStyles: { fillColor: [240, 240, 240], textColor: INK, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      ...options,
    })
    y = lastY() + 7
  }

  /** Un titre de section — sur une nouvelle page s'il n'y a plus la place d'un tableau dessous. */
  const heading = (title: string, hint = '') => {
    if (y > pageH - 40) {
      doc.addPage()
      y = MARGIN
    }
    doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...INK)
    doc.text(title, MARGIN, y + 3)
    if (hint) {
      doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...MUTED)
      doc.text(hint, MARGIN + doc.getTextWidth(title) * (11 / 8) + 4, y + 3)
    }
    y += 6
  }

  // ── En-tête ──────────────────────────────────────────────────────────────
  doc.setFillColor(...ACCENT).rect(0, 0, pageW, 3, 'F')
  doc.setFont('helvetica', 'bold').setFontSize(18).setTextColor(...INK)
  doc.text('MR. BURRITOS', MARGIN, y + 8)
  doc.setFontSize(12)
  doc.text('Rapport des recettes', pageW - MARGIN, y + 5, { align: 'right' })
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...MUTED)
  doc.text(period, pageW - MARGIN, y + 10, { align: 'right' })
  doc.text(
    `${plural(s.sessions, 'recette')} · ${plural(s.orders, 'commande')} · une recette compte pour le jour de son ouverture`,
    MARGIN,
    y + 13
  )
  y += 19

  // ── Alertes ──────────────────────────────────────────────────────────────
  const alerts = warnings(r)
  if (alerts.length) {
    table({
      theme: 'plain',
      body: alerts.map((text) => [`!  ${text}`]),
      styles: { fontSize: 8.5, cellPadding: 1.4, textColor: [120, 70, 0], fillColor: [255, 247, 225] },
      alternateRowStyles: { fillColor: [255, 247, 225] },
    })
    y -= 2
  }

  // ── Les chiffres clés ────────────────────────────────────────────────────
  const kpis: [string, string, string][] = [
    ["Chiffre d'affaires", money(s.revenue), s.commission > 0 ? `Net ${money(s.net)}` : `Panier moyen ${money(s.avgTicket)}`],
    ['Encaissé', money(s.collected), 'espèces, TPE, plateformes réglées'],
    ['À recevoir', money(s.receivable), 'à la clôture des recettes'],
    ['Solde du service', money(s.solde), `net - ${money(s.achats + s.depenses)} de sorties`],
    ['Écart de caisse', c.counted > 0 ? signed(c.ecartNet) : '—', c.counted > 0 ? `${c.counted}/${c.closed} comptées` : 'aucun tiroir compté'],
  ]
  const gap = 4
  const boxW = (pageW - 2 * MARGIN - gap * (kpis.length - 1)) / kpis.length
  kpis.forEach(([label, value, hint], i) => {
    const x = MARGIN + i * (boxW + gap)
    doc.setDrawColor(215, 215, 215).setLineWidth(0.2).roundedRect(x, y, boxW, 19, 1.5, 1.5, 'S')
    doc.setFont('helvetica', 'bold').setFontSize(7).setTextColor(...MUTED)
    doc.text(label.toUpperCase(), x + 3, y + 5)
    doc.setFontSize(13).setTextColor(...INK)
    doc.text(value, x + 3, y + 11.5)
    doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(...MUTED)
    doc.text(hint, x + 3, y + 16)
  })
  y += 25

  // ── Synthèse : trois tableaux côte à côte ────────────────────────────────
  // Posés à la main sur une même ligne : chacun répond à une question, et les
  // trois se lisent ensemble — où est l'argent, d'où vient le solde, le tiroir.
  const colW = (pageW - 2 * MARGIN - 2 * gap) / 3
  const top = y
  const column = (index: number, title: string, rows: RowInput[]) => {
    autoTable(doc, {
      theme: 'grid',
      startY: top,
      margin: { left: MARGIN + index * (colW + gap), right: MARGIN, bottom: 14 },
      tableWidth: colW,
      head: [[{ content: title, colSpan: 2 }]],
      body: rows,
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.5, textColor: INK, lineColor: [215, 215, 215], lineWidth: 0.1 },
      headStyles: { fillColor: INK, textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
    })
    return lastY()
  }
  const strong = (label: string, value: string): RowInput => [
    { content: label, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } },
    { content: value, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } },
  ]
  const share = (n: number) => (s.revenue > 0 ? ` (${((n / s.revenue) * 100).toFixed(0)} %)` : '')
  const platformLeft = Math.max(0, s.platformDue - s.platformPaid)
  const commissionKept = Math.max(0, s.revenue - s.cashSales - s.cardSales - s.platformDue - s.unsettled)
  const bottoms = [
    column(0, "OÙ EST L'ARGENT", [
      [`Espèces — dans le tiroir${share(s.cashSales)}`, money(s.cashSales)],
      [`TPE — en banque${share(s.cardSales)}`, money(s.cardSales)],
      ...(s.platformPaid > 0 ? [[`Plateformes réglées${share(s.platformPaid)}`, money(s.platformPaid)]] : []),
      strong('Encaissé', money(s.collected)),
      [`Plateformes à recevoir${share(platformLeft)}`, money(platformLeft)],
      ...(s.unsettled > 0 ? [[`Non renseigné${share(s.unsettled)}`, money(s.unsettled)]] : []),
      strong('À recevoir', money(s.receivable)),
      ...(commissionKept > 0.004 ? [[`Commissions gardées par les plateformes${share(commissionKept)}`, money(commissionKept)]] : []),
    ]),
    column(1, 'MONTANTS', [
      ["Chiffre d'affaires", money(s.revenue)],
      ...(s.discounts > 0 ? [['dont remises accordées', minus(s.discounts)]] : []),
      ...(s.surcharges > 0 ? [['dont majorations', `+ ${money(s.surcharges)}`]] : []),
      ...(s.deliveryFees > 0 ? [['dont frais de livraison', money(s.deliveryFees)]] : []),
      ['Commissions plateformes', minus(s.commission)],
      strong('Net après commissions', money(s.net)),
      ['Achats', minus(s.achats)],
      ['Dépenses', minus(s.depenses)],
      strong('Solde du service', money(s.solde)),
      [`Commandes · annulées · panier moyen`, `${s.orders} · ${s.cancelled} · ${money(s.avgTicket)}`],
    ]),
    column(2, 'TIROIR-CAISSE', [
      ['Ventes en espèces', `+ ${money(s.cashSales)}`],
      ...(s.apports > 0 ? [['Ajouts au fond', `+ ${money(s.apports)}`]] : []),
      ...(s.achats > 0 ? [['Achats', minus(s.achats)]] : []),
      ...(s.depenses > 0 ? [['Dépenses', minus(s.depenses)]] : []),
      ...(s.retraits > 0 ? [['Retraits', minus(s.retraits)]] : []),
      strong("Espèces attendues, hors fonds d'ouverture", money(s.cashExpected)),
      ['Tiroirs comptés', `${c.counted} / ${c.closed}`],
      ['Justes', String(c.balanced)],
      ['Manquants', c.manquants.count > 0 ? `${c.manquants.count} · - ${money(c.manquants.amount)}` : '0'],
      ['Excédents', c.excedents.count > 0 ? `${c.excedents.count} · + ${money(c.excedents.amount)}` : '0'],
      strong('Écart net', c.counted > 0 ? signed(c.ecartNet) : '—'),
    ]),
  ]
  y = Math.max(...bottoms) + 8

  // ── Recette par recette ──────────────────────────────────────────────────
  heading('Détail par recette', 'chaque ligne est exactement le ticket de clôture de la recette')
  table({
    startY: y,
    head: [['N°', 'Ouverture', 'Clôture', 'Cmd', 'CA', 'Net', 'Espèces', 'TPE', 'À recevoir', 'Sorties', 'Attendu', 'Compté', 'Écart']],
    body: r.recettes.map((x) => [
      x.status === 'open' ? `${x.number} (ouverte)` : x.number,
      `${stamp(x.openedAt)}${x.openedBy ? `\n${x.openedBy}` : ''}`,
      x.closedAt ? `${stamp(x.closedAt)} · ${duration(x.durationMin)}${x.closedBy ? `\n${x.closedBy}` : ''}` : `en cours · ${duration(x.durationMin)}`,
      x.cancelled > 0 ? `${x.orders} (+${x.cancelled} ann.)` : String(x.orders),
      num(x.revenue),
      num(x.net),
      num(x.cashSales),
      num(x.cardSales),
      x.receivable > 0.004 ? num(x.receivable) : '—',
      x.sorties > 0 ? num(x.sorties) : '—',
      num(x.expected),
      x.closingCash === null ? 'non compté' : num(x.closingCash),
      signed(x.ecart).replace(' DT', ''),
    ]),
    foot: [[
      'TOTAL', '', '', String(s.orders), num(s.revenue), num(s.net), num(s.cashSales), num(s.cardSales),
      num(s.receivable), num(s.achats + s.depenses), '', '', c.counted > 0 ? signed(c.ecartNet).replace(' DT', '') : '—',
    ]],
    showFoot: 'lastPage',
    styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 1.4, textColor: INK, lineColor: [215, 215, 215], lineWidth: 0.1, halign: 'right' },
    columnStyles: { 0: { halign: 'left', fontStyle: 'bold', cellWidth: 34 }, 1: { halign: 'left', cellWidth: 27 }, 2: { halign: 'left', cellWidth: 34 } },
    didParseCell: (hook) => {
      if (hook.section === 'foot' && hook.column.index < 3) hook.cell.styles.halign = 'left'
      // L'écart en couleur : un manquant ne doit pas se lire comme un excédent.
      if (hook.section === 'body' && hook.column.index === 12) {
        const ecart = r.recettes[hook.row.index]?.ecart
        if (typeof ecart === 'number' && Math.abs(ecart) >= 0.005) {
          hook.cell.styles.textColor = ecart < 0 ? [200, 30, 30] : [180, 110, 0]
          hook.cell.styles.fontStyle = 'bold'
        }
      }
    },
  })

  // ── Par jour ─────────────────────────────────────────────────────────────
  if (r.period.days > 1) {
    heading('Par jour', "jour d'ouverture de chaque recette")
    table({
      startY: y,
      head: [['Jour', 'Recettes', 'Commandes', "Chiffre d'affaires", 'Net', 'Encaissé', 'À recevoir', 'Sorties', 'Solde', 'Écart']],
      body: r.byDay.map((d) =>
        d.sessions === 0
          ? [dayFr(d.day), '—', '—', '—', '—', '—', '—', '—', '—', '—']
          : [
              dayFr(d.day), String(d.sessions), String(d.orders), num(d.revenue), num(d.net), num(d.collected),
              d.receivable > 0.004 ? num(d.receivable) : '—', d.sorties > 0 ? num(d.sorties) : '—', num(d.solde),
              signed(d.ecart).replace(' DT', ''),
            ]
      ),
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.4, textColor: INK, lineColor: [215, 215, 215], lineWidth: 0.1, halign: 'right' },
      columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
    })
  }

  // ── Plateformes ──────────────────────────────────────────────────────────
  if (r.byCompany.length > 0) {
    heading('Plateformes de livraison', '« à la clôture » est figé avec chaque recette ; « dû aujourd\'hui » tient compte des versements pointés depuis')
    table({
      startY: y,
      head: [['Plateforme', 'Commandes', 'CA brut', 'Commission', 'Net', 'Espèces au comptoir', 'À recevoir à la clôture', "Dû aujourd'hui"]],
      body: r.byCompany.map((p) => [
        p.name, String(p.count), num(p.revenue), `- ${num(p.commission)}${p.rate !== null ? ` (${p.rate} %)` : ''}`, num(p.net),
        p.cash > 0 ? num(p.cash) : '—', num(p.due - (p.settled ?? 0)), p.outstandingNow > 0.004 ? num(p.outstandingNow) : 'réglé',
      ]),
      foot: [[
        'TOTAL', String(r.byCompany.reduce((a, p) => a + p.count, 0)), num(r.byCompany.reduce((a, p) => a + p.revenue, 0)),
        `- ${num(r.byCompany.reduce((a, p) => a + p.commission, 0))}`, num(r.byCompany.reduce((a, p) => a + p.net, 0)), '',
        num(r.byCompany.reduce((a, p) => a + p.due - (p.settled ?? 0), 0)), num(r.platformsOutstandingNow),
      ]],
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.4, textColor: INK, lineColor: [215, 215, 215], lineWidth: 0.1, halign: 'right' },
      columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
      didParseCell: (hook) => {
        if (hook.section === 'foot' && hook.column.index === 0) hook.cell.styles.halign = 'left'
      },
    })
  }

  // ── Mouvements d'espèces ─────────────────────────────────────────────────
  const m = r.movements
  if (MOVEMENT_LIST.some((k) => m.byKind[k.kind].count > 0)) {
    heading("Mouvements d'espèces", 'achats et dépenses coûtent ; ajouts et retraits déplacent seulement l\'argent')
    table({
      startY: y,
      head: [['Type', 'Lignes', 'Montant', 'Principaux libellés']],
      body: MOVEMENT_LIST.filter((k) => m.byKind[k.kind].count > 0).map((k) => [
        k.label,
        String(m.byKind[k.kind].count),
        `${k.sign > 0 ? '+' : '-'} ${money(m.byKind[k.kind].amount)}`,
        m.top.filter((l) => l.kind === k.kind).slice(0, 6).map((l) => `${l.label} ${num(l.amount)}${l.count > 1 ? ` (x${l.count})` : ''}`).join(' · ') || '—',
      ]),
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 32 }, 1: { halign: 'right', cellWidth: 18 }, 2: { halign: 'right', cellWidth: 34 } },
    })
    if (m.cancelled > 0) {
      doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...MUTED)
      doc.text(`${plural(m.cancelled, 'ligne')} annulée${m.cancelled > 1 ? 's' : ''}, hors des totaux.`, MARGIN, y - 3)
      y += 2
    }
  }

  // ── Personnel payé depuis le tiroir ──────────────────────────────────────
  if (m.staff.byEmployee.length > 0) {
    heading('Personnel', 'versé depuis le tiroir — déjà compris dans les dépenses')
    table({
      startY: y,
      head: [['Employé', 'Versements', 'Avances', 'Salaires', 'Total']],
      body: m.staff.byEmployee.map((e) => [e.name, String(e.count), num(e.avances), num(e.salaires), num(e.avances + e.salaires)]),
      foot: [['TOTAL', '', num(m.staff.avances), num(m.staff.salaires), num(m.staff.avances + m.staff.salaires)]],
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.4, textColor: INK, lineColor: [215, 215, 215], lineWidth: 0.1, halign: 'right' },
      columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
      didParseCell: (hook) => {
        if (hook.section === 'foot' && hook.column.index === 0) hook.cell.styles.halign = 'left'
      },
    })
  }

  // ── Par caissier, et la répartition des ventes ───────────────────────────
  heading('Par caissier', "l'écart revient à qui a clôturé et compté")
  table({
    startY: y,
    head: [['Caissier', 'Recettes', 'Commandes', "Chiffre d'affaires", 'Tiroirs comptés', 'Écart', 'Dont manquants']],
    body: r.byCashier.map((k) => [
      k.name, String(k.sessions), String(k.orders), num(k.revenue), String(k.counted),
      k.counted > 0 ? signed(k.ecart).replace(' DT', '') : 'non compté', k.manquants > 0 ? `- ${num(k.manquants)}` : '—',
    ]),
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.4, textColor: INK, lineColor: [215, 215, 215], lineWidth: 0.1, halign: 'right' },
    columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
  })

  heading('Répartition des ventes')
  table({
    startY: y,
    head: [['', 'Commandes', "Chiffre d'affaires", 'Part']],
    body: [
      ['À emporter', String(r.byType.pickup.count), num(r.byType.pickup.revenue), share(r.byType.pickup.revenue).trim() || '—'],
      ['Livraison', String(r.byType.delivery.count), num(r.byType.delivery.revenue), share(r.byType.delivery.revenue).trim() || '—'],
      ...SOURCES.filter((k) => r.bySource[k]?.count > 0).map((k) => [
        k === 'unknown' ? 'Origine inconnue' : `Origine : ${ORDER_SOURCE_LABELS[k]}`,
        String(r.bySource[k].count),
        num(r.bySource[k].revenue),
        share(r.bySource[k].revenue).trim() || '—',
      ]),
    ],
    tableWidth: 150,
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.4, textColor: INK, lineColor: [215, 215, 215], lineWidth: 0.1, halign: 'right' },
    columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
  })

  // ── Pied de page, sur chaque page ────────────────────────────────────────
  const pages = doc.getNumberOfPages()
  const generated = new Date(r.generatedAt)
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...MUTED)
    doc.text(
      `Mr. Burritos · Rapport des recettes · ${period} · généré le ${generated.toLocaleDateString('fr-FR')} à ${generated.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} · montants en dinars`,
      MARGIN,
      pageH - 6
    )
    doc.text(`Page ${i} / ${pages}`, pageW - MARGIN, pageH - 6, { align: 'right' })
  }

  doc.save(`rapport-recettes_${r.period.from}_${r.period.to}.pdf`)
}
