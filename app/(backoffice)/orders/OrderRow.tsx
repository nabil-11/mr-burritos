'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Printer } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import OrderActions from './OrderActions'
import { orderSourceIcon, orderSourceLabel } from '@/lib/orderSource'

/**
 * One row of the orders table, plus the detail panel it unfolds.
 *
 * Everything here is pre-formatted by the server component: dates arrive as
 * strings already rendered in fr-FR, so the client render matches the server
 * one and there is no hydration mismatch to explain away.
 */
export type OrderListItem = {
  id: string
  orderNumber: string
  type: string
  source: string | null
  status: string
  createdAtLabel: string
  createdAtTime: string
  confirmedAtLabel: string
  preparationDuration: number
  customer: {
    name: string
    phone: string
    email: string
    address: string
    latitude: number | null
    longitude: number | null
  }
  items: {
    name: string
    quantity: number
    unitPrice: number
    supplements: { name: string; price: number }[]
    notes: string
    lineTotal: number
  }[]
  subtotal: number
  discount: { label: string; rate: number; amount: number } | null
  deliveryFee: number
  total: number
  deliveryCompany: { name: string; commission: number } | null
  assignedDelivery: { name: string; phone: string } | null
  reference: string
  notes: string
  whatsappUrl: string
}

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

const dt = (n: number) => `${n.toFixed(2)} DT`

function prepLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

/** A labelled line inside the detail panel. Renders nothing without a value. */
function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div className="flex justify-between gap-4 py-1">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium text-right break-words">{value}</span>
    </div>
  )
}

function DetailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border p-3">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">{title}</p>
      <div className="text-xs">{children}</div>
    </div>
  )
}

export default function OrderRow({ order }: { order: OrderListItem }) {
  const [open, setOpen] = useState(false)
  const { customer, items, discount, deliveryCompany, assignedDelivery } = order

  const itemCount = items.reduce((s, it) => s + it.quantity, 0)
  const mapsUrl =
    customer.latitude !== null && customer.longitude !== null
      ? `https://www.google.com/maps?q=${customer.latitude},${customer.longitude}`
      : null

  return (
    <>
      <tr className={`hover:bg-gray-50 ${open ? 'bg-gray-50' : ''}`}>
        <td className="px-4 py-3">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls={`order-details-${order.id}`}
            title={open ? 'Masquer le détail' : 'Voir le détail'}
            className="flex items-center gap-2 font-mono font-bold text-xs hover:text-[#F5A800] transition-colors"
          >
            <ChevronRight
              size={14}
              className={`shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-90' : ''}`}
            />
            {order.orderNumber}
          </button>
        </td>
        <td className="px-4 py-3">
          <p className="font-medium">{customer.name}</p>
          <p className="text-xs text-muted-foreground">{customer.phone}</p>
        </td>
        <td className="px-4 py-3">
          <Badge variant="outline">{order.type === 'delivery' ? '🛵 Livraison' : '🏠 À emporter'}</Badge>
          {order.type === 'delivery' && deliveryCompany?.name && (
            <p className="text-[10px] text-orange-600 font-bold mt-1">
              {deliveryCompany.name} ({deliveryCompany.commission}%)
            </p>
          )}
        </td>
        <td className="px-4 py-3">
          <Badge variant="outline" className="whitespace-nowrap">
            {orderSourceIcon(order.source, '❔')} {orderSourceLabel(order.source, 'Inconnue')}
          </Badge>
        </td>
        <td className="px-4 py-3 font-bold text-[#F5A800]">{dt(order.total)}</td>
        <td className="px-4 py-3">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[order.status] || ''}`}>
            {statusLabels[order.status] || order.status}
          </span>
        </td>
        <td className="px-4 py-3 text-xs text-muted-foreground">{order.createdAtLabel}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <OrderActions orderId={order.id} currentStatus={order.status} />
            <a
              href={order.whatsappUrl}
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

      {open && (
        <tr id={`order-details-${order.id}`} className="bg-gray-50/70">
          <td colSpan={8} className="px-4 pt-0 pb-5">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

              {/* ── Articles ─────────────────────────────────────── */}
              <div className="lg:col-span-2 bg-white rounded-lg border p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Articles {itemCount > 0 && `(${itemCount})`}
                  </p>
                  <Link
                    href={`/orders/${order.id}/print`}
                    className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#F5A800] hover:text-[#FF6B00]"
                  >
                    <Printer size={13} /> Ticket
                  </Link>
                </div>

                {items.length === 0 ? (
                  // Platform orders keyed in at the counter carry a total but no
                  // lines — the food was rung up in the delivery app, not here.
                  <p className="text-xs text-muted-foreground italic py-2">
                    Aucun article détaillé — commande saisie au montant.
                  </p>
                ) : (
                  <ul className="divide-y">
                    {items.map((item, i) => (
                      <li key={i} className="py-2 first:pt-0 last:pb-0">
                        <div className="flex justify-between gap-3 text-xs">
                          <span className="font-medium">
                            <span className="font-bold text-[#F5A800]">{item.quantity}×</span> {item.name}
                            {item.quantity > 1 && (
                              <span className="text-muted-foreground"> · {dt(item.unitPrice)} / u</span>
                            )}
                          </span>
                          <span className="font-bold whitespace-nowrap">{dt(item.lineTotal)}</span>
                        </div>
                        {item.supplements.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {item.supplements.map((s, j) => (
                              <span key={j} className="text-[10px] bg-gray-100 rounded-full px-2 py-0.5">
                                + {s.name}{s.price > 0 && ` (${dt(s.price)})`}
                              </span>
                            ))}
                          </div>
                        )}
                        {item.notes && (
                          <p className="text-[11px] italic text-muted-foreground mt-1">« {item.notes} »</p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {order.notes && (
                  <p className="mt-3 text-[11px] italic bg-yellow-50 border border-yellow-200 rounded-md px-2.5 py-2">
                    <span className="font-bold not-italic">Note : </span>{order.notes}
                  </p>
                )}
              </div>

              {/* ── Montants ─────────────────────────────────────── */}
              <DetailCard title="Montants">
                <Field label="Sous-total" value={dt(order.subtotal)} />
                {discount && discount.amount > 0 && (
                  <Field
                    label={`${discount.label || 'Remise'}${discount.rate ? ` (-${Math.round(discount.rate * 100)} %)` : ''}`}
                    value={<span className="text-green-600">-{dt(discount.amount)}</span>}
                  />
                )}
                {order.deliveryFee > 0 && <Field label="Frais de livraison" value={dt(order.deliveryFee)} />}
                {deliveryCompany?.name && (
                  <Field label={`Commission ${deliveryCompany.name}`} value={`${deliveryCompany.commission} %`} />
                )}
                <div className="flex justify-between gap-4 border-t mt-1.5 pt-1.5 font-black text-sm">
                  <span>Total</span>
                  <span className="text-[#F5A800]">{dt(order.total)}</span>
                </div>
              </DetailCard>

              {/* ── Client ───────────────────────────────────────── */}
              <DetailCard title="Client">
                <Field label="Nom" value={customer.name} />
                <Field label="Téléphone" value={customer.phone} />
                <Field label="E-mail" value={customer.email} />
                <Field label="Adresse" value={customer.address} />
                {mapsUrl && (
                  <Field
                    label="Position"
                    value={
                      <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        Voir sur la carte
                      </a>
                    }
                  />
                )}
              </DetailCard>

              {/* ── Suivi ────────────────────────────────────────── */}
              <DetailCard title="Suivi">
                <Field label="Créée le" value={`${order.createdAtLabel} à ${order.createdAtTime}`} />
                <Field label="Confirmée le" value={order.confirmedAtLabel} />
                <Field
                  label="Préparation"
                  value={order.preparationDuration ? prepLabel(order.preparationDuration) : ''}
                />
                <Field label="Référence" value={order.reference} />
                <Field
                  label="Livreur"
                  value={
                    assignedDelivery?.name
                      ? `${assignedDelivery.name}${assignedDelivery.phone ? ` · ${assignedDelivery.phone}` : ''}`
                      : ''
                  }
                />
              </DetailCard>

            </div>
          </td>
        </tr>
      )}
    </>
  )
}
