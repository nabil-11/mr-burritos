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
                    <OrderActions orderId={String(order._id)} currentStatus={status} />
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
