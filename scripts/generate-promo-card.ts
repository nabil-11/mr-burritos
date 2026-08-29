/**
 * Mr. Burritos — Carte promo à glisser dans le sac de livraison
 * Lance avec : npm run promo-card
 *
 * Produit `affiches/carte-promo.png`, une carte de visite 85 × 55 mm à 300 dpi,
 * prête à envoyer à l'imprimeur : logo, remise en ligne, QR vers le site.
 *
 * C'est un script, pas un fichier Photoshop, pour une seule raison : le taux de
 * la remise et l'adresse du site changent. Le jour où `WEB_PROMO.rate` passe à
 * 10 %, on relance le script et la carte suit — au lieu de faire circuler
 * pendant un an un carton qui promet 15 % que la caisse ne fait plus.
 *
 * Le rendu est fait par sharp (SVG pour la mise en page, composition bitmap
 * pour le logo et le QR). Pas de navigateur, donc pas de police téléchargée :
 * on ne s'appuie que sur Arial, présent sur la machine qui imprime comme sur
 * celle qui génère.
 */

import 'dotenv/config'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import QRCode from 'qrcode'
import sharp from 'sharp'
import { WEB_PROMO } from '../lib/promo'
import { promoDisplayUrl, promoTargetUrl } from '../lib/receiptPromoCard'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://mrburritos.tn'
const OUT = resolve(process.cwd(), 'affiches/carte-promo.png')
const LOGO = resolve(process.cwd(), 'public/logo.jpg')
const PHOTO = resolve(process.cwd(), 'public/hero-banner.jpg')

/**
 * Le fond : quatre produits découpés dans la bannière du site.
 *
 * Les coordonnées sont relevées à la main sur `public/hero-banner.jpg`
 * (1600 × 843) — si cette image est remplacée un jour, ces quatre cadres
 * tombent à côté et il faut les reprendre. C'est le prix à payer pour ne pas
 * embarquer quatre fichiers de plus dans le dépôt.
 *
 * Le choix des plats n'est pas décoratif : le bowl (avocat, légumes) porte la
 * promesse « healthy », les trois autres portent la carte.
 */
const TILES = [
  { name: 'bowl', left: 0, top: 390, width: 390, height: 253 },
  { name: 'tacos', left: 380, top: 545, width: 460, height: 298 },
  { name: 'burger', left: 855, top: 545, width: 420, height: 272 },
  { name: 'burrito', left: 1215, top: 165, width: 385, height: 250 },
]

/** 300 dpi : la résolution en dessous de laquelle un aplat imprimé se voit. */
const DPI = 300
const mm = (v: number) => Math.round((v * DPI) / 25.4)

/** Format carte de visite standard — les imprimeurs le massicotent les yeux fermés. */
const W = mm(85)
const H = mm(55)
/** Marge de sécurité : rien de lisible ne descend en dessous. */
const PAD = mm(4)

// Couleurs relevées sur le logo, pas inventées : la carte doit avoir l'air
// d'être sortie de la même boîte que l'enseigne.
const INK = '#141210'
const AMBER = '#F5A800'
const CREAM = '#F7EFDF'
const MUTED = '#A2957E'

/**
 * Le badge du logo est un disque posé sur un fond blanc dans le JPEG d'origine.
 * On le découpe au cercle : sur un fond noir, le carré blanc se verrait.
 */
async function roundLogo(size: number): Promise<Buffer> {
  const cx = 625
  const cy = 392
  const r = 330
  // Deux passes : sharp applique toujours `composite` après `resize`, donc un
  // masque taillé pour le découpage d'origine arriverait trop grand.
  const square = await sharp(LOGO)
    .extract({ left: cx - r, top: cy - r, width: r * 2, height: r * 2 })
    .resize(size, size)
    .png()
    .toBuffer()
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`,
  )
  return sharp(square).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer()
}

/**
 * La mosaïque de fond : les quatre produits en quadrants.
 *
 * Ils viennent tous de la même prise de vue, sur le même orange, donc les
 * raccords ne se voient pas — c'est ce qui permet de coller quatre photos
 * bord à bord sans que ça ressemble à un collage.
 */
async function foodMosaic(width: number, height: number): Promise<Buffer> {
  const tw = Math.ceil(width / 2)
  const th = Math.ceil(height / 2)
  const tiles = await Promise.all(
    TILES.map(t =>
      sharp(PHOTO)
        .extract({ left: t.left, top: t.top, width: t.width, height: t.height })
        .resize(tw, th, { fit: 'cover' })
        .png()
        .toBuffer(),
    ),
  )
  return sharp({ create: { width, height, channels: 3, background: INK } })
    .composite(tiles.map((input, i) => ({ input, left: (i % 2) * tw, top: Math.floor(i / 2) * th })))
    .modulate({ brightness: 1.08, saturation: 1.18 })
    .png()
    .toBuffer()
}

/**
 * Corps de texte qui tient dans une largeur donnée.
 *
 * Arial Black avance d'environ 0,62 em par caractère. Sans ce calcul, le jour
 * où le domaine passe de `mrburritos.tn` à `mr-burritos.vercel.app`, l'adresse
 * s'en va tranquillement sous le texte de droite du bandeau.
 */
function fitFontSize(text: string, budget: number, max: number): number {
  return Math.max(1, Math.min(max, Math.floor(budget / (0.62 * text.length))))
}

async function main() {
  const percent = Math.round(WEB_PROMO.rate * 100)

  // ── Géométrie ────────────────────────────────────────────────────────────
  // Tout est posé en millimètres, y compris les corps de texte : c'est la seule
  // façon de vérifier sur l'écran ce que le massicot rendra sur le carton.
  const barH = mm(9) // bandeau adresse, en pied de carte
  const barY = H - barH
  const panel = mm(30) // carré blanc qui porte le QR
  const panelX = W - PAD - panel
  const panelY = mm(4)
  const qrSize = mm(25) // le QR lui-même, marge de silence comprise
  const logoSize = mm(11)
  /** Le texte de gauche s'arrête ici : au-delà, il passerait sous le QR. */
  const colX = PAD + logoSize + mm(2)

  const url = promoDisplayUrl(SITE_URL)
  /** Le bandeau doit garder de la place à droite pour la mention automatique. */
  const urlSize = fitFontSize(url, W * 0.54, mm(3.8))

  // La ligne produits passe sous le logo plutôt qu'à côté du nom : à côté, elle
  // butait sur le QR dès qu'on y ajoutait une catégorie. Ici elle a toute la
  // largeur de la carte, et le corps se règle sur ce qu'il reste à remplir.
  const tagline = 'TACOS · BURRITOS · BURGERS · BOWLS'
  const taglineSize = fitFontSize(tagline, panelX - PAD - mm(4), mm(2.4))

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <!-- Voile sombre sur la photo. Il s'allège vers la droite, là où il n'y a
         que le QR sur fond blanc : les plats restent lisibles de ce côté et le
         texte garde son contraste de l'autre. -->
    <linearGradient id="scrim" x1="0" y1="0" x2="1" y2="0.3">
      <stop offset="0" stop-color="${INK}" stop-opacity="0.95"/>
      <stop offset="0.5" stop-color="${INK}" stop-opacity="0.86"/>
      <stop offset="1" stop-color="${INK}" stop-opacity="0.62"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#scrim)"/>

  <!-- Identité -->
  <text x="${colX}" y="${mm(9.4)}" font-family="Arial Black, Arial, sans-serif"
        font-size="${mm(3.6)}" font-weight="900" fill="${CREAM}" letter-spacing="0.5">MR. BURRITOS</text>
  <text x="${PAD}" y="${mm(16.2)}" font-family="Arial, sans-serif"
        font-size="${taglineSize}" font-weight="bold" fill="${MUTED}" letter-spacing="1.6">${tagline}</text>

  <!-- L'offre -->
  <text x="${PAD}" y="${mm(28)}" font-family="Arial Black, Arial, sans-serif"
        font-size="${mm(11)}" font-weight="900" fill="${AMBER}" letter-spacing="-2">−${percent}%</text>
  <text x="${PAD}" y="${mm(34)}" font-family="Arial, sans-serif" font-size="${mm(2.6)}"
        font-weight="bold" fill="${CREAM}" letter-spacing="1.1">SUR VOTRE PROCHAINE</text>
  <text x="${PAD}" y="${mm(37.6)}" font-family="Arial, sans-serif" font-size="${mm(2.6)}"
        font-weight="bold" fill="${CREAM}" letter-spacing="1.1">COMMANDE EN LIGNE</text>

  <!-- Support du QR. Le blanc est imposé par le scan ; le décalage ambre en fait
       un objet posé sur la carte plutôt qu'un trou dans le noir. -->
  <rect x="${panelX + mm(1.2)}" y="${panelY + mm(1.2)}" width="${panel}" height="${panel}"
        rx="${mm(2)}" fill="${AMBER}"/>
  <rect x="${panelX}" y="${panelY}" width="${panel}" height="${panel}" rx="${mm(2)}" fill="#FFFFFF"/>
  <text x="${panelX + panel / 2}" y="${mm(40.5)}" text-anchor="middle"
        font-family="Arial, sans-serif" font-size="${mm(2.4)}" font-weight="bold"
        fill="${AMBER}" letter-spacing="1.8">SCANNEZ-MOI</text>

  <!-- Bandeau adresse -->
  <rect x="0" y="${barY}" width="${W}" height="${barH}" fill="${AMBER}"/>
  <text x="${PAD}" y="${barY + mm(6.3)}" font-family="Arial Black, Arial, sans-serif"
        font-size="${urlSize}" font-weight="900" fill="${INK}">${url}</text>
  <text x="${W - PAD}" y="${barY + mm(6)}" text-anchor="end" font-family="Arial, sans-serif"
        font-size="${mm(2)}" font-weight="bold" fill="${INK}" letter-spacing="1"
        opacity="0.72">REMISE AUTOMATIQUE</text>
</svg>`

  const [background, logo, qr] = await Promise.all([
    foodMosaic(W, H),
    roundLogo(logoSize),
    QRCode.toBuffer(promoTargetUrl(SITE_URL), {
      type: 'png',
      errorCorrectionLevel: 'M',
      margin: 1,
      width: qrSize,
      color: { dark: '#141210ff', light: '#ffffffff' },
    }),
  ])

  mkdirSync(dirname(OUT), { recursive: true })
  const png = await sharp(background)
    .composite([
      { input: Buffer.from(svg), left: 0, top: 0 },
      { input: logo, left: PAD, top: mm(3.6) },
      {
        input: qr,
        left: panelX + Math.round((panel - qrSize) / 2),
        top: panelY + Math.round((panel - qrSize) / 2),
      },
    ])
    .withMetadata({ density: DPI })
    .png()
    .toBuffer()

  writeFileSync(OUT, png)
  console.log(`Carte écrite : ${OUT}`)
  console.log(`  ${W} × ${H} px — 85 × 55 mm à ${DPI} dpi`)
  console.log(`  QR → ${promoTargetUrl(SITE_URL)}`)
  if (!process.env.NEXT_PUBLIC_SITE_URL) {
    console.warn(`  ⚠ NEXT_PUBLIC_SITE_URL absente de .env — repli sur ${SITE_URL}`)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
