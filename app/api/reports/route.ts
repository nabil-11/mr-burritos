import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { Order } from '@/lib/models/Order'

export async function GET(req: NextRequest) {
  await connectDB()
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const dateFilter: Record<string, unknown> = {}
  if (from || to) {
    const range: Record<string, Date> = {}
    if (from) range.$gte = new Date(from)
    if (to) {
      const end = new Date(to)
      end.setHours(23, 59, 59, 999)
      range.$lte = end
    }
    dateFilter.createdAt = range
  }

  const orders = await Order.find({
    ...dateFilter,
    status: { $ne: 'cancelled' },
  }).lean()

  // Helper: net revenue for a single order (deducts commission for delivery orders)
  const orderNet = (o: (typeof orders)[0]): number => {
    const total = o.total || 0
    if (o.type === 'delivery') {
      const commission = (o.deliveryCompany as { commission?: number } | undefined)?.commission ?? 0
      return total * (1 - commission / 100)
    }
    return total
  }

  // Summary — gross total kept for reference, net used as the real revenue
  const totalRevenue = orders.reduce((s, o) => s + (o.total || 0), 0)
  const orderCount = orders.length

  // By type
  const delivery = orders.filter((o) => o.type === 'delivery')
  const pickup = orders.filter((o) => o.type === 'pickup')

  // By delivery company — net computed per-order using each order's stored commission rate
  const companyMap: Record<string, { count: number; revenue: number; netRevenue: number; commission: number }> = {}
  for (const o of delivery) {
    const dc = o.deliveryCompany as { name?: string; commission?: number } | undefined
    const name = dc?.name || 'Inconnue'
    const commission = dc?.commission ?? 0
    if (!companyMap[name]) companyMap[name] = { count: 0, revenue: 0, netRevenue: 0, commission }
    companyMap[name].count++
    companyMap[name].revenue += o.total || 0
    // Use this order's commission rate to compute net correctly
    companyMap[name].netRevenue += (o.total || 0) * (1 - commission / 100)
    // Keep the latest commission rate for display
    companyMap[name].commission = commission
  }
  const byDeliveryCompany = Object.entries(companyMap)
    .map(([name, d]) => ({
      name,
      count: d.count,
      revenue: d.revenue,
      commission: d.commission,
      net: d.netRevenue,
      commissionAmount: d.revenue - d.netRevenue,
    }))
    .sort((a, b) => b.revenue - a.revenue)

  // Top products (from pickup orders with items)
  const productMap: Record<string, { qty: number; revenue: number }> = {}
  for (const o of pickup) {
    const items = (o.items || []) as {
      productName: { fr: string } | string
      quantity: number
      unitPrice: number
      supplements?: { price: number }[]
    }[]
    for (const item of items) {
      const name =
        typeof item.productName === 'object' && item.productName !== null
          ? (item.productName as { fr: string }).fr
          : String(item.productName)
      const suppTotal = item.supplements?.reduce((s, x) => s + (x.price || 0), 0) ?? 0
      const lineRevenue = (item.unitPrice + suppTotal) * item.quantity
      if (!productMap[name]) productMap[name] = { qty: 0, revenue: 0 }
      productMap[name].qty += item.quantity
      productMap[name].revenue += lineRevenue
    }
  }
  const topProducts = Object.entries(productMap)
    .map(([name, d]) => ({ name, qty: d.qty, revenue: d.revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)

  // By day — revenue = net (after commission)
  const dayMap: Record<string, { revenue: number; count: number }> = {}
  for (const o of orders) {
    const day = new Date(o.createdAt as Date).toISOString().slice(0, 10)
    if (!dayMap[day]) dayMap[day] = { revenue: 0, count: 0 }
    dayMap[day].revenue += orderNet(o)
    dayMap[day].count++
  }
  const byDay = Object.entries(dayMap)
    .map(([date, d]) => ({ date, revenue: d.revenue, count: d.count }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // By status
  const byStatus = {
    pending: orders.filter((o) => o.status === 'pending').length,
    confirmed: orders.filter((o) => o.status === 'confirmed').length,
    preparing: orders.filter((o) => o.status === 'preparing').length,
    ready: orders.filter((o) => o.status === 'ready').length,
    delivered: orders.filter((o) => o.status === 'delivered').length,
  }

  // By hour (0–23) — revenue = net (after commission)
  const hourArray: { hour: number; revenue: number; count: number }[] = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    revenue: 0,
    count: 0,
  }))
  for (const o of orders) {
    const h = new Date(o.createdAt as Date).getHours()
    hourArray[h].revenue += orderNet(o)
    hourArray[h].count++
  }

  // Delivery financial summary
  const deliveryGross = delivery.reduce((s, o) => s + (o.total || 0), 0)
  const deliveryNet = byDeliveryCompany.reduce((s, c) => s + c.net, 0)
  const deliveryCommissionAmount = deliveryGross - deliveryNet
  const pickupRevenue = pickup.reduce((s, o) => s + (o.total || 0), 0)

  // Net total = what the restaurant actually receives (pickup full + delivery after commission)
  const netTotalRevenue = pickupRevenue + deliveryNet

  // Average net order value
  const avgOrder = orderCount > 0 ? netTotalRevenue / orderCount : 0

  return NextResponse.json({
    totalRevenue,
    netTotalRevenue,
    orderCount,
    avgOrder,
    byType: {
      delivery: { count: delivery.length, revenue: deliveryGross },
      pickup: { count: pickup.length, revenue: pickupRevenue },
    },
    deliverySummary: {
      gross: deliveryGross,
      commissionAmount: deliveryCommissionAmount,
      net: deliveryNet,
    },
    byDeliveryCompany,
    topProducts,
    byDay,
    byHour: hourArray,
    byStatus,
  })
}
