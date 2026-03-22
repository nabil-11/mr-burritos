'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import ImageUpload from '@/components/backoffice/ImageUpload'

interface Category { _id: string; name: { fr: string; ar: string } }
interface Supplement { _id: string; name: { fr: string }; price: number; type: string }
interface ProductData {
  _id: string
  name: { fr: string; ar: string }
  description: { fr: string; ar: string }
  price: number
  image: string
  category: string
  supplements: string[]
  isAvailable: boolean
  isActive: boolean
}

export default function ProductEditForm({
  product, categories, supplements,
}: {
  product: ProductData | null
  categories: Category[]
  supplements: Supplement[]
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    nameFr: product?.name.fr ?? '',
    nameAr: product?.name.ar ?? '',
    descFr: product?.description.fr ?? '',
    descAr: product?.description.ar ?? '',
    price: product?.price?.toString() ?? '0',
    image: product?.image ?? '',
    category: product?.category ?? '',
    supplements: product?.supplements ?? [],
    isAvailable: product?.isAvailable ?? true,
    isActive: product?.isActive ?? true,
  })

  const toggleSupplement = (id: string) => {
    setForm((f) => ({
      ...f,
      supplements: f.supplements.includes(id) ? f.supplements.filter((s) => s !== id) : [...f.supplements, id],
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const body = {
      name: { fr: form.nameFr, ar: form.nameAr },
      description: { fr: form.descFr, ar: form.descAr },
      price: Number(form.price),
      image: form.image,
      category: form.category,
      supplements: form.supplements,
      isAvailable: form.isAvailable,
      isActive: form.isActive,
    }
    try {
      const url = product ? `/api/products/${product._id}` : '/api/products'
      const method = product ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) throw new Error()
      toast.success(product ? 'Produit mis à jour' : 'Produit créé')
      router.push('/products')
    } catch {
      toast.error('Erreur')
    } finally {
      setLoading(false)
    }
  }

  const sauces = supplements.filter((s) => s.type === 'sauce')
  const extras = supplements.filter((s) => s.type !== 'sauce')

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card><CardContent className="pt-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1"><Label>Nom (FR)</Label><Input value={form.nameFr} onChange={(e) => setForm({ ...form, nameFr: e.target.value })} required /></div>
          <div className="space-y-1"><Label>Nom (AR)</Label><Input value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} required /></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1"><Label>Description (FR)</Label><Textarea value={form.descFr} onChange={(e) => setForm({ ...form, descFr: e.target.value })} rows={2} /></div>
          <div className="space-y-1"><Label>Description (AR)</Label><Textarea value={form.descAr} onChange={(e) => setForm({ ...form, descAr: e.target.value })} rows={2} /></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Prix (DT)</Label>
            <Input type="number" step="0.1" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
          </div>
          <div className="space-y-1">
            <Label>Catégorie</Label>
            <Select value={form.category} onValueChange={(v) => v && setForm({ ...form, category: v })}>
              <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => <SelectItem key={c._id} value={c._id}>{c.name.fr}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1">
          <Label>Image du produit</Label>
          <ImageUpload value={form.image} onChange={(url) => setForm({ ...form, image: url })} />
        </div>
      </CardContent></Card>

      <Card><CardContent className="pt-4">
        <Label className="text-base font-semibold mb-3 block">Suppléments disponibles</Label>
        {[{ label: 'Sauces', items: sauces }, { label: 'Extras', items: extras }].map(({ label, items }) => (
          <div key={label} className="mb-3">
            <p className="text-sm font-medium text-muted-foreground mb-2">{label}</p>
            <div className="grid grid-cols-2 gap-2">
              {items.map((sup) => (
                <label key={sup._id} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={form.supplements.includes(sup._id)} onCheckedChange={() => toggleSupplement(sup._id)} />
                  <span className="text-sm">{sup.name.fr} {sup.price > 0 && `(+${sup.price} DT)`}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </CardContent></Card>

      <Card><CardContent className="pt-4 flex gap-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <Switch checked={form.isAvailable} onCheckedChange={(v) => setForm({ ...form, isAvailable: v })} />
          <span className="text-sm">Disponible</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
          <span className="text-sm">Actif</span>
        </label>
      </CardContent></Card>

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={() => router.push('/products')}>Annuler</Button>
        <Button type="submit" disabled={loading} className="bg-[#F5A800] hover:bg-[#FF6B00] text-black font-bold">
          {loading ? 'Sauvegarde...' : 'Sauvegarder'}
        </Button>
      </div>
    </form>
  )
}
