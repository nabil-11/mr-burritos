'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Pencil, Plus, Shuffle, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { WEB_PROMO, applyWebDiscounts, normalizePromoCode, type PromoTerms } from '@/lib/promo'

export interface SerializedPromoCode {
  _id: string
  code: string
  description: string
  kind: 'percent' | 'fixed'
  value: number
  minSubtotal: number
  /** AAAA-MM-JJ, or '' when it works from the day it is created. */
  startsOn: string
  /** Last day it works, AAAA-MM-JJ, inclusive. */
  expiresOn: string
  maxUses: number
  maxUsesPerCustomer: number
  stackable: boolean
  isActive: boolean
}

/** Easy to read out over the phone: no 0/O or 1/I. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const randomCode = () =>
  'MRB' + Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => ALPHABET[b % ALPHABET.length]).join('')

/** What a 30 DT basket would pay, so the effect of the settings is seen before saving. */
const EXAMPLE_BASKET = 30

/**
 * Creates a promo code, or edits one when `code` is given.
 */
export default function PromoCodeForm({ code, defaultExpiresOn }: { code?: SerializedPromoCode; defaultExpiresOn: string }) {
  const editing = Boolean(code)
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const initial = () => ({
    code: code?.code ?? '',
    description: code?.description ?? '',
    kind: code?.kind ?? ('percent' as 'percent' | 'fixed'),
    value: String(code?.value ?? 10),
    minSubtotal: String(code?.minSubtotal ?? 0),
    startsOn: code?.startsOn ?? '',
    expiresOn: code?.expiresOn ?? defaultExpiresOn,
    maxUses: String(code?.maxUses ?? 0),
    maxUsesPerCustomer: String(code?.maxUsesPerCustomer ?? 1),
    stackable: code?.stackable ?? false,
  })
  const [form, setForm] = useState(initial)
  const set = <K extends keyof ReturnType<typeof initial>>(k: K, v: ReturnType<typeof initial>[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  const openChange = (next: boolean) => {
    if (next) setForm(initial())
    setOpen(next)
  }

  const value = Number(form.value.replace(',', '.')) || 0
  const terms: PromoTerms = {
    code: normalizePromoCode(form.code) || 'CODE',
    description: '',
    kind: form.kind,
    value,
    minSubtotal: Number(form.minSubtotal) || 0,
    stackable: form.stackable,
    expiresAt: '',
  }
  const example = applyWebDiscounts(EXAMPLE_BASKET, value > 0 ? terms : null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch(editing ? `/api/promo-codes/${code!._id}` : '/api/promo-codes', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: form.code,
          description: form.description,
          kind: form.kind,
          value: form.value,
          minSubtotal: form.minSubtotal || 0,
          startsOn: form.startsOn,
          expiresOn: form.expiresOn,
          maxUses: form.maxUses || 0,
          maxUsesPerCustomer: form.maxUsesPerCustomer || 0,
          stackable: form.stackable,
        }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error)
      toast.success(editing ? 'Code modifié' : `Code ${normalizePromoCode(form.code)} créé`)
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
              <Plus size={16} className="mr-1" /> Nouveau code
            </Button>
          )
        }
      />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? `Modifier ${code!.code}` : 'Nouveau code promo'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label>Code</Label>
            <div className="flex gap-2">
              <Input
                value={form.code}
                onChange={(e) => set('code', normalizePromoCode(e.target.value))}
                placeholder="ex. RAMADAN20"
                className="font-mono font-bold tracking-wider uppercase"
                required
                minLength={3}
              />
              <Button type="button" variant="outline" onClick={() => set('code', randomCode())} title="Générer un code">
                <Shuffle size={14} />
              </Button>
            </div>
            {editing && (
              <p className="text-xs text-muted-foreground">
                Renommer un code remet son compteur à zéro : les commandes passées gardent l’ancien nom.
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label>Description (vue par le client)</Label>
            <Input
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="ex. Offre Ramadan"
              maxLength={120}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Type</Label>
              <div className="grid grid-cols-2 rounded-lg border p-0.5 text-sm">
                {(
                  [
                    ['percent', '%'],
                    ['fixed', 'DT'],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => set('kind', k)}
                    className={`rounded-md py-1.5 font-bold transition-colors ${
                      form.kind === k ? 'bg-[#F5A800] text-black' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label>{form.kind === 'percent' ? 'Réduction (%)' : 'Réduction (DT)'}</Label>
              <Input
                type="number"
                // The browser counts steps from `min`: min 0.1 with step 1
                // refused 30 and offered 29.1 or 30.1. Any value goes; the
                // server holds it above 0 (and at most 100 for a percentage).
                min="0.01"
                max={form.kind === 'percent' ? 100 : undefined}
                step="any"
                value={form.value}
                onChange={(e) => set('value', e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Début (facultatif)</Label>
              <Input type="date" value={form.startsOn} onChange={(e) => set('startsOn', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Expire après le</Label>
              <Input
                type="date"
                value={form.expiresOn}
                min={form.startsOn || undefined}
                onChange={(e) => set('expiresOn', e.target.value)}
                required
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground -mt-2">
            Valable jusqu’à minuit (heure de Tunis) le dernier jour, puis refusé automatiquement.
          </p>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Panier min. (DT)</Label>
              <Input type="number" min="0" step="any" value={form.minSubtotal} onChange={(e) => set('minSubtotal', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Utilisations max</Label>
              <Input type="number" min="0" step="1" value={form.maxUses} onChange={(e) => set('maxUses', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Par client</Label>
              <Input
                type="number"
                min="0"
                step="1"
                value={form.maxUsesPerCustomer}
                onChange={(e) => set('maxUsesPerCustomer', e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground -mt-2">
            0 = sans limite. « Par client » compte les commandes passées avec le même numéro de téléphone ; une commande
            annulée rend son utilisation.
          </p>

          <label className="flex items-start gap-2.5 cursor-pointer rounded-lg border p-3">
            <Checkbox checked={form.stackable} onCheckedChange={(v) => set('stackable', Boolean(v))} className="mt-0.5" />
            <span className="text-sm">
              <span className="font-medium">Cumulable avec la promo en ligne ({WEB_PROMO.badge})</span>
              <span className="block text-xs text-muted-foreground mt-0.5">
                Sinon le client garde la meilleure des deux réductions, jamais moins que sans code.
              </span>
            </span>
          </label>

          <div className="rounded-lg bg-muted/60 px-3 py-2.5 text-xs">
            <p className="font-medium text-foreground">Exemple : panier de {EXAMPLE_BASKET.toFixed(2)} DT</p>
            <p className="text-muted-foreground mt-0.5">
              {example.promoStatus === 'applied'
                ? `${example.discount.label} : −${example.discount.amount.toFixed(2)} DT → le client paie ${example.total.toFixed(2)} DT`
                : example.promoStatus === 'below-minimum'
                  ? `Sous le minimum : seule la promo en ligne s’applique (${example.total.toFixed(2)} DT)`
                  : example.promoStatus === 'not-better'
                    ? `Le code rapporte moins que la promo en ligne : le client paie ${example.total.toFixed(2)} DT comme sans code`
                    : 'Indiquez une réduction'}
            </p>
          </div>

          <Button type="submit" disabled={loading} className="w-full bg-[#F5A800] hover:bg-[#FF6B00] text-black font-bold">
            {loading ? 'Enregistrement…' : editing ? 'Enregistrer' : 'Créer le code'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function DeletePromoCode({ id, code, uses }: { id: string; code: string; uses: number }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/promo-codes/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error)
      toast.success('Code supprimé')
      setOpen(false)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : 'Erreur lors de la suppression')
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
        <DialogHeader><DialogTitle>Supprimer le code</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">
          Supprimer <span className="font-mono font-semibold text-foreground">{code}</span> définitivement ?
          {uses > 0 && ` Les ${uses} commande${uses > 1 ? 's' : ''} passée${uses > 1 ? 's' : ''} avec ce code ne changent pas.`}
        </p>
        <p className="text-xs text-muted-foreground">Pour l’arrêter en gardant ses statistiques, désactivez-le plutôt.</p>
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
