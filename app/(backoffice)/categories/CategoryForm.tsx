'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'

export default function CategoryForm() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ nameFr: '', nameAr: '', slug: '', order: '0' })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: { fr: form.nameFr, ar: form.nameAr }, slug: form.slug, order: Number(form.order) }),
      })
      if (!res.ok) throw new Error()
      toast.success('Catégorie créée')
      setOpen(false)
      setForm({ nameFr: '', nameAr: '', slug: '', order: '0' })
      router.refresh()
    } catch {
      toast.error('Erreur lors de la création')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="bg-[#F5A800] hover:bg-[#FF6B00] text-black font-bold"><Plus size={16} className="mr-1" /> Nouvelle catégorie</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouvelle catégorie</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Nom (FR)</Label>
              <Input value={form.nameFr} onChange={(e) => setForm({ ...form, nameFr: e.target.value })} required />
            </div>
            <div className="space-y-1">
              <Label>Nom (AR)</Label>
              <Input value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Slug</Label>
              <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} required placeholder="ex: tacos" />
            </div>
            <div className="space-y-1">
              <Label>Ordre</Label>
              <Input type="number" value={form.order} onChange={(e) => setForm({ ...form, order: e.target.value })} />
            </div>
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-[#F5A800] hover:bg-[#FF6B00] text-black font-bold">
            {loading ? 'Création...' : 'Créer'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
