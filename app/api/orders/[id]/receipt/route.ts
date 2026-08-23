import { NextRequest } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { Order } from '@/lib/models/Order'
import { ORDER_SOURCE_SHORT, isOrderSource } from '@/lib/orderSource'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

type SupplementLike = { name?: { fr?: string; ar?: string }; price?: number }
type ItemLike = {
  productName?: { fr?: string; ar?: string } | string
  quantity?: number
  unitPrice?: number
  supplements?: SupplementLike[]
  notes?: string
}

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function productName(name: ItemLike['productName']): string {
  if (name && typeof name === 'object') return name.fr || name.ar || '—'
  return String(name ?? '—')
}

/**
 * GET /api/orders/[id]/receipt
 *
 * Returns a self-contained 80mm thermal receipt as printable HTML that
 * auto-triggers the browser print dialog on load. Opened in a real browser
 * (system browser on Android via @capacitor/browser, or a new tab on web) so
 * printing works reliably — the in-app WebView does not support window.print().
 *
 * Public (no auth) — consistent with the existing public GET /api/orders/[id];
 * receipts carry no sensitive data beyond the order itself.
 */
export async function GET(req: NextRequest, { params }: Ctx) {
  await connectDB()
  const { id } = await params
  const order = await Order.findById(id).lean() as Record<string, unknown> | null
  if (!order) {
    return new Response('<h1>Commande introuvable</h1>', {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  const { searchParams } = new URL(req.url)
  const prepParam = searchParams.get('prep')
  const autoprint = searchParams.get('autoprint') !== '0'

  const customer = (order.customer ?? {}) as { name?: string; phone?: string; address?: string }
  const items = (order.items ?? []) as ItemLike[]
  const type = order.type as string
  const source = order.source
  const orderNumber = String(order.orderNumber ?? '')
  const total = Number(order.total ?? 0)
  const subtotal = Number(order.subtotal ?? total)
  // Absent on orders taken before the online promo existed.
  const discount = (order.discount ?? {}) as { label?: string; rate?: number; amount?: number }
  const discountAmount = Number(discount.amount ?? 0)
  const notes = order.notes as string | undefined
  const prepMinutes = prepParam ? Number(prepParam) : Number(order.preparationDuration ?? 0)

  // ── Paper width ────────────────────────────────────────────────────────
  // `width` is the printable width in millimetres, not the roll width: a 58mm
  // roll (POS-58) prints 48mm, an 80mm roll (POS-80) prints 72mm. Laying the
  // ticket out any wider than that is what makes a thermal printer shear the
  // right-hand side off every line. Defaults to the 80mm roll, which is what
  // the browser-print path has always assumed.
  const widthParam = Number(searchParams.get('width'))
  const paperMm = Number.isFinite(widthParam) && widthParam >= 30 && widthParam <= 120
    ? Math.round(widthParam)
    : 72

  // `page` is the sheet the *driver* believes it has — the full roll width.
  // Many POS-58 drivers expose only fixed paper sizes, so a custom 48mm page is
  // refused, the driver substitutes its own 58mm paper, and the 48mm layout is
  // scaled up 20% to fill it — which shoves the right fifth of every line past
  // the 48mm print head. Asking for the sheet the driver already has means no
  // scaling, and the ink stays inside the printable band.
  const pageParam = Number(searchParams.get('page'))
  const pageMm = Number.isFinite(pageParam) && pageParam >= paperMm && pageParam <= 130
    ? Math.round(pageParam)
    : paperMm

  // Below ~64mm the display type has to come down or every heading wraps and
  // the wrapped half falls off the paper. Scaling everything linearly would
  // push body text under the point where thermal dots stay legible, so the two
  // sets are tuned rather than derived.
  const narrow = paperMm < 64
  const S = narrow
    ? { body: 12, brand: 16, ord: 13, mode: 13, tot: 15, small: 11, tiny: 11, micro: 9, track: 0.5, qty: 20, price: 46, pad: '3px 3px 16px' }
    : { body: 13, brand: 22, ord: 17, mode: 15, tot: 17, small: 12, tiny: 11, micro: 9, track: 2, qty: 24, price: 60, pad: '4px 6px 20px' }

  // On screen the ticket is shown at its true paper width so what you see is
  // what the roll gets. 1mm = 96/25.4 CSS px.
  const screenMax = Math.round(paperMm * (96 / 25.4))

  const now = new Date()
  const dateStr = now.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const typeLabel = type === 'delivery' ? 'LIVRAISON' : 'A EMPORTER'
  // Where the order was punched in. Left off entirely on tickets predating
  // the field rather than guessed at — a wrong origin on a ticket is worse
  // than none. Accent-free labels: thermal fonts render them more reliably.
  const originHtml = isOrderSource(source)
    ? `<div class="origin">Origine : ${ORDER_SOURCE_SHORT[source]}</div>`
    : ''

  const rows = items.map(item => {
    const name = esc(productName(item.productName))
    const qty = Number(item.quantity ?? 1)
    const unit = Number(item.unitPrice ?? 0)
    const suppTotal = (item.supplements ?? []).reduce((a, x) => a + Number(x.price ?? 0), 0)
    const lineTotal = (unit + suppTotal) * qty
    const suppList = (item.supplements ?? [])
      .filter(s => s.name?.fr || s.name?.ar)
      .map(s => `+ ${esc(s.name?.fr ?? s.name?.ar)}${Number(s.price) > 0 ? ` (${Number(s.price).toFixed(2)})` : ''}`)
      .join('<br>')
    // Supplements get their own full-width rows rather than living inside the
    // narrow name column: on a 48mm roll that column is ~16 characters, so
    // "+ Fromage Gruyere (2.50)" wrapped onto three ragged lines. Indented one
    // cell, they still read as belonging to the item above.
    const cells = [
      `<td class="qty">x${qty}</td><td class="name">${name}</td><td class="price">${lineTotal.toFixed(2)}</td>`,
    ]
    if (suppList) cells.push(`<td></td><td class="supp" colspan="2">${suppList}</td>`)
    if (item.notes) cells.push(`<td></td><td class="note" colspan="2">"${esc(item.notes)}"</td>`)

    return cells
      .map((c, i) => `<tr${i === cells.length - 1 ? ' class="gap"' : ''}>${c}</tr>`)
      .join('')
  }).join('')

  const addrHtml = type === 'delivery' && customer.address
    ? `<tr><td class="lbl">ADRESSE</td><td class="val addr">${esc(customer.address)}</td></tr>` : ''
  const notesHtml = notes ? `<hr class="dash"><div class="notesbox">NOTE: ${esc(notes)}</div>` : ''
  const prepHtml = prepMinutes
    ? `<div class="prep-row"><span class="prep-lbl">Temps de preparation</span><span class="prep-val">${prepMinutes >= 60 ? `${Math.floor(prepMinutes / 60)}h${prepMinutes % 60 ? ` ${prepMinutes % 60}min` : ''}` : `${prepMinutes} min`}</span></div>` : ''

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Commande #${esc(orderNumber)}</title><style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:Arial,Helvetica,sans-serif;font-size:${S.body}px;padding:10px 10px 28px;color:#000;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;max-width:${screenMax}px;margin:0 auto;overflow-wrap:anywhere}
    .brand{font-size:${S.brand}px;font-weight:900;text-align:center;letter-spacing:${S.track}px;margin-bottom:2px}.tagline{font-size:${S.tiny}px;text-align:center;font-weight:600}
    .dash{border:none;border-top:1.5px dashed #000;margin:7px 0}.ordnum{font-size:${S.ord}px;font-weight:900;text-align:center;letter-spacing:${S.track}px;margin:5px 0 2px}
    .ordlbl{font-size:${S.micro}px;font-weight:700;text-align:center;letter-spacing:2px;text-transform:uppercase;margin-top:5px}
    .datetime{font-size:${S.small}px;text-align:center;font-weight:600;margin-bottom:5px}.mode{font-size:${S.mode}px;font-weight:900;text-align:center;border:2px solid #000;padding:5px 0;margin:7px 0;letter-spacing:${S.track}px}
    .origin{font-size:${S.micro}px;font-weight:700;text-align:center;letter-spacing:1px;text-transform:uppercase;margin:-3px 0 4px}
    .info-table{width:100%;border-collapse:collapse;margin:3px 0;table-layout:fixed}.lbl{font-size:${S.micro}px;padding-bottom:1px;font-weight:700;letter-spacing:1px;text-transform:uppercase}
    .val{font-size:${S.body}px;font-weight:700;padding-bottom:5px}.addr{font-size:${S.small}px;font-weight:600;line-height:1.45;word-break:break-word}
    .section-head{font-size:${S.micro}px;font-weight:900;letter-spacing:2px;text-transform:uppercase;margin:7px 0 4px}
    table.items{width:100%;border-collapse:collapse;table-layout:fixed}.qty{width:${S.qty}px;vertical-align:top;font-weight:900;font-size:${S.body}px;padding-right:5px;white-space:nowrap}
    .name{vertical-align:top;font-size:${S.body}px;font-weight:700;line-height:1.4;word-break:break-word}.price{text-align:right;vertical-align:top;white-space:nowrap;padding-left:5px;font-weight:800;font-size:${S.body}px;width:${S.price}px}
    td{padding-bottom:2px}table.items tr.gap td{padding-bottom:8px}
    .supp{font-size:${S.tiny}px;font-weight:600;line-height:1.5}.note{font-size:${S.tiny}px;font-weight:600;font-style:italic;line-height:1.5}
    .tot-label{font-size:${S.tot}px;font-weight:900;padding-top:4px}.tot-val{font-size:${S.tot}px;font-weight:900;text-align:right;padding-top:4px;white-space:nowrap}
    .notesbox{border:1.5px dashed #000;padding:6px 8px;font-size:${S.small}px;font-weight:600;font-style:italic;line-height:1.5;margin:5px 0;word-break:break-word}
    .thanks{font-size:${S.small}px;font-weight:600;text-align:center;margin-top:10px;letter-spacing:${narrow ? 0 : 0.5}px}
    .prep-row{display:flex;justify-content:space-between;align-items:center;gap:6px;border:1.5px solid #000;border-radius:3px;padding:5px 8px;margin:6px 0}.prep-lbl{font-size:${S.small}px;font-weight:700}.prep-val{font-size:${S.mode}px;font-weight:900;white-space:nowrap}
    .printbtn{display:block;width:100%;margin:16px 0 0;padding:14px;border:none;border-radius:10px;background:#F5A800;color:#1C1200;font-size:16px;font-weight:800;cursor:pointer}
    @media print{@page{size:${pageMm}mm auto;margin:0}html{width:100%}body{width:${paperMm}mm;max-width:${paperMm}mm;margin:0;padding:${S.pad}}.printbtn{display:none}}
  </style></head><body>
    <div class="brand">MR. BURRITOS</div><div class="tagline">Gestionnaire de commandes</div><hr class="dash">
    <!-- "COMMANDE #MB-20260822-0082" runs to 26 characters and wraps mid-number
         on any roll; the half that wraps is the half you actually read. Split
         into a label and the number, it stays on one line at every width. -->
    <div class="ordlbl">Commande</div><div class="ordnum">${esc(orderNumber)}</div>
    <div class="datetime">${dateStr} a ${timeStr}</div>
    <div class="mode">${narrow ? typeLabel : `&gt;&gt;&gt; ${typeLabel} &gt;&gt;&gt;`}</div>${originHtml}${prepHtml}<hr class="dash">
    <table class="info-table"><tbody><tr><td><div class="lbl">CLIENT</div><div class="val">${esc(customer.name)}</div></td>
    <td style="text-align:right"><div class="lbl">TEL</div><div class="val">${esc(customer.phone)}</div></td></tr>${addrHtml}</tbody></table><hr class="dash">
    <div class="section-head">Articles commandes</div><table class="items"><tbody>${rows}</tbody></table><hr class="dash">
    <table style="width:100%"><tbody>${discountAmount > 0 ? `<tr><td class="tot-label" style="font-weight:400">SOUS-TOTAL</td><td class="tot-val" style="font-weight:400">${subtotal.toFixed(2)} DT</td></tr><tr><td class="tot-label" style="font-weight:400">${esc(discount.label || 'REMISE')}${discount.rate ? ` (-${Math.round(discount.rate * 100)}%)` : ''}</td><td class="tot-val" style="font-weight:400">-${discountAmount.toFixed(2)} DT</td></tr>` : ''}<tr><td class="tot-label">TOTAL</td><td class="tot-val">${total.toFixed(2)} DT</td></tr></tbody></table>
    ${notesHtml}<hr class="dash"><div class="thanks">Merci pour votre commande !</div>
    <button class="printbtn" onclick="window.print()">🖨️ Imprimer</button>
    ${autoprint ? '<script>window.addEventListener("load",function(){setTimeout(function(){window.print()},350)})</script>' : ''}
  </body></html>`

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
