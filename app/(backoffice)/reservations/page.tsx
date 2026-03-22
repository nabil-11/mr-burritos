import { connectDB } from '@/lib/mongodb'
import { Reservation } from '@/lib/models/Reservation'
import { Badge } from '@/components/ui/badge'
import ReservationActions from './ReservationActions'

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
}

export default async function ReservationsPage() {
  await connectDB()
  const reservations = await Reservation.find().sort({ date: -1 }).limit(50).lean()

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Réservations</h1>
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-150">
          <thead className="bg-gray-50 border-b">
            <tr>
              {['Client', 'Date', 'Heure', 'Couverts', 'Statut', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {(reservations as Record<string, unknown>[]).map((r) => {
              const customer = r.customer as Record<string, string>
              const status = String(r.status)
              return (
                <tr key={String(r._id)} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium">{customer.name}</p>
                    <p className="text-xs text-muted-foreground">{customer.phone}</p>
                  </td>
                  <td className="px-4 py-3">{new Date(r.date as string).toLocaleDateString('fr-FR')}</td>
                  <td className="px-4 py-3">{String(r.time)}</td>
                  <td className="px-4 py-3">{String(r.guests)} pers.</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[status] || ''}`}>
                      {status === 'pending' ? 'En attente' : status === 'confirmed' ? 'Confirmée' : 'Annulée'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <ReservationActions reservationId={String(r._id)} currentStatus={status} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
        {reservations.length === 0 && <p className="text-center text-muted-foreground py-10">Aucune réservation</p>}
      </div>
    </div>
  )
}
