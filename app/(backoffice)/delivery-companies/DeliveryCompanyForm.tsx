'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2 } from 'lucide-react'

interface Company { _id: string; name: string; commission: number; isActive: boolean }

function CompanyDialog({
  company,
  trigger,
}: {
  company?: Company
  trigger: React.ReactElement
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: company?.name ?? '',
    commission: company?.commission?.toString() ?? '0',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const body = { name: form.name.trim(), commission: Number(form.commission) }
      const url = company ? `/api/delivery-companies/${company._id}` : '/api/delivery-companies'
      const method = company ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) throw new Error()
      toast.success(company ? 'Modifié' : 'Société ajoutée')
      setOpen(false)
      router.refresh()
    } catch {
      toast.error('Erreur')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{company ? 'Modifier' : 'Nouvelle société de livraison'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1">
            <Label>Nom</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="ex: Glovo, Presto..."
              required
            />
          </div>
          <div className="space-y-1">
            <Label>Commission (%)</Label>
            <Input
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={form.commission}
              onChange={(e) => setForm({ ...form, commission: e.target.value })}
              required
            />
            <p className="text-xs text-muted-foreground">
              Exemple : 30 → la société prend 30% du total
            </p>
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={loading} className="bg-[#F5A800] hover:bg-[#FF6B00] text-black font-bold">
              {loading ? 'Sauvegarde...' : 'Sauvegarder'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteButton({ company }: { company: Company }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    if (!confirm(`Supprimer "${company.name}" ?`)) return
    setLoading(true)
    try {
      await fetch(`/api/delivery-companies/${company._id}`, { method: 'DELETE' })
      toast.success('Supprimé')
      router.refresh()
    } catch {
      toast.error('Erreur')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button onClick={handleDelete} disabled={loading}
      className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors">
      <Trash2 size={14} />
    </button>
  )
}

export function AddCompanyButton() {
  return (
    <CompanyDialog
      trigger={
        <Button className="bg-[#F5A800] hover:bg-[#FF6B00] text-black font-bold gap-1">
          <Plus size={16} /> Ajouter
        </Button>
      }
    />
  )
}

export function EditCompanyButton({ company }: { company: Company }) {
  return (
    <CompanyDialog
      company={company}
      trigger={
        <button className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-[#1A1A1A] transition-colors">
          <Pencil size={14} />
        </button>
      }
    />
  )
}

export { DeleteButton as DeleteCompanyButton }
