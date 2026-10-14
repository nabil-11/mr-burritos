import type { jsPDF } from 'jspdf'

/**
 * Un document fait de tableaux, et ses quatre sorties : PDF, Excel, Word, CSV.
 *
 * La page décrit *quoi* exporter — un titre, des tableaux, des nombres — et ce
 * fichier décide *comment* l'écrire. Le document est du JSON pur : une page
 * serveur le construit et le passe tel quel au bouton client.
 *
 * Les montants restent des nombres jusqu'au bout : Excel les reçoit comme des
 * nombres (on peut les additionner), le CSV avec la virgule décimale
 * qu'attend un Excel français, le PDF et le Word avec deux décimales.
 *
 * Excel et Word sont de vrais .xlsx et .docx, écrits à la main — quelques
 * fichiers XML dans un zip — plutôt que deux bibliothèques de plusieurs
 * centaines de kilo-octets. Rien de tout cela n'est chargé avant le clic.
 */

export type ExportValue = string | number | null

export interface ExportColumn {
  label: string
  /** `money` : deux décimales. `number` : un compte, tel quel. Par défaut, du texte. */
  type?: 'text' | 'money' | 'number'
}

export interface ExportTable {
  /** Titre de la section — et nom de la feuille Excel. */
  title: string
  note?: string
  columns: ExportColumn[]
  rows: ExportValue[][]
  /** Une ligne de total, en gras. */
  foot?: ExportValue[]
}

export interface ExportDocument {
  /** Sans extension. */
  filename: string
  title: string
  subtitle?: string
  tables: ExportTable[]
}

export type ExportFormat = 'pdf' | 'xlsx' | 'docx' | 'csv'

export async function exportDocument(doc: ExportDocument, format: ExportFormat): Promise<void> {
  const blob =
    format === 'pdf' ? await toPdf(doc)
    : format === 'xlsx' ? await toXlsx(doc)
    : format === 'docx' ? await toDocx(doc)
    : toCsv(doc)
  download(blob, `${doc.filename}.${format}`)
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Laisser au navigateur le temps de lancer le téléchargement.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ── Briques communes ─────────────────────────────────────────────

const isNum = (v: ExportValue): v is number => typeof v === 'number' && Number.isFinite(v)
const isRight = (c: ExportColumn | undefined) => c?.type === 'money' || c?.type === 'number'

/** Une valeur lisible, pour le PDF et le Word : `1234.50`, `-12.00`, `7`. */
function display(v: ExportValue, col: ExportColumn | undefined): string {
  if (v === null || v === undefined) return ''
  if (isNum(v)) return col?.type === 'money' ? v.toFixed(2) : String(v)
  return String(v)
}

const exportedAt = () => {
  const now = new Date()
  return `${now.toLocaleDateString('fr-FR')} à ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
}

const xml = (s: string) =>
  s
    // Les caractères de contrôle sont interdits en XML : Office refuserait le fichier.
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

/** La largeur utile d'une colonne, en caractères. */
function columnChars(t: ExportTable, i: number): number {
  const col = t.columns[i]
  let w = col.label.length
  for (const row of [...t.rows, ...(t.foot ? [t.foot] : [])]) w = Math.max(w, display(row[i] ?? null, col).length)
  return Math.min(Math.max(w, 6), 48)
}

async function zip(files: Record<string, string>): Promise<Uint8Array> {
  const { zipSync, strToU8 } = await import('fflate')
  const entries: Record<string, Uint8Array> = {}
  for (const [path, content] of Object.entries(files)) entries[path] = strToU8(content)
  return zipSync(entries, { level: 6 })
}

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'

// ── CSV ──────────────────────────────────────────────────────────

/** Point-virgule et virgule décimale : ce qu'Excel attend en français. Les tableaux se suivent. */
function toCsv(doc: ExportDocument): Blob {
  const cell = (v: ExportValue, col: ExportColumn | undefined) => {
    const s = isNum(v) ? (col?.type === 'money' ? v.toFixed(2) : String(v)).replace('.', ',') : (v ?? '')
    return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const line = (row: ExportValue[], cols: ExportColumn[]) => row.map((v, i) => cell(v, cols[i])).join(';')
  const out: string[] = [cell(doc.title, undefined)]
  if (doc.subtitle) out.push(cell(doc.subtitle, undefined))
  for (const t of doc.tables) {
    out.push('', cell(t.title, undefined))
    if (t.note) out.push(cell(t.note, undefined))
    out.push(t.columns.map((c) => cell(c.label, undefined)).join(';'))
    for (const row of t.rows) out.push(line(row, t.columns))
    if (t.foot) out.push(line(t.foot, t.columns))
  }
  return new Blob(['\ufeff' + out.join('\r\n')], { type: 'text/csv;charset=utf-8' })
}

// ── Excel (.xlsx) ────────────────────────────────────────────────

/** Les styles de cellule, par leur rang dans `cellXfs` ci-dessous. */
const XS = { plain: 0, title: 1, muted: 2, head: 3, headRight: 4, money: 5, foot: 6, footMoney: 7 } as const

const XLSX_STYLES = `${XML_HEAD}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00"/></numFmts>
<fonts count="4">
<font><sz val="11"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="14"/><name val="Calibri"/><family val="2"/></font>
<font><i/><sz val="10"/><color rgb="FF6E6E6E"/><name val="Calibri"/><family val="2"/></font>
</fonts>
<fills count="3">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFF5A800"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="2">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left/><right/><top style="thin"><color auto="1"/></top><bottom/><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="8">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="right"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/>
<xf numFmtId="164" fontId="1" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`

const colName = (i: number) => {
  let s = ''
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s
  return s
}

/** Un nom de feuille : 31 caractères au plus, sans `[]:*?/\`, unique dans le classeur. */
function sheetNames(tables: ExportTable[]): string[] {
  const used = new Set<string>()
  return tables.map((t, i) => {
    const base = (t.title.replace(/[[\]:*?/\\]/g, ' ').trim() || `Feuille ${i + 1}`).slice(0, 31)
    let name = base
    for (let n = 2; used.has(name.toLowerCase()); n++) name = `${base.slice(0, 31 - String(n).length - 1)} ${n}`
    used.add(name.toLowerCase())
    return name
  })
}

function sheetXml(doc: ExportDocument, t: ExportTable): string {
  const rows: string[] = []
  const str = (ref: string, s: string, style: number) =>
    `<c r="${ref}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${xml(s)}</t></is></c>`
  const value = (ref: string, v: ExportValue, col: ExportColumn | undefined, foot: boolean) => {
    if (isNum(v)) {
      const style = col?.type === 'money' ? (foot ? XS.footMoney : XS.money) : foot ? XS.foot : XS.plain
      return `<c r="${ref}" s="${style}"><v>${v}</v></c>`
    }
    if (v === null || v === '') return foot ? `<c r="${ref}" s="${XS.foot}"/>` : ''
    return str(ref, String(v), foot ? XS.foot : XS.plain)
  }
  const push = (cells: string) => rows.push(`<row r="${rows.length + 1}">${cells}</row>`)

  push(str('A1', t.title === doc.title ? doc.title : `${doc.title} — ${t.title}`, XS.title))
  if (doc.subtitle) push(str(`A${rows.length + 1}`, doc.subtitle, XS.muted))
  if (t.note) push(str(`A${rows.length + 1}`, t.note, XS.muted))
  rows.push(`<row r="${rows.length + 1}"/>`)

  const headRow = rows.length + 1
  push(t.columns.map((c, i) => str(`${colName(i)}${headRow}`, c.label, isRight(c) ? XS.headRight : XS.head)).join(''))
  for (const row of t.rows) {
    const r = rows.length + 1
    push(t.columns.map((c, i) => value(`${colName(i)}${r}`, row[i] ?? null, c, false)).join(''))
  }
  if (t.foot) {
    const r = rows.length + 1
    push(t.columns.map((c, i) => value(`${colName(i)}${r}`, t.foot![i] ?? null, c, true)).join(''))
  }

  const cols = t.columns
    .map((_, i) => `<col min="${i + 1}" max="${i + 1}" width="${columnChars(t, i) + 3}" customWidth="1"/>`)
    .join('')
  return `${XML_HEAD}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
<sheetViews><sheetView workbookViewId="0"><pane ySplit="${headRow}" topLeftCell="A${headRow + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<cols>${cols}</cols>
<sheetData>${rows.join('')}</sheetData>
<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>
<pageSetup paperSize="9" fitToWidth="1" fitToHeight="0" orientation="${t.columns.length > 7 ? 'landscape' : 'portrait'}"/>
</worksheet>`
}

async function toXlsx(doc: ExportDocument): Promise<Blob> {
  const names = sheetNames(doc.tables)
  const files: Record<string, string> = {
    '[Content_Types].xml': `${XML_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${names.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('\n')}
</Types>`,
    '_rels/.rels': `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    'xl/workbook.xml': `${XML_HEAD}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${names.map((n, i) => `<sheet name="${xml(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>
</workbook>`,
    'xl/_rels/workbook.xml.rels': `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${names.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('\n')}
<Relationship Id="rId${names.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
    'xl/styles.xml': XLSX_STYLES,
  }
  doc.tables.forEach((t, i) => (files[`xl/worksheets/sheet${i + 1}.xml`] = sheetXml(doc, t)))
  return new Blob([(await zip(files)) as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

// ── Word (.docx) ─────────────────────────────────────────────────

/** A4, marges de 1,8 cm — en vingtièmes de point. */
const A4 = { short: 11906, long: 16838, margin: 1020 }

function toDocxXml(doc: ExportDocument): string {
  const landscape = doc.tables.some((t) => t.columns.length > 7)
  const pageW = landscape ? A4.long : A4.short
  const pageH = landscape ? A4.short : A4.long
  const usable = pageW - 2 * A4.margin

  const run = (text: string, props = '') =>
    `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ''}<w:t xml:space="preserve">${xml(text)}</w:t></w:r>`
  const para = (text: string, props = '', pPr = '') => `<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ''}${run(text, props)}</w:p>`

  const table = (t: ExportTable) => {
    const chars = t.columns.map((_, i) => columnChars(t, i))
    const total = chars.reduce((a, b) => a + b, 0)
    const widths = chars.map((c) => Math.floor((usable * c) / total))
    const cell = (text: string, i: number, opts: { head?: boolean; foot?: boolean } = {}) => {
      const right = isRight(t.columns[i])
      const shade = opts.head ? '<w:shd w:val="clear" w:color="auto" w:fill="F5A800"/>' : opts.foot ? '<w:shd w:val="clear" w:color="auto" w:fill="F0F0F0"/>' : ''
      const props = `${opts.head || opts.foot ? '<w:b/>' : ''}<w:sz w:val="17"/><w:szCs w:val="17"/>`
      return `<w:tc><w:tcPr><w:tcW w:w="${widths[i]}" w:type="dxa"/>${shade}</w:tcPr>${para(text, props, right ? '<w:jc w:val="right"/>' : '')}</w:tc>`
    }
    const border = (side: string) => `<w:${side} w:val="single" w:sz="4" w:space="0" w:color="D7D7D7"/>`
    return [
      '<w:tbl>',
      `<w:tblPr><w:tblW w:w="${usable}" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(border).join('')}</w:tblBorders>`,
      '<w:tblCellMar><w:top w:w="30" w:type="dxa"/><w:left w:w="70" w:type="dxa"/><w:bottom w:w="30" w:type="dxa"/><w:right w:w="70" w:type="dxa"/></w:tblCellMar></w:tblPr>',
      `<w:tblGrid>${widths.map((w) => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>`,
      // La ligne d'en-tête se répète en haut de chaque page.
      `<w:tr><w:trPr><w:tblHeader/></w:trPr>${t.columns.map((c, i) => cell(c.label, i, { head: true })).join('')}</w:tr>`,
      ...t.rows.map((row) => `<w:tr><w:trPr><w:cantSplit/></w:trPr>${t.columns.map((c, i) => cell(display(row[i] ?? null, c), i)).join('')}</w:tr>`),
      ...(t.foot ? [`<w:tr>${t.columns.map((c, i) => cell(display(t.foot![i] ?? null, c), i, { foot: true })).join('')}</w:tr>`] : []),
      '</w:tbl>',
    ].join('')
  }

  const muted = '<w:color w:val="6E6E6E"/><w:sz w:val="17"/><w:szCs w:val="17"/>'
  const body = [
    para('MR. BURRITOS', '<w:b/><w:color w:val="F5A800"/><w:sz w:val="18"/>'),
    para(doc.title, '<w:b/><w:sz w:val="34"/><w:szCs w:val="34"/>', '<w:spacing w:after="40"/>'),
    ...(doc.subtitle ? [para(doc.subtitle, muted)] : []),
    ...doc.tables.flatMap((t) => [
      para(t.title, '<w:b/><w:sz w:val="24"/><w:szCs w:val="24"/>', '<w:keepNext/><w:spacing w:before="280" w:after="60"/>'),
      ...(t.note ? [para(t.note, muted, '<w:keepNext/><w:spacing w:after="80"/>')] : []),
      table(t),
    ]),
    para(`Exporté le ${exportedAt()} · montants en dinars`, muted, '<w:spacing w:before="240"/>'),
  ]

  return `${XML_HEAD}<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body.join('')}<w:sectPr><w:pgSz w:w="${pageW}" w:h="${pageH}"${landscape ? ' w:orient="landscape"' : ''}/><w:pgMar w:top="${A4.margin}" w:right="${A4.margin}" w:bottom="${A4.margin}" w:left="${A4.margin}" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>`
}

async function toDocx(doc: ExportDocument): Promise<Blob> {
  const files: Record<string, string> = {
    '[Content_Types].xml': `${XML_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`,
    '_rels/.rels': `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
    'word/_rels/document.xml.rels': `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
    'word/styles.xml': `${XML_HEAD}<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults>
<w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:lang w:val="fr-FR"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault>
</w:docDefaults>
</w:styles>`,
    'word/document.xml': toDocxXml(doc),
  }
  return new Blob([(await zip(files)) as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
}

// ── PDF ──────────────────────────────────────────────────────────

const ACCENT: [number, number, number] = [245, 168, 0]
const INK: [number, number, number] = [26, 26, 26]
const MUTED: [number, number, number] = [110, 110, 110]
const MARGIN = 12

/**
 * Helvetica, la police intégrée du PDF, ne connaît que l'alphabet latin : ni
 * le vrai signe moins, ni l'espace fine, ni les émojis. Les remplacer vaut
 * mieux qu'imprimer des carrés.
 */
const latin = (s: string) =>
  s
    .replace(/\u2212/g, '-')
    .replace(/[\u00a0\u2009\u202f]/g, ' ')
    .replace(/[^\u0000-\u00ff\u0152\u0153\u0178\u2013\u2014\u2018\u2019\u201c\u201d\u2022\u2026\u20ac]/g, '')

async function toPdf(doc: ExportDocument): Promise<Blob> {
  const [{ jsPDF: PDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const landscape = doc.tables.some((t) => t.columns.length > 7)
  const pdf: jsPDF = new PDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const lastY = () => (pdf as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y

  let y = MARGIN
  pdf.setFillColor(...ACCENT).rect(0, 0, pageW, 3, 'F')
  pdf.setFont('helvetica', 'bold').setFontSize(9).setTextColor(...ACCENT)
  pdf.text('MR. BURRITOS', MARGIN, y + 2)
  pdf.setFontSize(16).setTextColor(...INK)
  pdf.text(latin(doc.title), MARGIN, y + 10)
  y += 12
  if (doc.subtitle) {
    pdf.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...MUTED)
    const lines = pdf.splitTextToSize(latin(doc.subtitle), pageW - 2 * MARGIN) as string[]
    pdf.text(lines, MARGIN, y + 3)
    y += 4 * lines.length
  }
  y += 5

  for (const t of doc.tables) {
    // Un titre seul en bas de page, son tableau sur la suivante : non.
    if (y > pageH - 35) {
      pdf.addPage()
      y = MARGIN
    }
    pdf.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...INK)
    pdf.text(latin(t.title), MARGIN, y + 3)
    y += 5
    if (t.note) {
      pdf.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...MUTED)
      const lines = pdf.splitTextToSize(latin(t.note), pageW - 2 * MARGIN) as string[]
      pdf.text(lines, MARGIN, y + 2)
      y += 3.5 * lines.length
    }
    y += 1
    const columnStyles = Object.fromEntries(
      t.columns.map((c, i) => [i, { halign: isRight(c) ? ('right' as const) : ('left' as const) }])
    )
    autoTable(pdf, {
      startY: y,
      theme: 'grid',
      margin: { left: MARGIN, right: MARGIN, bottom: 14 },
      head: [t.columns.map((c) => latin(c.label))],
      body: t.rows.map((row) => t.columns.map((c, i) => latin(display(row[i] ?? null, c)))),
      foot: t.foot ? [t.columns.map((c, i) => latin(display(t.foot![i] ?? null, c)))] : undefined,
      showFoot: 'lastPage',
      styles: { font: 'helvetica', fontSize: t.columns.length > 10 ? 7 : 8, cellPadding: 1.5, textColor: INK, lineColor: [215, 215, 215], lineWidth: 0.1 },
      headStyles: { fillColor: INK, textColor: 255, fontStyle: 'bold' },
      footStyles: { fillColor: [240, 240, 240], textColor: INK, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      columnStyles,
      // L'alignement suit la colonne, en-tête et total compris.
      didParseCell: (hook) => {
        if (hook.section !== 'body' && isRight(t.columns[hook.column.index])) hook.cell.styles.halign = 'right'
      },
    })
    y = lastY() + 8
  }

  const pages = pdf.getNumberOfPages()
  const footer = latin(`Mr. Burritos · ${doc.title} · exporté le ${exportedAt()} · montants en dinars`)
  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i)
    pdf.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...MUTED)
    pdf.text(footer, MARGIN, pageH - 6)
    pdf.text(`Page ${i} / ${pages}`, pageW - MARGIN, pageH - 6, { align: 'right' })
  }
  return pdf.output('blob')
}
