import { connectDB } from '@/lib/mongodb'
import { Order } from '@/lib/models/Order'
import Link from 'next/link'

type Props = { params: Promise<{ id: string }> }

export default async function OrderConfirmPage({ params }: Props) {
  const { id } = await params
  await connectDB()
  const order = await Order.findById(id).lean()

  if (!order) return (
    <div className="text-center py-20">
      <p className="text-xl text-muted-foreground">الطلب غير موجود</p>
      <Link href="/" className="text-[#F5A800] underline mt-4 block">العودة للرئيسية</Link>
    </div>
  )

  const o = order as Record<string, unknown>

  return (
    <div dir="rtl" className="max-w-lg mx-auto px-4 py-16 text-center">
      <div className="text-6xl mb-4">✅</div>
      <h1 className="text-2xl font-black mb-2">تم تأكيد طلبك!</h1>
      <p className="text-muted-foreground mb-4">رقم الطلب: <span className="font-bold text-[#F5A800]">{String(o.orderNumber)}</span></p>
      <div className="bg-gray-50 rounded-xl p-4 text-sm text-right mb-6 space-y-1">
        <p>الاسم: {(o.customer as Record<string, string>).name}</p>
        <p>الهاتف: {(o.customer as Record<string, string>).phone}</p>
        <p>النوع: {o.type === 'delivery' ? 'توصيل' : 'استلام'}</p>
        <p>المجموع: <span className="text-[#F5A800] font-bold">{(o.total as number).toFixed(2)} DT</span></p>
      </div>
      <Link href="/menu" className="bg-[#F5A800] text-black font-bold px-6 py-3 rounded-full hover:bg-[#FF6B00] transition-colors">
        طلب آخر
      </Link>
    </div>
  )
}
