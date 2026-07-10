import { NextRequest } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { Order } from '@/lib/models/Order'

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
  const orderNumber = String(order.orderNumber ?? '')
  const total = Number(order.total ?? 0)
  const notes = order.notes as string | undefined
  const prepMinutes = prepParam ? Number(prepParam) : Number(order.preparationDuration ?? 0)

  const now = new Date()
  const dateStr = now.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const typeLabel = type === 'delivery' ? 'LIVRAISON' : 'A EMPORTER'

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
    const suppHtml = suppList ? `<div class="supp">${suppList}</div>` : ''
    const noteHtml = item.notes ? `<div class="note">"${esc(item.notes)}"</div>` : ''
    return `<tr><td class="qty">x${qty}</td><td class="name">${name}${suppHtml}${noteHtml}</td><td class="price">${lineTotal.toFixed(2)}</td></tr>`
  }).join('')

  const addrHtml = type === 'delivery' && customer.address
    ? `<tr><td class="lbl">ADRESSE</td><td class="val addr">${esc(customer.address)}</td></tr>` : ''
  const notesHtml = notes ? `<hr class="dash"><div class="notesbox">NOTE: ${esc(notes)}</div>` : ''
  const prepHtml = prepMinutes
    ? `<div class="prep-row"><span class="prep-lbl">Temps de preparation</span><span class="prep-val">${prepMinutes >= 60 ? `${Math.floor(prepMinutes / 60)}h${prepMinutes % 60 ? ` ${prepMinutes % 60}min` : ''}` : `${prepMinutes} min`}</span></div>` : ''

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Commande #${esc(orderNumber)}</title><style>
    *{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;font-size:13px;padding:10px 10px 28px;color:#000;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;max-width:380px;margin:0 auto}
    .brand{font-size:22px;font-weight:900;text-align:center;letter-spacing:2px;margin-bottom:2px}.tagline{font-size:10px;text-align:center;color:#444}
    .dash{border:none;border-top:1.5px dashed #000;margin:7px 0}.ordnum{font-size:17px;font-weight:900;text-align:center;letter-spacing:2px;margin:5px 0 2px}
    .datetime{font-size:11px;text-align:center;color:#333;margin-bottom:5px}.mode{font-size:15px;font-weight:900;text-align:center;border:2px solid #000;padding:5px 0;margin:7px 0;letter-spacing:1.5px}
    .info-table{width:100%;border-collapse:collapse;margin:3px 0}.lbl{font-size:9px;color:#555;padding-bottom:1px;font-weight:700;letter-spacing:1px;text-transform:uppercase}
    .val{font-size:13px;font-weight:700;padding-bottom:5px}.addr{font-size:12px;line-height:1.45;word-break:break-word}
    .section-head{font-size:9px;font-weight:900;letter-spacing:2px;text-transform:uppercase;margin:7px 0 4px;color:#444}
    table.items{width:100%;border-collapse:collapse}.qty{width:24px;vertical-align:top;font-weight:900;font-size:13px;padding-right:5px;white-space:nowrap}
    .name{vertical-align:top;font-size:13px;line-height:1.45;word-break:break-word}.price{text-align:right;vertical-align:top;white-space:nowrap;padding-left:5px;font-weight:800;font-size:13px;width:1%}
    td{padding-bottom:6px}.supp{font-size:10px;color:#444;margin-top:2px}.note{font-size:10px;color:#555;font-style:italic;margin-top:2px}
    .tot-label{font-size:17px;font-weight:900;padding-top:4px}.tot-val{font-size:17px;font-weight:900;text-align:right;padding-top:4px;white-space:nowrap}
    .notesbox{border:1.5px dashed #000;padding:6px 8px;font-size:12px;font-style:italic;line-height:1.5;margin:5px 0;word-break:break-word}
    .thanks{font-size:11px;text-align:center;margin-top:10px;letter-spacing:.5px}
    .prep-row{display:flex;justify-content:space-between;align-items:center;background:#f0f0f0;border:1.5px solid #000;border-radius:3px;padding:5px 8px;margin:6px 0}.prep-lbl{font-size:11px;font-weight:700}.prep-val{font-size:14px;font-weight:900}
    .printbtn{display:block;width:100%;margin:16px 0 0;padding:14px;border:none;border-radius:10px;background:#F5A800;color:#1C1200;font-size:16px;font-weight:800;cursor:pointer}
    @media print{@page{size:80mm auto;margin:0}html,body{width:100%;max-width:none;margin:0;padding:4px 6px 20px}.printbtn{display:none}}
  </style></head><body>
    <div class="brand">MR. BURRITOS</div><div class="tagline">Gestionnaire de commandes</div><hr class="dash">
    <div class="ordnum">COMMANDE #${esc(orderNumber)}</div><div class="datetime">${dateStr} a ${timeStr}</div>
    <div class="mode">&gt;&gt;&gt; ${typeLabel} &gt;&gt;&gt;</div>${prepHtml}<hr class="dash">
    <table class="info-table"><tbody><tr><td><div class="lbl">CLIENT</div><div class="val">${esc(customer.name)}</div></td>
    <td style="text-align:right"><div class="lbl">TEL</div><div class="val">${esc(customer.phone)}</div></td></tr>${addrHtml}</tbody></table><hr class="dash">
    <div class="section-head">Articles commandes</div><table class="items"><tbody>${rows}</tbody></table><hr class="dash">
    <table style="width:100%"><tbody><tr><td class="tot-label">TOTAL</td><td class="tot-val">${total.toFixed(2)} DT</td></tr></tbody></table>
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
