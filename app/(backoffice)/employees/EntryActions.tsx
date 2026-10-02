'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Banknote, Gift, MinusCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

/**
 * Ce qu'on inscrit à la main sur le compte d'un employé : une prime, une
 * retenue, un paiement. Les avances, elles, se donnent depuis la caisse.
 *
 * Un paiement « depuis la caisse » part sur la recette ouverte, comme une
 * dépense : le tiroir doit savoir que l'argent est sorti.
 */

type EntryKind = 'prime' | 'retenue' | 'paiement'

const money = (n: number) => `${(Number(n) || 0).toFixed(2)} DT`

const COPY: Record<EntryKind, { title: string; button: string; done: string; hint: string; notePlaceholder: string }> = {
  prime: {
    title: 'Ajouter une prime',
    done: 'Prime ajoutée',
    button: 'Ajouter la prime',
    hint: "S'ajoute à ce qui lui est dû ce mois-ci.",
    notePlaceholder: 'Heures sup., bonus Ramadan…',
  },
  retenue: {
    title: 'Ajouter une retenue',
    done: 'Retenue ajoutée',
    button: 'Ajouter la retenue',
    hint: 'Se déduit de ce qui lui est dû ce mois-ci.',
    notePlaceholder: 'Absence du 12, casse…',
  },
  paiement: {
    title: 'Payer',
    done: 'Paiement enregistré',
    button: 'Enregistrer le paiement',
    hint: 'Ce qui lui est versé, salaire ou solde. Les avances se donnent depuis la caisse.',
    notePlaceholder: 'Salaire de septembre…',
  },
}

const METHODS = [
  { value: 'caisse', label: 'Depuis la caisse', hint: 'Sort du tiroir de la recette ouverte' },
  { value: 'especes', label: 'Espèces hors caisse', hint: 'Payé de la poche du patron, du coffre…' },
  { value: 'virement', label: 'Virement', hint: '' },
  { value: 'cheque', label: 'Chèque', hint: '' },
]

function EntryDialog({
  employeeId,
  employeeName,
  kind,
  balance,
  onClose,
}: {
  employeeId: string
  employeeName: string
  kind: EntryKind
  balance: number
  onClose: () => void
}) {
  const router = useRouter()
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Tunis' })
  const [amount, setAmount] = useState(kind === 'paiement' && balance > 0 ? balance.toFixed(2) : '')
  const [date, setDate] = useState(today)
  const [note, setNote] = useState('')
  const [method, setMethod] = useState('caisse')
  const [saving, setSaving] = useState(false)
  const copy = COPY[kind]
  const fromDrawer = kind === 'paiement' && method === 'caisse'

  const value = Number(amount.replace(',', '.'))
  const valid = amount.trim() !== '' && Number.isFinite(value) && value > 0

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid || saving) return
    setSaving(true)
    try {
      const res = await fetch(`/api/employees/${employeeId}/entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          amount,
          note,
          ...(fromDrawer ? {} : { date }),
          ...(kind === 'paiement' ? { method } : {}),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Enregistrement impossible')
      toast.success(
        fromDrawer
          ? `${money(value)} sortis de la caisse pour ${employeeName}`
          : `${copy.done} · ${employeeName} · ${money(value)}`
      )
      onClose()
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Enregistrement impossible')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {copy.title} · {employeeName}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <p className="-mt-1 text-xs text-muted-foreground">{copy.hint}</p>

          <div className="space-y-1.5">
            <Label htmlFor="entry-amount">Montant (DT)</Label>
            <Input
              id="entry-amount"
              inputMode="decimal"
              autoFocus
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-11 text-lg font-black"
            />
            {kind === 'paiement' && (
              <p className="text-xs text-muted-foreground">
                {balance > 0 ? (
                  <>
                    Reste à payer aujourd&apos;hui : <span className="font-semibold text-foreground">{money(balance)}</span>
                  </>
                ) : balance < 0 ? (
                  <>Il a déjà reçu {money(-balance)} de plus que dû.</>
                ) : (
                  <>Son compte est soldé.</>
                )}
              </p>
            )}
          </div>

          {kind === 'paiement' && (
            <div className="space-y-1.5">
              <Label>Payé comment</Label>
              <div className="grid grid-cols-2 gap-2" role="radiogroup">
                {METHODS.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    role="radio"
                    aria-checked={method === m.value}
                    onClick={() => setMethod(m.value)}
                    className={`rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                      method === m.value
                        ? 'border-[#F5A800] bg-[#F5A800]/10 font-semibold'
                        : 'text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {m.label}
                    {m.hint && <span className="block text-[11px] font-normal text-muted-foreground">{m.hint}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!fromDrawer && (
            <div className="space-y-1.5">
              <Label htmlFor="entry-date">Date</Label>
              <Input id="entry-date" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="entry-note">Note (facultatif)</Label>
            <Input
              id="entry-note"
              maxLength={200}
              placeholder={copy.notePlaceholder}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Annuler
            </Button>
            <Button type="submit" disabled={!valid || saving} className="bg-[#F5A800] hover:bg-[#FF6B00] text-black font-bold">
              {saving ? 'Enregistrement…' : valid ? `${copy.button} · ${money(value)}` : copy.button}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function EntryActions({
  employeeId,
  employeeName,
  balance,
}: {
  employeeId: string
  employeeName: string
  balance: number
}) {
  const [kind, setKind] = useState<EntryKind | null>(null)
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setKind('paiement')} className="bg-[#F5A800] hover:bg-[#FF6B00] text-black font-bold gap-1">
          <Banknote size={16} /> Payer
        </Button>
        <Button variant="outline" onClick={() => setKind('prime')} className="gap-1">
          <Gift size={15} /> Prime
        </Button>
        <Button variant="outline" onClick={() => setKind('retenue')} className="gap-1">
          <MinusCircle size={15} /> Retenue
        </Button>
      </div>
      {kind && (
        <EntryDialog
          employeeId={employeeId}
          employeeName={employeeName}
          kind={kind}
          balance={balance}
          onClose={() => setKind(null)}
        />
      )}
    </>
  )
}

export function CancelEntryButton({ employeeId, entryId, label }: { employeeId: string; entryId: string; label: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const cancel = async () => {
    if (!window.confirm(`Annuler « ${label} » ? La ligne restera visible, barrée.`)) return
    setBusy(true)
    try {
      const res = await fetch(`/api/employees/${employeeId}/entries/${entryId}/cancel`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Annulation impossible')
      toast.success('Ligne annulée')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Annulation impossible')
    } finally {
      setBusy(false)
    }
  }
  return (
    <button
      onClick={cancel}
      disabled={busy}
      className="text-xs font-semibold text-muted-foreground hover:text-red-600 disabled:opacity-40"
    >
      {busy ? '…' : 'Annuler'}
    </button>
  )
}
