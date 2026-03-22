import { connectDB } from '@/lib/mongodb'
import { Order } from '@/lib/models/Order'
import { CheckCircle2, Package, Phone, User, MapPin } from 'lucide-react'
import Link from 'next/link'

type Props = { params: Promise<{ id: string }> }

export default async function OrderConfirmPage({ params }: Props) {
  const { id } = await params
  await connectDB()
  const order = await Order.findById(id).lean()

  if (!order) return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 px-4">
      <p className="text-xl text-muted-foreground">Commande introuvable</p>
      <Link href="/" className="text-[#F5A800] underline">Retour à l&apos;accueil</Link>
    </div>
  )

  const o = order as Record<string, unknown>
  const customer = o.customer as Record<string, string>

  return (
    <div className="min-h-screen bg-gray-50 pt-24 pb-16">
      <div className="max-w-lg mx-auto px-4">

        {/* Success header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 mb-4">
            <CheckCircle2 size={40} className="text-green-500" />
          </div>
          <h1 className="text-3xl font-black text-[#1A1A1A] mb-2">Commande confirmée !</h1>
          <p className="text-muted-foreground">
            Votre commande n°{' '}
            <span className="font-black text-[#F5A800] text-lg">{String(o.orderNumber)}</span>
            {' '}a bien été reçue.
          </p>
        </div>

        {/* Details card */}
        <div className="bg-white rounded-2xl border p-6 space-y-4 mb-6">
          <h2 className="font-black text-[#1A1A1A] flex items-center gap-2">
            <Package size={18} className="text-[#F5A800]" /> Détails de la commande
          </h2>

          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-3 text-gray-700">
              <User size={15} className="text-gray-400 shrink-0" />
              <span className="font-medium">Nom :</span>
              <span>{customer.name}</span>
            </div>
            <div className="flex items-center gap-3 text-gray-700">
              <Phone size={15} className="text-gray-400 shrink-0" />
              <span className="font-medium">Téléphone :</span>
              <span>{customer.phone}</span>
            </div>
            {customer.address && (
              <div className="flex items-center gap-3 text-gray-700">
                <MapPin size={15} className="text-gray-400 shrink-0" />
                <span className="font-medium">Adresse :</span>
                <span>{customer.address}</span>
              </div>
            )}
            <div className="flex items-center gap-3 text-gray-700">
              <span className="w-3.75 shrink-0" />
              <span className="font-medium">Type :</span>
              <span className="inline-flex items-center gap-1">
                {o.type === 'delivery' ? '🛵 Livraison' : '🏪 À emporter'}
              </span>
            </div>
          </div>

          <div className="border-t pt-4 flex justify-between items-center">
            <span className="font-black text-base">Total</span>
            <span className="text-[#F5A800] font-black text-xl">{(o.total as number).toFixed(2)} DT</span>
          </div>
        </div>

        {/* Status info */}
        <div className="bg-[#F5A800]/10 border border-[#F5A800]/30 rounded-xl p-4 text-sm text-center text-gray-700 mb-8">
          Nous vous contacterons au <span className="font-bold">{customer.phone}</span> pour confirmer votre commande.
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Link href="/menu"
            className="flex-1 text-center bg-[#F5A800] hover:bg-[#FF6B00] text-black font-black py-3 rounded-xl transition-all hover:scale-[1.02]">
            Commander à nouveau
          </Link>
          <Link href="/"
            className="flex-1 text-center border-2 border-gray-200 hover:border-[#F5A800] text-[#1A1A1A] font-bold py-3 rounded-xl transition-all">
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    </div>
  )
}
