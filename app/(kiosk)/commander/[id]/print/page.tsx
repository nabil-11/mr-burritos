import { connectDB } from '@/lib/mongodb'
import { Order } from '@/lib/models/Order'
import KioskPrintTrigger from './KioskPrintTrigger'

type Props = { params: Promise<{ id: string }> }

export default async function KioskPrintPage({ params }: Props) {
  const { id } = await params
  await connectDB()
  const order = await Order.findById(id).lean()

  if (!order) return <div className="p-8 text-center text-red-500">Commande introuvable</div>

  const o = order as Record<string, unknown>
  const customer = o.customer as Record<string, string>
  const items = o.items as Record<string, unknown>[]
  const now = new Date(o.createdAt as string)
  const dateStr = now.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

  return (
    <>
      <KioskPrintTrigger />

      {/* Receipt — 80mm thermal printer */}
      <div className="receipt font-mono text-black bg-white min-h-screen p-0">
        <div className="max-w-sm mx-auto p-4 text-sm">

          {/* Header */}
          <div className="text-center mb-4 border-b border-dashed border-gray-400 pb-4">
            <p className="text-xl font-black tracking-widest">MR. BURRITOS</p>
            <p className="text-xs text-gray-500">Tacos · Burritos · Snacks</p>
            <p className="text-xs text-gray-500 mt-1">Tunis, Tunisie</p>
          </div>

          {/* Order info */}
          <div className="mb-4 space-y-0.5 text-xs border-b border-dashed border-gray-400 pb-4">
            <div className="flex justify-between">
              <span className="text-gray-500">Commande</span>
              <span className="font-bold">{String(o.orderNumber)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Date</span>
              <span>{dateStr}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Heure</span>
              <span>{timeStr}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Type</span>
              <span className="font-bold">{o.type === 'delivery' ? '🛵 Livraison' : '🏪 À emporter'}</span>
            </div>
            {customer.name && customer.name !== 'Comptoir' && (
              <div className="flex justify-between">
                <span className="text-gray-500">Client</span>
                <span>{customer.name}</span>
              </div>
            )}
            {customer.phone && customer.phone !== '—' && (
              <div className="flex justify-between">
                <span className="text-gray-500">Tél.</span>
                <span>{customer.phone}</span>
              </div>
            )}
          </div>

          {/* Items */}
          <div className="mb-4 border-b border-dashed border-gray-400 pb-4 space-y-2">
            {items.map((item, i) => {
              const name = item.productName as { fr: string } | string
              const nameFr = typeof name === 'object' ? name.fr : String(name)
              const qty = Number(item.quantity)
              const unit = Number(item.unitPrice)
              const supps = item.supplements as { name: { fr: string }; price: number }[]
              const suppTotal = supps?.reduce((s, x) => s + x.price, 0) ?? 0
              const lineTotal = (unit + suppTotal) * qty

              return (
                <div key={i}>
                  <div className="flex justify-between font-semibold">
                    <span className="flex-1 truncate">{qty}× {nameFr}</span>
                    <span className="ml-2 shrink-0">{lineTotal.toFixed(2)} DT</span>
                  </div>
                  {supps?.length > 0 && (
                    <div className="text-[10px] text-gray-400 pl-4">
                      + {supps.map((s) => s.name.fr).join(', ')}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Total */}
          <div className="space-y-1 mb-6">
            <div className="flex justify-between text-xs text-gray-500">
              <span>Sous-total</span>
              <span>{(o.subtotal as number).toFixed(2)} DT</span>
            </div>
            <div className="flex justify-between font-black text-base border-t border-black pt-1 mt-1">
              <span>TOTAL</span>
              <span>{(o.total as number).toFixed(2)} DT</span>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center text-xs text-gray-400 border-t border-dashed border-gray-400 pt-4">
            <p>Merci de votre confiance !</p>
            <p className="mt-1">Mr. Burritos — Crunch Makes Everything Better</p>
          </div>
        </div>
      </div>

      {/* Print-only styles */}
      <style>{`
        @media print {
          body { margin: 0; }
          .no-print { display: none !important; }
        }
        @page { margin: 0; size: 80mm auto; }
      `}</style>
    </>
  )
}
