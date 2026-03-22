'use client'

import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check, X, Trash2 } from 'lucide-react'

export default function ReviewActions({ id, isApproved }: { id: string; isApproved: boolean }) {
  const router = useRouter()

  const toggle = async () => {
    const res = await fetch(`/api/reviews/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isApproved: !isApproved }),
    })
    if (res.ok) {
      toast.success(isApproved ? 'Avis masqué' : 'Avis approuvé')
      router.refresh()
    } else {
      toast.error('Erreur')
    }
  }

  const deleteReview = async () => {
    if (!confirm('Supprimer cet avis ?')) return
    const res = await fetch(`/api/reviews/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Avis supprimé')
      router.refresh()
    } else {
      toast.error('Erreur')
    }
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <button
        onClick={toggle}
        title={isApproved ? 'Masquer' : 'Approuver'}
        className={`p-2 rounded-lg transition-colors ${
          isApproved
            ? 'text-gray-400 hover:text-orange-500 hover:bg-orange-50'
            : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
        }`}
      >
        {isApproved ? <X size={15} /> : <Check size={15} />}
      </button>
      <button
        onClick={deleteReview}
        className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
      >
        <Trash2 size={15} />
      </button>
    </div>
  )
}
