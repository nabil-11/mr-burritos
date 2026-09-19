import type { Metadata } from 'next'
import Link from 'next/link'
import mongoose from 'mongoose'
import { connectDB } from '@/lib/mongodb'
import { Order } from '@/lib/models/Order'
import '@/lib/models/Product' // registers the schema populate('items.product') resolves against
import { describeSupplements } from '@/lib/cartText'
import OrderLive, { type OrderView } from './OrderLive'

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ merci?: string }>
}

export const metadata: Metadata = {
  title: 'Suivi de commande — Mr. Burritos',
  // A private link: nothing for a search engine here.
  robots: { index: false, follow: false },
}

// The status is what this page is for; it is never served from a cache.
export const dynamic = 'force-dynamic'

type Localized = { fr?: string; ar?: string }
type RawItem = {
  product?: { _id?: unknown; image?: string } | unknown
  productName?: Localized
  quantity: number
  unitPrice: number
  supplements?: { supplement?: unknown; name?: Localized; price?: number }[]
}

/** "99123456" → "99 ••• 456": enough to recognise, not enough to copy from a shared link. */
const maskPhone = (p: string) => {
  const d = String(p ?? '').replace(/\D/g, '').slice(-8)
  return d.length === 8 ? `${d.slice(0, 2)} ••• ${d.slice(5)}` : ''
}

export default async function OrderPage({ params, searchParams }: Props) {
  const { id } = await params
  const { merci } = await searchParams

  let order: unknown = null
  if (mongoose.isValidObjectId(id)) {
    await connectDB()
    order = await Order.findById(id).populate('items.product', 'image').lean()
  }

  if (!order) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4 px-4 pt-20 text-center">
        <p className="text-5xl">🔍</p>
        <h1 className="text-xl font-black text-foreground">Commande introuvable</h1>
        <p className="text-sm text-muted-foreground max-w-xs">
          Le lien est peut-être incomplet. Retrouvez vos commandes avec « Suivre » en haut de la page.
        </p>
        <Link href="/" className="text-[#F5A800] font-bold underline underline-offset-4">
          Retour à l&apos;accueil
        </Link>
      </div>
    )
  }

  const o = order as Record<string, unknown>
  const customer = (o.customer ?? {}) as { name?: string; phone?: string; address?: string }
  const discount = (o.discount ?? {}) as { label?: string; rate?: number; amount?: number }

  const view: OrderView = {
    _id: String(o._id),
    orderNumber: String(o.orderNumber),
    status: String(o.status),
    type: String(o.type),
    total: Number(o.total ?? 0),
    subtotal: Number(o.subtotal ?? 0),
    deliveryFee: Number(o.deliveryFee ?? 0),
    createdAt: new Date(o.createdAt as Date).toISOString(),
    confirmedAt: o.confirmedAt ? new Date(o.confirmedAt as Date).toISOString() : null,
    preparationDuration: Number(o.preparationDuration ?? 0) || null,
    discount: { label: discount.label ?? '', rate: Number(discount.rate ?? 0), amount: Number(discount.amount ?? 0) },
    notes: String(o.notes ?? ''),
    customer: {
      firstName: String(customer.name ?? '').trim().split(/\s+/)[0] ?? '',
      phoneHint: maskPhone(customer.phone ?? ''),
      address: String(customer.address ?? ''),
    },
    items: ((o.items ?? []) as RawItem[]).map((it) => {
      const product = (it.product ?? {}) as { _id?: unknown; image?: string }
      const supplements = it.supplements ?? []
      const unit = Number(it.unitPrice) + supplements.reduce((s, x) => s + Number(x.price ?? 0), 0)
      return {
        productId: String(product._id ?? it.product ?? ''),
        name: it.productName?.fr ?? 'Article',
        nameAr: it.productName?.ar ?? '',
        image: product.image ?? '',
        quantity: it.quantity,
        unitPrice: Number(it.unitPrice),
        lineTotal: Math.round(unit * it.quantity * 100) / 100,
        details: describeSupplements(supplements),
        supplements: supplements
          .filter((s) => s.supplement)
          .map((s) => ({
            _id: String(s.supplement),
            name: { fr: s.name?.fr ?? '', ar: s.name?.ar ?? '' },
            price: Number(s.price ?? 0),
          })),
      }
    }),
  }

  return <OrderLive initial={view} justPlaced={merci === '1'} />
}
