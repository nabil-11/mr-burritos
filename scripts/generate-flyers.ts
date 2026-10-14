/**
 * Mr. Burritos — Flyer A5 recto / verso, à distribuer
 * Lance avec : npm run flyers
 *
 * Produit deux fichiers prêts pour l'imprimeur :
 *   affiches/flyer-a5-recto.png  — l'accroche : photo, remise en ligne, QR
 *   affiches/flyer-a5-verso.png  — la carte complète avec les prix
 *
 * Format A5 (148 × 210 mm) à 300 dpi, avec 3 mm de fond perdu sur chaque bord
 * (154 × 216 mm au total) : l'imprimeur coupe dans le fond perdu, jamais dans
 * le texte. Rien de lisible ne s'approche à moins de 7 mm du bord fini.
 *
 * Même parti pris que `generate-promo-card.ts` : sharp + SVG, Arial uniquement,
 * et les chiffres qui bougent (remise, adresse, horaires) lus dans le code
 * plutôt que recopiés. Les prix de la carte, eux, sont recopiés des panneaux
 * 2026 (voir `upgrade-menu.ts`) : si la carte change, il faut les reprendre ici.
 */

import 'dotenv/config'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import QRCode from 'qrcode'
import sharp from 'sharp'
import { OPENING_HOURS } from '../lib/hours'
import { WEB_PROMO } from '../lib/promo'
import { promoDisplayUrl } from '../lib/receiptPromoCard'
import { SITE } from '../lib/site'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://mrburritos.tn'
/** Tagué pour distinguer dans les stats un scan de flyer d'un scan de ticket. */
const QR_TARGET = `${SITE_URL.replace(/\/+$/, '')}/?src=flyer`
const OUT_DIR = resolve(process.cwd(), 'affiches')
const LOGO = resolve(process.cwd(), 'public/logo.jpg')
const PHOTO = resolve(process.cwd(), 'public/hero-banner.jpg')

const DPI = 300
const BLEED = 3
const TRIM_W = 148
const TRIM_H = 210
/** Millimètres → pixels. */
const px = (v: number) => Math.round((v * DPI) / 25.4)
/** Coordonnée en millimètres sur le format fini → pixels sur la toile avec fond perdu. */
const at = (v: number) => px(v + BLEED)
const W = px(TRIM_W + 2 * BLEED)
const H = px(TRIM_H + 2 * BLEED)
/** Marge intérieure : tout le texte vit entre M et TRIM_W − M. */
const M = 9
const CONTENT_W = TRIM_W - 2 * M

// Les couleurs de la carte promo, elles-mêmes relevées sur le logo.
const INK = '#141210'
const PANEL = '#1E1A16'
const LINE = '#3A332B'
const AMBER = '#F5A800'
const RED = '#E0262B'
const CREAM = '#F7EFDF'
const MUTED = '#A2957E'

const BLACK = 'Arial Black, Arial, sans-serif'
const SANS = 'Arial, sans-serif'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** « 11 DT », « 12.5 DT » — les prix de la carte n'ont jamais plus d'une décimale. */
const dt = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)} DT`

/** « +216 93822570 » → « +216 93 822 570 », comme sur l'enseigne. */
function prettyPhone(raw: string): string {
  const d = raw.replace(/\D/g, '')
  const local = d.startsWith('216') ? d.slice(3) : d
  return `+216 ${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5)}`
}

/** « 11h – 23h », plus la soirée prolongée du week-end si elle existe. */
function hoursLine(): { main: string; extra: string } {
  const days = OPENING_HOURS.filter(Boolean) as { open: number; close: number }[]
  const open = Math.min(...days.map(d => d.open))
  const closes = days.map(d => d.close)
  const usual = Math.min(...closes)
  const late = Math.max(...closes)
  const h = (n: number) => (n % 24 === 0 ? 'minuit' : `${n}h`)
  return {
    main: `${open}h – ${h(usual)}`,
    extra: late > usual ? `ven. & sam. jusqu'à ${h(late)}` : 'tous les jours',
  }
}

/**
 * Largeur approximative d'un texte en millimètres. Arial Black avance d'environ
 * 0,62 em par caractère, Arial gras d'environ 0,56 : assez juste pour vérifier
 * qu'une ligne tient, sans moteur de mise en page.
 */
const widthOf = (text: string, size: number, black = false) => text.length * size * (black ? 0.62 : 0.56)

/** Texte SVG positionné en millimètres sur le format fini. */
function text(
  x: number,
  y: number,
  s: string,
  o: { size: number; fill?: string; black?: boolean; bold?: boolean; anchor?: 'start' | 'middle' | 'end'; spacing?: number; opacity?: number },
): string {
  const family = o.black ? BLACK : SANS
  const weight = o.black ? 900 : o.bold ? 'bold' : 'normal'
  return `<text x="${at(x)}" y="${at(y)}" font-family="${family}" font-size="${px(o.size)}" font-weight="${weight}"
    fill="${o.fill ?? CREAM}" text-anchor="${o.anchor ?? 'start'}" letter-spacing="${o.spacing ?? 0}"${
      o.opacity != null ? ` opacity="${o.opacity}"` : ''
    }>${esc(s)}</text>`
}

function rect(x: number, y: number, w: number, h: number, fill: string, r = 0, extra = ''): string {
  return `<rect x="${at(x)}" y="${at(y)}" width="${px(w)}" height="${px(h)}" rx="${px(r)}" fill="${fill}" ${extra}/>`
}

/** Fond commun : noir chaud, deux halos ambrés en diagonale comme sur l'affiche A4. */
function background(): string {
  return `
  <defs>
    <radialGradient id="glowTop" cx="0" cy="0" r="0.75">
      <stop offset="0" stop-color="${AMBER}" stop-opacity="0.22"/>
      <stop offset="1" stop-color="${AMBER}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glowBottom" cx="1" cy="1" r="0.7">
      <stop offset="0" stop-color="#D2691E" stop-opacity="0.24"/>
      <stop offset="1" stop-color="#D2691E" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#0C0B0A"/>
  <rect width="${W}" height="${H}" fill="url(#glowTop)"/>
  <rect width="${W}" height="${H}" fill="url(#glowBottom)"/>`
}

/** Le badge du logo, détouré au cercle (même découpe que la carte promo). */
async function roundLogo(size: number): Promise<Buffer> {
  const cx = 625
  const cy = 392
  const r = 330
  const square = await sharp(LOGO)
    .extract({ left: cx - r, top: cy - r, width: r * 2, height: r * 2 })
    .resize(size, size)
    .png()
    .toBuffer()
  const ring = Math.max(2, Math.round(size * 0.035))
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`,
  )
  const border = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - ring / 2}" fill="none" stroke="${AMBER}" stroke-width="${ring}"/></svg>`,
  )
  return sharp(square)
    .composite([{ input: mask, blend: 'dest-in' }, { input: border }])
    .png()
    .toBuffer()
}

/** Photo arrondie aux coins, recadrée pour remplir exactement le cadre. */
async function roundedPhoto(w: number, h: number, r: number, crop?: sharp.Region): Promise<Buffer> {
  let img = sharp(PHOTO)
  if (crop) img = img.extract(crop)
  const resized = await img.resize(w, h, { fit: 'cover' }).modulate({ saturation: 1.08 }).png().toBuffer()
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${r}" fill="#fff"/></svg>`,
  )
  return sharp(resized).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer()
}

function qr(sizePx: number): Promise<Buffer> {
  return QRCode.toBuffer(QR_TARGET, {
    type: 'png',
    errorCorrectionLevel: 'M',
    margin: 1,
    width: sizePx,
    color: { dark: '#141210ff', light: '#ffffffff' },
  })
}

async function render(svg: string, layers: sharp.OverlayOptions[], file: string) {
  const png = await sharp({ create: { width: W, height: H, channels: 3, background: INK } })
    .composite([{ input: Buffer.from(svg), left: 0, top: 0 }, ...layers])
    .withMetadata({ density: DPI })
    .png()
    .toBuffer()
  const out = resolve(OUT_DIR, file)
  writeFileSync(out, png)
  console.log(`Écrit : ${out}`)
}

// ─── RECTO ───────────────────────────────────────────────────────────────────
async function recto() {
  const percent = Math.round(WEB_PROMO.rate * 100)
  const url = promoDisplayUrl(SITE_URL)
  const hours = hoursLine()

  // En-tête
  const logoMm = 17
  const titleX = M + logoMm + 4

  // Photo : la bannière du site entière, celle qui porte déjà le logo dessiné.
  // Recadrée en hauteur (un peu de fond orange en moins en haut et en bas) pour
  // laisser au pied la place de l'adresse et des horaires.
  const photoY = 30
  const photoH = 58

  // Offre
  const offerY = photoY + photoH + 6
  const badgeW = 46
  const badgeH = 25

  // Tailles
  const sizesY = offerY + badgeH + 6
  const cardGap = 4
  const cardW = (CONTENT_W - 2 * cardGap) / 3
  const cardH = 19

  // QR
  const qrBoxY = sizesY + cardH + 6
  const qrBoxH = 31
  const qrMm = 24
  const qrTextX = M + 4 + qrMm + 3 + 6
  const urlSize = Math.min(3.8, (CONTENT_W - (qrTextX - M) - 12) / (0.62 * url.length))
  const pillW = widthOf(url, urlSize, true) + 9

  // Pied
  const footY = qrBoxY + qrBoxH + 5

  const sizes = [
    { name: 'M', meats: '1 VIANDE', price: 11 },
    { name: 'XL', meats: '2 VIANDES', price: 16 },
    { name: 'XXL', meats: '3 VIANDES', price: 19 },
  ]

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  ${background()}

  ${text(titleX, M + 10.5, 'MR. BURRITOS', { size: 10, black: true, fill: AMBER, spacing: 4 })}
  ${text(titleX + 0.4, M + 16, 'TACOS · BURRITOS · BURGERS · BOWLS', { size: 2.9, bold: true, fill: MUTED, spacing: 7 })}

  <!-- cadre fin autour de la photo -->
  ${rect(M - 0.4, photoY - 0.4, CONTENT_W + 0.8, photoH + 0.8, LINE, 4.4)}

  <!-- L'offre -->
  <rect x="${at(M)}" y="${at(offerY)}" width="${px(badgeW)}" height="${px(badgeH)}" rx="${px(3.5)}" fill="${RED}"/>
  ${text(M + badgeW / 2, offerY + 15.5, `−${percent}%`, { size: 14, black: true, anchor: 'middle', fill: '#FFFFFF', spacing: -4 })}
  ${text(M + badgeW / 2, offerY + 21.3, 'DE REMISE', { size: 2.7, black: true, anchor: 'middle', fill: '#FFFFFF', spacing: 9 })}
  ${text(M + badgeW + 6, offerY + 8.5, 'Sur toute', { size: 7.4, black: true, fill: '#FFFFFF' })}
  ${text(M + badgeW + 6, offerY + 16.8, 'commande en ligne', { size: 6.3, black: true, fill: AMBER })}
  ${text(M + badgeW + 6, offerY + 23, 'Remise appliquée automatiquement au panier.', { size: 2.9, fill: MUTED })}

  <!-- Tacos & Burritos, les trois tailles -->
  ${sizes
    .map((s, i) => {
      const x = M + i * (cardW + cardGap)
      const cx = x + cardW / 2
      return `${rect(x, sizesY, cardW, cardH, PANEL, 3, `stroke="${LINE}" stroke-width="${px(0.3)}"`)}
  ${text(cx, sizesY + 7.6, s.name, { size: 6.6, black: true, anchor: 'middle', fill: AMBER })}
  ${text(cx, sizesY + 11.8, s.meats, { size: 2.3, black: true, anchor: 'middle', fill: MUTED, spacing: 6 })}
  ${text(cx, sizesY + 16.4, `dès ${dt(s.price)}`, { size: 3.6, black: true, anchor: 'middle', fill: '#FFFFFF' })}`
    })
    .join('\n')}

  <!-- QR -->
  ${rect(M, qrBoxY, CONTENT_W, qrBoxH, PANEL, 4, `stroke="${LINE}" stroke-width="${px(0.3)}"`)}
  ${rect(M + 3.5, qrBoxY + 3.5, qrMm, qrMm, '#FFFFFF', 2.5)}
  ${text(qrTextX, qrBoxY + 9.2, 'Scannez.', { size: 6.6, black: true, fill: '#FFFFFF' })}
  ${text(qrTextX, qrBoxY + 16.2, 'Commandez.', { size: 6.6, black: true, fill: AMBER })}
  ${text(qrTextX, qrBoxY + 20.8, 'Livraison dans l’Ariana ou à emporter.', { size: 2.9, fill: MUTED })}
  <rect x="${at(qrTextX)}" y="${at(qrBoxY + 22.8)}" width="${px(pillW)}" height="${px(6.2)}" rx="${px(3.1)}" fill="${AMBER}"/>
  ${text(qrTextX + pillW / 2, qrBoxY + 27.2, url, { size: urlSize, black: true, anchor: 'middle', fill: INK })}

  <!-- Pied : adresse, téléphone, horaires -->
  <line x1="${at(M)}" y1="${at(footY)}" x2="${at(TRIM_W - M)}" y2="${at(footY)}" stroke="${LINE}" stroke-width="${px(0.3)}"/>
  ${[
    { x: M, label: 'ADRESSE', value: SITE.location, sub: `${SITE.city}, ${SITE.region}` },
    { x: M + 46, label: 'TÉLÉPHONE', value: prettyPhone(SITE.phone), sub: 'Commande par téléphone' },
    { x: M + 92, label: 'OUVERT', value: hours.main, sub: hours.extra },
  ]
    .map(
      c => `${text(c.x, footY + 5.2, c.label, { size: 2.3, black: true, fill: AMBER, spacing: 6 })}
  ${text(c.x, footY + 10.2, c.value, { size: 3.6, black: true, fill: '#FFFFFF' })}
  ${text(c.x, footY + 14, c.sub, { size: 2.5, fill: MUTED })}`,
    )
    .join('\n')}
</svg>`

  const logoPx = px(logoMm)
  const [logo, photo, code] = await Promise.all([
    roundLogo(logoPx),
    roundedPhoto(px(CONTENT_W), px(photoH), px(4)),
    qr(px(qrMm - 3)),
  ])

  await render(
    svg,
    [
      { input: logo, left: at(M), top: at(M - 1) },
      { input: photo, left: at(M), top: at(photoY) },
      { input: code, left: at(M + 3.5 + 1.5), top: at(qrBoxY + 3.5 + 1.5) },
    ],
    'flyer-a5-recto.png',
  )
}

// ─── VERSO : la carte ────────────────────────────────────────────────────────
interface Item {
  name: string
  price: number
  desc?: string
}

const MENU: { title: string; items: Item[] }[][] = [
  [
    {
      title: 'BURGERS',
      items: [
        { name: 'Crispy Burger Simple', price: 12.5, desc: 'Poulet pané, laitue, tomate, sauce burger' },
        { name: 'Burger Cheese Bacon', price: 15.2, desc: 'Bœuf 100 g, bacon, cheddar, sauce burger' },
        { name: 'Double Crispy Burger', price: 15.8, desc: '2 poulets panés, cheddar, sauce spicy' },
        { name: 'Burger Big Beef', price: 16.8, desc: 'Double beef, double cheese, sauce burger' },
      ],
    },
    {
      title: 'BOWLS',
      items: [
        { name: 'Ultimate Mix', price: 16.5, desc: 'Frites, tortillas, mozza, double viande' },
        { name: 'Mexi Nachos', price: 17, desc: 'Nachos, guacamole, bœuf haché, jalapeños' },
      ],
    },
    {
      title: 'TIME HEALTHY',
      items: [
        { name: 'Healthy Burrito', price: 15.5, desc: 'Escalope grillée, riz, haricots, avocat' },
        { name: 'Burrito Bowl', price: 15.9, desc: 'Riz, haricots, maïs, avocat, viande' },
      ],
    },
  ],
  [
    {
      title: 'BOXES À PARTAGER',
      items: [
        { name: 'Box Duo', price: 29.9, desc: '2 tacos, méga frites, 2 boissons, mix' },
        { name: 'Box Chilla', price: 45, desc: '3 tacos, méga frites, 3 boissons, mix' },
        { name: 'Box Famille', price: 59.9, desc: '4 tacos, méga frites, 4 boissons, mix' },
      ],
    },
    {
      title: 'SNACKS & BOISSONS',
      items: [
        { name: 'Nuggets × 6', price: 6.5 },
        { name: 'Chicken Finger × 8', price: 6.5 },
        { name: 'Boulettes fromage × 6', price: 6.5 },
        { name: 'Soda canette', price: 2.5 },
        { name: 'Eau 0.5 L', price: 1 },
      ],
    },
  ],
]

const EXTRAS: Item[] = [
  { name: 'Fromage slice', price: 1 },
  { name: 'Œuf', price: 1 },
  { name: 'Nachos', price: 2 },
  { name: 'Gruyère', price: 2.5 },
  { name: 'Frites', price: 2.5 },
  { name: 'Raclette', price: 3 },
  { name: 'Mozzarella fondu', price: 3 },
  { name: 'Bacon', price: 3.5 },
  { name: 'Viande en plus', price: 4 },
  { name: 'Guacamole', price: 5 },
]

const VIANDES = ['Crispy', 'Spicy Chicken', 'Cordon Bleu', 'Chicken Crispy', 'Boulette fromage', 'Viande hachée']
const SAUCES = ['Olive', 'Spicy', 'Burrito', 'Mayonnaise', 'BBQ']

/** Un titre de rubrique : libellé ambré et filet qui court jusqu'au bout de la colonne. */
function sectionTitle(x: number, y: number, w: number, title: string): string {
  // Des capitales espacées en Arial Black : plus larges que la moyenne de widthOf.
  const tw = title.length * 3.2 * 0.8 + 2.5
  return `${text(x, y, title, { size: 3.2, black: true, fill: AMBER, spacing: 3 })}
  <line x1="${at(x + tw)}" y1="${at(y - 1.1)}" x2="${at(x + w)}" y2="${at(y - 1.1)}" stroke="${LINE}" stroke-width="${px(0.3)}"/>`
}

async function verso() {
  const percent = Math.round(WEB_PROMO.rate * 100)
  const url = promoDisplayUrl(SITE_URL)
  const parts: string[] = []

  // En-tête
  const logoMm = 15
  parts.push(text(M, M + 9, 'LA CARTE', { size: 10, black: true, fill: '#FFFFFF', spacing: 3 }))
  parts.push(text(M + 0.3, M + 14.6, 'Fait maison · Livraison & à emporter', { size: 3, bold: true, fill: MUTED, spacing: 1 }))

  // ── Tacos & Burrito : le tableau des tailles ──────────────────────────────
  const tY = 29
  const tH = 50.5
  parts.push(rect(M, tY, CONTENT_W, tH, PANEL, 4, `stroke="${LINE}" stroke-width="${px(0.3)}"`))
  parts.push(text(M + 5, tY + 7.5, 'TACOS & BURRITO', { size: 4.6, black: true, fill: AMBER, spacing: 2 }))
  parts.push(text(M + 5, tY + 12, 'Composez le vôtre : la taille, vos viandes, vos sauces.', { size: 2.8, fill: MUTED }))

  // Colonnes : taille | viandes | Tacos | Burrito
  const colTacos = M + 82
  const colBurrito = M + CONTENT_W - 8
  const headY = tY + 17.5
  const rowH = 6.2
  parts.push(text(colTacos, headY, 'TACOS', { size: 2.5, black: true, anchor: 'end', fill: MUTED, spacing: 4 }))
  parts.push(text(colBurrito, headY, 'BURRITO', { size: 2.5, black: true, anchor: 'end', fill: MUTED, spacing: 4 }))
  const rows = [
    { size: 'M', meats: '1 viande', tacos: 11, burrito: 12 },
    { size: 'XL', meats: '2 viandes', tacos: 16, burrito: 16 },
    { size: 'XXL', meats: '3 viandes', tacos: 19, burrito: 19 },
  ]
  rows.forEach((r, i) => {
    const y = headY + rowH + i * rowH
    parts.push(text(M + 5, y, r.size, { size: 4.4, black: true, fill: '#FFFFFF' }))
    parts.push(text(M + 22, y, r.meats, { size: 3.2, fill: CREAM }))
    parts.push(text(colTacos, y, dt(r.tacos), { size: 3.8, black: true, anchor: 'end', fill: AMBER }))
    parts.push(text(colBurrito, y, dt(r.burrito), { size: 3.8, black: true, anchor: 'end', fill: AMBER }))
    if (i < rows.length - 1) {
      parts.push(
        `<line x1="${at(M + 5)}" y1="${at(y + 2.1)}" x2="${at(colBurrito)}" y2="${at(y + 2.1)}" stroke="${LINE}" stroke-width="${px(0.2)}"/>`,
      )
    }
  })
  const listY = headY + rows.length * rowH + 6.2
  parts.push(text(M + 5, listY, 'VIANDES', { size: 2.4, black: true, fill: AMBER, spacing: 4 }))
  parts.push(text(M + 22, listY, VIANDES.join(' · '), { size: 2.45, fill: CREAM }))
  parts.push(text(M + 5, listY + 4.4, 'SAUCES', { size: 2.4, black: true, fill: AMBER, spacing: 4 }))
  parts.push(text(M + 22, listY + 4.4, `${SAUCES.join(' · ')} — offertes`, { size: 2.45, fill: CREAM }))

  // ── Deux colonnes de plats, les suppléments au pied de la seconde ─────────
  const gap = 8
  const colW = (CONTENT_W - gap) / 2
  const colsY = tY + tH + 7
  const colEnds: number[] = []
  MENU.forEach((sections, c) => {
    const x = M + c * (colW + gap)
    let y = colsY
    for (const s of sections) {
      parts.push(sectionTitle(x, y, colW, s.title))
      y += 6.2
      for (const it of s.items) {
        const nameSize = 3.1
        if (widthOf(it.name, nameSize) + widthOf(dt(it.price), 3.1, true) > colW) {
          console.warn(`  ⚠ « ${it.name} » risque de toucher son prix`)
        }
        parts.push(text(x, y, it.name, { size: nameSize, bold: true, fill: '#FFFFFF' }))
        parts.push(text(x + colW, y, dt(it.price), { size: 3.1, black: true, anchor: 'end', fill: AMBER }))
        if (it.desc) {
          parts.push(text(x, y + 3.5, it.desc, { size: 2.35, fill: MUTED }))
          y += 7.8
        } else {
          y += 5.2
        }
      }
      y += 2.6
    }
    colEnds.push(y)
  })

  // Suppléments : deux sous-colonnes de cinq sous la colonne de droite.
  const supX = M + colW + gap
  const supY = colEnds[1]
  parts.push(sectionTitle(supX, supY, colW, 'SUPPLÉMENTS'))
  const half = Math.ceil(EXTRAS.length / 2)
  const subW = (colW - 5) / 2
  EXTRAS.forEach((e, i) => {
    const x = supX + Math.floor(i / half) * (subW + 5)
    const y = supY + 6 + (i % half) * 4.4
    parts.push(text(x, y, e.name, { size: 2.5, fill: CREAM }))
    parts.push(text(x + subW, y, `+${e.price}`, { size: 2.5, black: true, anchor: 'end', fill: AMBER }))
  })

  // ── Bandeau final : commander ─────────────────────────────────────────────
  const bandH = 24
  const bandY = TRIM_H - bandH
  const qrMm = 17
  const usedTo = Math.max(colEnds[0], supY + 6 + (half - 1) * 4.4 + 1)
  if (usedTo > bandY - 2) console.warn(`  ⚠ la carte déborde sur le bandeau (${usedTo.toFixed(1)} > ${bandY - 2} mm)`)
  // Le bandeau descend dans le fond perdu : il est coupé net au massicot.
  parts.push(`<rect x="0" y="${at(bandY)}" width="${W}" height="${H - at(bandY)}" fill="${AMBER}"/>`)
  parts.push(rect(M, bandY + 3.5, qrMm, qrMm, '#FFFFFF', 1.8))
  const tx = M + qrMm + 5
  parts.push(text(tx, bandY + 9, `−${percent}% en commandant en ligne`, { size: 4.4, black: true, fill: INK }))
  parts.push(text(tx, bandY + 14.4, url, { size: 3.6, black: true, fill: INK }))
  parts.push(
    text(tx, bandY + 19, `${prettyPhone(SITE.phone)}  ·  ${SITE.location}`, { size: 2.8, bold: true, fill: INK, opacity: 0.75 }),
  )

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  ${background()}
  ${parts.join('\n  ')}
</svg>`

  const [logo, code] = await Promise.all([roundLogo(px(logoMm)), qr(px(qrMm - 2))])
  await render(
    svg,
    [
      { input: logo, left: at(TRIM_W - M - logoMm), top: at(M - 1.5) },
      { input: code, left: at(M + 1), top: at(bandY + 3.5 + 1) },
    ],
    'flyer-a5-verso.png',
  )
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })
  await recto()
  await verso()
  console.log(`  ${W} × ${H} px — A5 ${TRIM_W} × ${TRIM_H} mm + ${BLEED} mm de fond perdu, ${DPI} dpi`)
  console.log(`  QR → ${QR_TARGET}`)
  if (!process.env.NEXT_PUBLIC_SITE_URL) {
    console.warn(`  ⚠ NEXT_PUBLIC_SITE_URL absente de .env — repli sur ${SITE_URL}`)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
