'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'

export default function DeleteSupplement({ id, name, productCount }: { id: string; name: string; productCount: number }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/supplements/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Supplément supprimé')
      setOpen(false)
      router.refresh()
    } catch {
      toast.error('Erreur lors de la suppression')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        size="sm"
        variant="ghost"
        className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
        onClick={() => setOpen(true)}
        title="Supprimer"
      >
        <Trash2 size={14} />
      </Button>
      <DialogContent>
        <DialogHeader><DialogTitle>Supprimer le supplément</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">
          Supprimer <span className="font-semibold text-foreground">{name}</span> définitivement ?
          {productCount > 0 && ` Il sera retiré des ${productCount} produit${productCount > 1 ? 's' : ''} qui le proposent.`}{' '}
          Les commandes passées ne changent pas.
        </p>
        <p className="text-xs text-muted-foreground">
          Pour le retirer seulement le temps d’une rupture, désactivez-le plutôt.
        </p>
        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>Annuler</Button>
          <Button disabled={loading} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold" onClick={handleDelete}>
            {loading ? 'Suppression...' : 'Supprimer'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
