/**
 * The "order online, save 15%" card printed at the foot of a ticket.
 *
 * It exists for one job: turn a delivery order — food that leaves the shop
 * without the customer ever seeing a screen — into the next website order.
 * The card carries a QR to the site and states the standing online discount,
 * so the paper in the bag is the acquisition channel.
 *
 * The percentage is never written by hand here: it is read off `WEB_PROMO`,
 * the same constant the cart charges against, so the promise on the ticket and
 * the money taken off at checkout cannot drift apart.
 *
 * Rendered as inline SVG rather than a bitmap. A thermal head prints one dot
 * per module edge from vector art at whatever the driver's real resolution is;
 * a scaled PNG lands modules on half-dots and greys the edges, which is the
 * usual reason a printed QR will not scan.
 */

import QRCode from 'qrcode'
import { WEB_PROMO } from './promo'

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Tags the visit so web analytics can tell a scan from a bookmark — i.e. tell
 * you whether the paper is actually paying for itself.
 */
export const TICKET_QR_PARAM = 'src=ticket'

/** What the QR encodes: the home page, tagged. */
export function promoTargetUrl(siteUrl: string): string {
  return `${siteUrl.replace(/\/+$/, '')}/?${TICKET_QR_PARAM}`
}

/**
 * What the human reads. The tracking parameter is deliberately dropped: it is
 * noise to someone typing the address in, and a URL nobody can retype by hand
 * is a QR with no fallback.
 */
export function promoDisplayUrl(siteUrl: string): string {
  return siteUrl.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '')
}

export interface PromoCardOptions {
  /** Site root, no trailing slash required, e.g. `https://mrburritos.tn`. */
  siteUrl: string
  /** The 48mm layout — same flag the ticket uses to pick its type scale. */
  narrow: boolean
  /**
   * True when this very order came from the site. The offer is unchanged, but
   * pitching "get 15% off online" to someone who just did is tone-deaf, so the
   * copy thanks them and points at the next order instead.
   */
  alreadyOnline?: boolean
  /** Dinars taken off this order. Only shown in the `alreadyOnline` copy. */
  saved?: number
}

/**
 * Returns the card's CSS and markup separately: the ticket keeps a single
 * `<style>` block, so styles cannot be handed back inline with the HTML.
 *
 * If the QR cannot be encoded the card still prints — the address and the
 * offer are the part that must not be lost, the QR is the convenience.
 */
export async function renderWebPromoCard(
  opts: PromoCardOptions,
): Promise<{ css: string; html: string }> {
  const { siteUrl, narrow, alreadyOnline = false, saved = 0 } = opts
  const percent = Math.round(WEB_PROMO.rate * 100)

  // 26mm is about the floor for a reliable scan off a 203dpi thermal head at
  // arm's length; below that the modules start merging as the paper ages.
  const qrMm = narrow ? 26 : 30

  let qrSvg = ''
  try {
    qrSvg = await QRCode.toString(promoTargetUrl(siteUrl), {
      type: 'svg',
      errorCorrectionLevel: 'M',
      // Quiet zone in modules. Without it a scanner has no edge to lock onto,
      // and on a ticket the surrounding text is right there to confuse it.
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    })
  } catch {
    qrSvg = ''
  }

  const css = `
    .promo{border:2px solid #000;border-radius:4px;padding:${narrow ? '7px 5px 6px' : '9px 8px 8px'};margin:9px 0 0;text-align:center}
    .promo-kicker{font-size:9px;font-weight:900;letter-spacing:2px;text-transform:uppercase}
    .promo-deal{font-size:${narrow ? 26 : 32}px;font-weight:900;line-height:1;margin:2px 0 1px;letter-spacing:-1px}
    .promo-sub{font-size:${narrow ? 11 : 12}px;font-weight:800;line-height:1.3;text-transform:uppercase;letter-spacing:0.5px}
    .promo-qr{width:${qrMm}mm;height:${qrMm}mm;margin:${narrow ? 5 : 6}px auto 4px;background:#fff}
    .promo-qr svg{width:100%;height:100%;display:block}
    .promo-url{font-size:${narrow ? 11 : 12}px;font-weight:900;letter-spacing:0.5px;word-break:break-all}
    .promo-foot{font-size:9px;font-weight:600;line-height:1.4;margin-top:3px}`

  // Accent-free, like the rest of the ticket: thermal fonts drop or box
  // accented glyphs often enough that it is not worth the risk.
  const sub = alreadyOnline
    ? 'A chaque commande sur notre site'
    : 'Sur votre prochaine commande'
  const foot = alreadyOnline && saved > 0
    ? `Vous avez economise ${saved.toFixed(2)} DT sur cette commande. Scannez pour la prochaine !`
    : `Scannez le code : la remise de ${percent}% est appliquee automatiquement sur le site.`

  const html = `<div class="promo">
    <div class="promo-kicker">Commandez en ligne</div>
    <div class="promo-deal">-${percent}%</div>
    <div class="promo-sub">${esc(sub)}</div>
    ${qrSvg ? `<div class="promo-qr">${qrSvg}</div>` : ''}
    <div class="promo-url">${esc(promoDisplayUrl(siteUrl))}</div>
    <div class="promo-foot">${esc(foot)}</div>
  </div>`

  return { css, html }
}
