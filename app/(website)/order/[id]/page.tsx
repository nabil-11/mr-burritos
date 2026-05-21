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

  const waPhone = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '').replace(/\D/g, '')
  const typeLabel = o.type === 'delivery' ? 'Livraison' : 'À emporter'
  const waText =
    `🌯 Nouvelle commande!\n` +
    `Numéro: ${o.orderNumber}\n` +
    `Type: ${typeLabel}\n` +
    `Client: ${customer.name ?? ''}${customer.phone ? ` (${customer.phone})` : ''}` +
    (customer.address ? `\nAdresse: ${customer.address}` : '') +
    `\nTotal: ${(o.total as number).toFixed(2)} DT`
  const waUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(waText)}`

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

        {/* WhatsApp CTA */}
        {waPhone && (
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-3 w-full bg-green-500 hover:bg-green-600 text-white font-black py-3.5 rounded-xl transition-all hover:scale-[1.02] mb-3"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 shrink-0">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Envoyer la commande sur WhatsApp
          </a>
        )}

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
