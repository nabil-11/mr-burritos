'use client'

import { useRouter } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

export default function ReservationActions({ reservationId, currentStatus }: { reservationId: string; currentStatus: string }) {
  const router = useRouter()
  const handleChange = async (status: string | null) => {
    if (!status) return
    const res = await fetch(`/api/reservations/${reservationId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) { toast.success('Statut mis à jour'); router.refresh() }
    else toast.error('Erreur')
  }
  return (
    <Select value={currentStatus} onValueChange={handleChange}>
      <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="pending" className="text-xs">En attente</SelectItem>
        <SelectItem value="confirmed" className="text-xs">Confirmée</SelectItem>
        <SelectItem value="cancelled" className="text-xs">Annulée</SelectItem>
      </SelectContent>
    </Select>
  )
}
