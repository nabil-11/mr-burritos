import { connectDB } from '@/lib/mongodb'
import { Order } from '@/lib/models/Order'
import '@/lib/models/User' // register User schema so populate('assignedDelivery') resolves
import OrderRow, { OrderListItem } from './OrderRow'
import Link from 'next/link'
import { orderSourceLabel } from '@/lib/orderSource'

type Doc = Record<string, unknown>

function buildWhatsAppUrl(order: Doc): string {
  const raw = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? ''
  const phone = raw.replace(/\D/g, '') // strip non-digits, e.g. "+216..." → "216..."
  const customer = order.customer as Record<string, string>
  const typeLabel = order.type === 'delivery' ? 'Livraison' : 'À emporter'
  const text =
    `🌯 Nouvelle commande!\n` +
    `Numéro: ${order.orderNumber}\n` +
    `Type: ${typeLabel}\n` +
    `Origine: ${orderSourceLabel(order.source)}\n` +
    `Client: ${customer.name ?? ''}${customer.phone ? ` (${customer.phone})` : ''}\n` +
    `Total: ${(order.total as number).toFixed(2)} DT`
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
}

/** French name of a bilingual { ar, fr } label, whichever half exists. */
function label(value: unknown): string {
  if (value && typeof value === 'object') {
    const l = value as { fr?: string; ar?: string }
    return l.fr || l.ar || ''
  }
  return String(value ?? '')
}

const num = (v: unknown, fallback = 0): number => (typeof v === 'number' ? v : fallback)
const str = (v: unknown): string => (typeof v === 'string' ? v : '')

const dateFr = (d: unknown): string =>
  d ? new Date(d as string).toLocaleDateString('fr-FR') : ''
const timeFr = (d: unknown): string =>
  d ? new Date(d as string).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''

/**
 * Flattens a mongo document into the plain, already-formatted shape the row
 * component takes. Dates are rendered here rather than in the browser so the
 * server and client markup agree, and ObjectIds never cross the boundary.
 */
function toListItem(order: Doc): OrderListItem {
  const customer = (order.customer ?? {}) as Record<string, unknown>
  const discount = (order.discount ?? {}) as Record<string, unknown>
  const company = (order.deliveryCompany ?? {}) as Record<string, unknown>
  const driver = (order.assignedDelivery ?? null) as Record<string, unknown> | null
  const items = (order.items ?? []) as Doc[]
  const discountAmount = num(discount.amount)

  return {
    id: String(order._id),
    orderNumber: str(order.orderNumber),
    type: str(order.type),
    source: str(order.source) || null,
    status: str(order.status),
    createdAtLabel: dateFr(order.createdAt),
    createdAtTime: timeFr(order.createdAt),
    confirmedAtLabel: order.confirmedAt ? `${dateFr(order.confirmedAt)} à ${timeFr(order.confirmedAt)}` : '',
    preparationDuration: num(order.preparationDuration),
    customer: {
      name: str(customer.name),
      phone: str(customer.phone),
      email: str(customer.email),
      address: str(customer.address),
      latitude: typeof customer.latitude === 'number' ? customer.latitude : null,
      longitude: typeof customer.longitude === 'number' ? customer.longitude : null,
    },
    items: items.map((item) => {
      const supplements = ((item.supplements ?? []) as Doc[]).map((s) => ({
        name: label(s.name),
        price: num(s.price),
      }))
      const quantity = num(item.quantity, 1)
      const unitPrice = num(item.unitPrice)
      const suppTotal = supplements.reduce((s, x) => s + x.price, 0)
      return {
        name: label(item.productName) || '—',
        quantity,
        unitPrice,
        supplements,
        notes: str(item.notes),
        lineTotal: (unitPrice + suppTotal) * quantity,
      }
    }),
    subtotal: num(order.subtotal, num(order.total)),
    discount: discountAmount > 0
      ? { label: str(discount.label), rate: num(discount.rate), amount: discountAmount }
      : null,
    deliveryFee: num(order.deliveryFee),
    total: num(order.total),
    deliveryCompany: str(company.name)
      ? { name: str(company.name), commission: num(company.commission) }
      : null,
    assignedDelivery: driver && str(driver.name)
      ? { name: str(driver.name), phone: str(driver.phone) }
      : null,
    reference: str(order.reference),
    notes: str(order.notes),
    whatsappUrl: buildWhatsAppUrl(order),
  }
}

export default async function OrdersPage() {
  await connectDB()
  const orders = await Order.find().sort({ createdAt: -1 }).limit(50)
    .populate('assignedDelivery', 'name phone')
    .lean()

  const rows = (orders as Doc[]).map(toListItem)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Commandes</h1>
        <Link href="/orders/new"
          className="inline-flex items-center gap-2 bg-[#F5A800] hover:bg-[#FF6B00] text-black font-bold px-4 py-2.5 rounded-xl text-sm transition-all hover:scale-105">
          + Nouvelle commande
        </Link>
      </div>
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-200">
          <thead className="bg-gray-50 border-b">
            <tr>
              {['N° Commande', 'Client', 'Type', 'Origine', 'Total', 'Statut', 'Date', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((order) => (
              <OrderRow key={order.id} order={order} />
            ))}
          </tbody>
        </table>
        </div>
        {rows.length === 0 && (
          <p className="text-center text-muted-foreground py-10">Aucune commande</p>
        )}
      </div>
    </div>
  )
}
