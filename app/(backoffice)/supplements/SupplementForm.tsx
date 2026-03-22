'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'

export default function SupplementForm() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ nameFr: '', nameAr: '', price: '0', type: 'extra' })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/supplements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: { fr: form.nameFr, ar: form.nameAr }, price: Number(form.price), type: form.type }),
      })
      if (!res.ok) throw new Error()
      toast.success('Supplément créé')
      setOpen(false)
      setForm({ nameFr: '', nameAr: '', price: '0', type: 'extra' })
      router.refresh()
    } catch {
      toast.error('Erreur lors de la création')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="bg-[#F5A800] hover:bg-[#FF6B00] text-black font-bold"><Plus size={16} className="mr-1" /> Nouveau supplément</Button>} />
      <DialogContent>
        <DialogHeader><DialogTitle>Nouveau supplément</DialogTitle></DialogHeader>
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
              <Label>Prix (DT)</Label>
              <Input type="number" step="0.1" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => v && setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sauce">Sauce</SelectItem>
                  <SelectItem value="size">Taille</SelectItem>
                  <SelectItem value="extra">Extra</SelectItem>
                </SelectContent>
              </Select>
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
