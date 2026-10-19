'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import ImageUpload from '@/components/backoffice/ImageUpload'
import { Pencil, Plus } from 'lucide-react'
import { toast } from 'sonner'

export interface SerializedSupplement {
  _id: string
  name: { fr: string; ar: string }
  price: number
  type: string
  meatCount: number
  image: string
  layerImage: string
  isActive: boolean
}

export interface ProductOption {
  _id: string
  name: string
  category: string
  isBase: boolean
  /** The supplement types this product already offers — guides the default selection. */
  offers: string[]
  /** The supplements linked to it. */
  supplementIds: string[]
}

const TYPES = [
  { value: 'sauce', label: 'Sauce' },
  { value: 'size', label: 'Taille' },
  { value: 'viande', label: 'Viande' },
  { value: 'extra', label: 'Extra' },
]

/** New supplements go where the same kind already lives: a new sauce on every product that has sauces. */
const productsOffering = (products: ProductOption[], type: string) =>
  products.filter((p) => p.offers.includes(type)).map((p) => p._id)

/**
 * Creates a supplement, or edits one when `supplement` is given. Besides the
 * supplement itself it sets which products offer it — without that link a new
 * sauce exists in the list but never reaches the menu.
 */
export default function SupplementForm({
  supplement,
  products,
}: {
  supplement?: SerializedSupplement
  products: ProductOption[]
}) {
  const editing = Boolean(supplement)
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const initial = () => ({
    nameFr: supplement?.name.fr ?? '',
    nameAr: supplement?.name.ar ?? '',
    price: String(supplement?.price ?? 0),
    type: supplement?.type ?? 'extra',
    meatCount: String(supplement?.meatCount ?? 1),
    image: supplement?.image ?? '',
    layerImage: supplement?.layerImage ?? '',
    productIds: supplement
      ? products.filter((p) => p.supplementIds.includes(supplement._id)).map((p) => p._id)
      : productsOffering(products, 'extra'),
  })
  const [form, setForm] = useState(initial)
  // Once the products are picked by hand, changing the type no longer resets them.
  const [pickedByHand, setPickedByHand] = useState(editing)

  const byCategory = useMemo(() => {
    const groups = new Map<string, ProductOption[]>()
    for (const p of products) groups.set(p.category, [...(groups.get(p.category) ?? []), p])
    return [...groups.entries()]
  }, [products])

  const openChange = (next: boolean) => {
    if (next) {
      setForm(initial())
      setPickedByHand(editing)
    }
    setOpen(next)
  }

  const setType = (type: string) =>
    setForm((f) => ({ ...f, type, productIds: pickedByHand ? f.productIds : productsOffering(products, type) }))

  const toggleProducts = (ids: string[], on: boolean) => {
    setPickedByHand(true)
    setForm((f) => ({
      ...f,
      productIds: on ? [...new Set([...f.productIds, ...ids])] : f.productIds.filter((id) => !ids.includes(id)),
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch(editing ? `/api/supplements/${supplement!._id}` : '/api/supplements', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: { fr: form.nameFr, ar: form.nameAr },
          price: Number(form.price),
          type: form.type,
          // Only a size decides how many viandes the customer gets.
          meatCount: form.type === 'size' ? Number(form.meatCount) : 1,
          image: form.image,
          layerImage: form.layerImage,
          productIds: form.productIds,
        }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error)
      toast.success(editing ? 'Supplément modifié' : 'Supplément créé')
      setOpen(false)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : 'Erreur lors de l’enregistrement')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={openChange}>
      <DialogTrigger
        render={
          editing ? (
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Modifier">
              <Pencil size={14} />
            </Button>
          ) : (
            <Button className="bg-[#F5A800] hover:bg-[#FF6B00] text-black font-bold">
              <Plus size={16} className="mr-1" /> Nouveau supplément
            </Button>
          )
        }
      />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'Modifier le supplément' : 'Nouveau supplément'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Nom (FR)</Label>
              <Input value={form.nameFr} onChange={(e) => setForm({ ...form, nameFr: e.target.value })} required />
            </div>
            <div className="space-y-1">
              <Label>Nom (AR)</Label>
              <Input dir="rtl" value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Prix (DT)</Label>
              <Input type="number" min="0" step="0.1" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select items={TYPES} value={form.type} onValueChange={(v) => v && setType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {form.type === 'size' && (
            <div className="space-y-1">
              <Label>Nombre de viandes</Label>
              <Input
                type="number"
                min="1"
                value={form.meatCount}
                onChange={(e) => setForm({ ...form, meatCount: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Combien de viandes le client choisit pour cette taille — M 1, XL 2, XXL 3.
              </p>
            </div>
          )}

          {form.type === 'viande' && (
            <div className="space-y-1">
              <Label>Photo</Label>
              <ImageUpload value={form.image} onChange={(url) => setForm({ ...form, image: url })} />
              <p className="text-xs text-muted-foreground">Affichée au client quand il choisit ses viandes.</p>
            </div>
          )}

          <details className="rounded-lg border px-3 py-2" open={Boolean(form.layerImage)}>
            <summary className="cursor-pointer text-sm font-medium">Calque de l’animation (optionnel)</summary>
            <div className="pt-3 space-y-1">
              <ImageUpload value={form.layerImage} onChange={(url) => setForm({ ...form, layerImage: url })} />
              <p className="text-xs text-muted-foreground">
                PNG transparent, empilé dans le tacos en construction. Sans image, une bande colorée le remplace.
              </p>
            </div>
          </details>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <Label>Proposé sur</Label>
              <span className="text-xs text-muted-foreground">
                {form.productIds.length} produit{form.productIds.length > 1 ? 's' : ''}
              </span>
            </div>
            {products.length === 0 ? (
              <p className="text-xs text-muted-foreground">Aucun produit actif.</p>
            ) : (
              <div className="max-h-64 overflow-y-auto rounded-lg border divide-y">
                {byCategory.map(([category, items]) => {
                  const ids = items.map((p) => p._id)
                  const all = ids.every((id) => form.productIds.includes(id))
                  return (
                    <div key={category} className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{category}</p>
                        <button
                          type="button"
                          className="text-xs font-medium text-[#F5A800] hover:underline"
                          onClick={() => toggleProducts(ids, !all)}
                        >
                          {all ? 'Aucun' : 'Tous'}
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                        {items.map((p) => (
                          <label key={p._id} className="flex items-center gap-2 cursor-pointer text-sm">
                            <Checkbox
                              checked={form.productIds.includes(p._id)}
                              onCheckedChange={(v) => toggleProducts([p._id], Boolean(v))}
                            />
                            <span className="truncate">
                              {p.name}
                              {p.isBase && <span className="text-muted-foreground"> (à composer)</span>}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <Button type="submit" disabled={loading} className="w-full bg-[#F5A800] hover:bg-[#FF6B00] text-black font-bold">
            {loading ? 'Enregistrement...' : editing ? 'Enregistrer' : 'Créer'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
