import { connectDB } from '@/lib/mongodb'
import { Order, Product, Category, Reservation } from '@/lib/models/index'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ShoppingBag, UtensilsCrossed, Tag, CalendarDays } from 'lucide-react'

async function getStats() {
  await connectDB()
  const [orders, products, categories, reservations, todayOrders] = await Promise.all([
    Order.countDocuments(),
    Product.countDocuments({ isActive: true }),
    Category.countDocuments({ isActive: true }),
    Reservation.countDocuments(),
    Order.find({ createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } }),
  ])
  const todayRevenue = todayOrders.reduce((s, o) => s + (o.total || 0), 0)
  const pendingOrders = await Order.countDocuments({ status: 'pending' })
  return { orders, products, categories, reservations, todayRevenue, pendingOrders }
}

export default async function DashboardPage() {
  const stats = await getStats()

  const cards = [
    { title: 'Commandes du jour', value: `${stats.todayRevenue.toFixed(2)} DT`, icon: ShoppingBag, color: 'text-[#F5A800]' },
    { title: 'En attente', value: stats.pendingOrders, icon: ShoppingBag, color: 'text-red-500' },
    { title: 'Produits actifs', value: stats.products, icon: UtensilsCrossed, color: 'text-blue-500' },
    { title: 'Catégories', value: stats.categories, icon: Tag, color: 'text-green-500' },
    { title: 'Total commandes', value: stats.orders, icon: ShoppingBag, color: 'text-purple-500' },
    { title: 'Réservations', value: stats.reservations, icon: CalendarDays, color: 'text-orange-500' },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Tableau de bord</h1>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
              <card.icon size={18} className={card.color} />
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
