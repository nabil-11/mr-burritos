'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MOVEMENT_LIST, MOVEMENT_META, type MovementKind } from '@/lib/movementKinds'

/**
 * Un mouvement d'espèces sur la recette ouverte.
 *
 * Écrit pour quelqu'un qui a un fournisseur devant lui : le montant d'abord et
 * en grand, le libellé à un tap, et surtout la conséquence — ce que le tiroir
 * contiendra ensuite — affichée avant d'enregistrer quoi que ce soit.
 *
 * Le cas qui a motivé l'écran : le fond ne suffit pas. Plutôt que de refuser
 * l'achat, ou de laisser passer un tiroir négatif, la caisse propose de
 * compléter le fond du montant manquant. Les deux lignes — l'ajout puis
 * l'achat — partent dans la même requête, donc elles arrivent ensemble ou pas
 * du tout : un complément sans l'achat qu'il finance ne veut rien dire.
 */

const money = (n: number) => `${(Number(n) || 0).toFixed(2)} DT`

/** « 12,5 » se tape aussi vite que « 12.5 » sur un clavier de caisse. */
function parseAmount(v: string): number | null {
  const n = Number(v.replace(',', '.').trim())
  return v.trim() !== '' && Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
}

/** Personne ne remet 7,40 DT dans un tiroir : on remet un billet. */
const roundUpToNote = (n: number) => Math.max(5, Math.ceil(n / 5) * 5)

export interface CashMovementDialogProps {
  recetteId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Ce que le tiroir doit contenir à cet instant, fond compris. */
  cashInDrawer: number
  /** Le genre proposé à l'ouverture — l'utilisateur peut en changer. */
  initialKind?: MovementKind
  /** Appelé une fois le serveur à jour. */
  onSaved?: () => void
}

export default function CashMovementDialog({
  recetteId,
  open,
  onOpenChange,
  cashInDrawer,
  initialKind = 'achat',
  onSaved,
}: CashMovementDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mouvement de caisse</DialogTitle>
        </DialogHeader>
        {/* Remonté à chaque ouverture : un formulaire à moitié rempli par la
            fois d'avant est une erreur de saisie qui attend. */}
        {open && (
          <MovementForm
            key={`${initialKind}-${recetteId}`}
            recetteId={recetteId}
            cashInDrawer={cashInDrawer}
            initialKind={initialKind}
            onCancel={() => onOpenChange(false)}
            onSaved={() => {
              onOpenChange(false)
              onSaved?.()
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

const QUICK_AMOUNTS = [5, 10, 20, 50]

function MovementForm({
  recetteId,
  cashInDrawer,
  initialKind,
  onCancel,
  onSaved,
}: {
  recetteId: string
  cashInDrawer: number
  initialKind: MovementKind
  onCancel: () => void
  onSaved: () => void
}) {
  const [kind, setKind] = useState<MovementKind>(initialKind)
  const [amount, setAmount] = useState('')
  const [label, setLabel] = useState('')
  const [note, setNote] = useState('')
  const [topUp, setTopUp] = useState(true)
  const [topUpAmount, setTopUpAmount] = useState('')
  const [saving, setSaving] = useState(false)

  const meta = MOVEMENT_META[kind]
  const value = parseAmount(amount)

  // Ce qui manque dans le tiroir pour payer ce montant. Seul un mouvement
  // sortant peut manquer d'argent : un ajout au fond en apporte.
  const missing = useMemo(() => {
    if (meta.sign > 0 || value === null) return 0
    return Math.round(Math.max(0, value - cashInDrawer) * 100) / 100
  }, [meta.sign, value, cashInDrawer])

  const suggestedTopUp = missing > 0 ? roundUpToNote(missing) : 0
  const topUpValue = topUpAmount.trim() === '' ? suggestedTopUp : (parseAmount(topUpAmount) ?? 0)
  const willTopUp = missing > 0 && topUp && topUpValue > 0

  const after =
    Math.round((cashInDrawer + (willTopUp ? topUpValue : 0) + meta.sign * (value ?? 0)) * 100) / 100

  const valid = value !== null && label.trim() !== '' && (!willTopUp || topUpValue >= missing)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid || value === null || saving) return
    setSaving(true)

    // L'ajout au fond passe en premier : dans la liste, le complément se lit
    // au-dessus de l'achat qu'il a permis de payer.
    const mouvements = [
      ...(willTopUp
        ? [
            {
              kind: 'apport' as const,
              label: 'Complément de fond',
              amount: topUpValue,
              note: `Pour ${label.trim()} · ${money(value)}`,
            },
          ]
        : []),
      { kind, label: label.trim(), amount: value, note: note.trim() },
    ]

    try {
      const res = await fetch(`/api/recettes/${recetteId}/mouvements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mouvements }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Enregistrement impossible')
      toast.success(
        willTopUp
          ? `Fond complété de ${money(topUpValue)} · ${meta.label.toLowerCase()} ${money(value)}`
          : `${meta.label} enregistré${meta.kind === 'depense' ? 'e' : ''} · ${label.trim()} ${
              meta.sign > 0 ? '+' : '−'
            } ${money(value)}`
      )
      onSaved()
    } catch (err) {
      // Rien n'est vidé : une saisie refusée reste à l'écran, prête à corriger.
      toast.error(err instanceof Error ? err.message : 'Enregistrement impossible')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {/* ── Le geste ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Type de mouvement">
        {MOVEMENT_LIST.map((m) => (
          <button
            key={m.kind}
            type="button"
            onClick={() => setKind(m.kind)}
            aria-pressed={kind === m.kind}
            className={`rounded-xl border px-3 py-2.5 text-sm font-bold transition-colors ${
              kind === m.kind
                ? m.accent
                : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted'
            }`}
          >
            <span className="mr-1">{m.sign > 0 ? '+' : '−'}</span>
            {m.label}
          </button>
        ))}
      </div>
      <p className="-mt-1 text-xs text-muted-foreground leading-snug">{meta.hint}</p>

      {/* ── Le montant ──────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <Label htmlFor="mvt-amount">Montant (DT)</Label>
        <Input
          id="mvt-amount"
          type="text"
          inputMode="decimal"
          autoFocus
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="h-12 text-xl font-black"
        />
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {QUICK_AMOUNTS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setAmount(String(v))}
              className="rounded-full border px-3 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted"
            >
              {v} DT
            </button>
          ))}
        </div>
      </div>

      {/* ── Le libellé ──────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <Label htmlFor="mvt-label">Libellé</Label>
        <Input
          id="mvt-label"
          maxLength={80}
          placeholder={meta.suggestions[0]}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {meta.suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setLabel(s)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                label === s ? meta.accent : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="mvt-note">Note (facultatif)</Label>
        <Input
          id="mvt-note"
          maxLength={200}
          placeholder="Fournisseur, n° de facture…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      {/* ── Le fond ne suffit pas ───────────────────────────────────── */}
      {missing > 0 && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 space-y-2.5">
          <p className="text-sm font-bold text-amber-700 dark:text-amber-300">
            Le fond ne suffit pas — il manque {money(missing)}
          </p>
          <p className="text-xs text-amber-700/80 dark:text-amber-300/80 leading-snug">
            Le tiroir contient {money(cashInDrawer)}. Ajoutez au fond ce qui manque, puis
            l&apos;{meta.label.toLowerCase()} sera payé{meta.kind === 'depense' ? 'e' : ''} dessus.
          </p>
          <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
            <input
              type="checkbox"
              checked={topUp}
              onChange={(e) => setTopUp(e.target.checked)}
              className="h-4 w-4 accent-emerald-600"
            />
            Compléter le fond
          </label>
          {topUp && (
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="text"
                inputMode="decimal"
                aria-label="Montant ajouté au fond"
                value={topUpAmount}
                placeholder={suggestedTopUp.toFixed(2)}
                onChange={(e) => setTopUpAmount(e.target.value)}
                className="h-9 w-28 font-bold"
              />
              {[suggestedTopUp, suggestedTopUp + 10, suggestedTopUp + 30].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setTopUpAmount(String(v))}
                  className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300"
                >
                  + {v} DT
                </button>
              ))}
              {topUpValue < missing && (
                <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                  Au moins {money(missing)}
                </span>
              )}
            </div>
          )}
          {!topUp && (
            <p className="text-xs text-amber-700/80 dark:text-amber-300/80">
              Sans complément, le tiroir sera enregistré à {money(after)} — à corriger avant la
              clôture.
            </p>
          )}
        </div>
      )}

      {/* ── La conséquence, avant d'enregistrer ─────────────────────── */}
      <div className="flex items-center justify-between rounded-xl border bg-muted/40 px-3 py-2.5 text-sm">
        <span className="text-muted-foreground">
          {value === null ? 'Dans le tiroir' : 'Il restera dans le tiroir'}
        </span>
        <span
          className={`font-black ${
            after < -0.005 ? 'text-red-600 dark:text-red-400' : 'text-foreground'
          }`}
        >
          {money(value === null ? cashInDrawer : after)}
        </span>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Annuler
        </Button>
        <Button
          type="submit"
          disabled={!valid || saving}
          className="bg-[#F5A800] hover:bg-[#FF6B00] text-black font-bold"
        >
          {saving
            ? 'Enregistrement…'
            : willTopUp
              ? // Deux lignes vont partir : le bouton le dit avant d'être pressé.
                `Ajouter ${money(topUpValue)} puis enregistrer`
              : value === null
                ? 'Enregistrer'
                : `Enregistrer · ${meta.sign > 0 ? '+' : '−'} ${money(value)}`}
        </Button>
      </div>
    </form>
  )
}
