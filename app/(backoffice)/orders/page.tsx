import { connectDB } from '@/lib/mongodb'
import { Order } from '@/lib/models/Order'
import { Badge } from '@/components/ui/badge'
import OrderActions from './OrderActions'
import Link from 'next/link'

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  preparing: 'bg-orange-100 text-orange-800',
  ready: 'bg-purple-100 text-purple-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
}

const statusLabels: Record<string, string> = {
  pending: 'En attente', confirmed: 'Confirmée', preparing: 'En préparation',
  ready: 'Prête', delivered: 'Livrée', cancelled: 'Annulée',
}

function buildWhatsAppUrl(order: Record<string, unknown>): string {
  const raw = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? ''
  const phone = raw.replace(/\D/g, '') // strip non-digits, e.g. "+216..." → "216..."
  const customer = order.customer as Record<string, string>
  const typeLabel = order.type === 'delivery' ? 'Livraison' : 'À emporter'
  const text =
    `🌯 Nouvelle commande!\n` +
    `Numéro: ${order.orderNumber}\n` +
    `Type: ${typeLabel}\n` +
    `Client: ${customer.name ?? ''}${customer.phone ? ` (${customer.phone})` : ''}\n` +
    `Total: ${(order.total as number).toFixed(2)} DT`
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
}

export default async function OrdersPage() {
  await connectDB()
  const orders = await Order.find().sort({ createdAt: -1 }).limit(50).lean()

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
        <table className="w-full text-sm min-w-175">
          <thead className="bg-gray-50 border-b">
            <tr>
              {['N° Commande', 'Client', 'Type', 'Total', 'Statut', 'Date', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {(orders as Record<string, unknown>[]).map((order) => {
              const customer = order.customer as Record<string, string>
              const status = String(order.status)
              return (
                <tr key={String(order._id)} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-bold text-xs">{String(order.orderNumber)}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{customer.name}</p>
                    <p className="text-xs text-muted-foreground">{customer.phone}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{order.type === 'delivery' ? '🛵 Livraison' : '🏠 À emporter'}</Badge>
                    {(() => {
                      const dc = order.deliveryCompany as Record<string, string | number> | null | undefined
                      if (order.type === 'delivery' && dc?.name) {
                        return (
                          <p className="text-[10px] text-orange-600 font-bold mt-1">
                            {String(dc.name)} ({String(dc.commission)}%)
                          </p>
                        )
                      }
                    })()}
                  </td>
                  <td className="px-4 py-3 font-bold text-[#F5A800]">{(order.total as number).toFixed(2)} DT</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[status] || ''}`}>
                      {statusLabels[status] || status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(order.createdAt as string).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <OrderActions orderId={String(order._id)} currentStatus={status} />
                      <a
                        href={buildWhatsAppUrl(order)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Envoyer sur WhatsApp"
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-green-500 hover:bg-green-600 text-white transition-colors"
                      >
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                      </a>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
        {orders.length === 0 && (
          <p className="text-center text-muted-foreground py-10">Aucune commande</p>
        )}
      </div>
    </div>
  )
}
