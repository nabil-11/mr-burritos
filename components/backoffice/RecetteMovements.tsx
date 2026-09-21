'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { MOVEMENT_LIST, MOVEMENT_META, isMovementKind, type MovementKind } from '@/lib/movementKinds'
import CashMovementDialog from './CashMovementDialog'

/**
 * Les mouvements d'espèces d'une session, et de quoi en ajouter.
 *
 * Tout est là, y compris ce qui a été annulé : un tiroir qui tombe juste se
 * justifie ligne à ligne, et une ligne effacée est une explication perdue. Les
 * annulées restent, barrées, avec l'heure et l'auteur.
 *
 * Les boutons ne s'affichent que sur une session ouverte — une recette
 * clôturée a des chiffres figés, et le serveur refuserait de toute façon.
 */

export interface MovementView {
  _id: string
  kind: string
  label: string
  amount: number
  note: string
  createdAt: string
  createdBy: string
  cancelledAt: string | null
  cancelledBy: string
}

const money = (n: number) => `${(Number(n) || 0).toFixed(2)} DT`
const dateFr = (d: string | null) => (d ? new Date(d).toLocaleDateString('fr-FR') : '')
const timeFr = (d: string | null) =>
  d ? new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''

export default function RecetteMovements({
  recetteId,
  isOpen,
  movements,
  cashInDrawer,
  summary,
}: {
  recetteId: string
  isOpen: boolean
  movements: MovementView[]
  /** Ce que le tiroir doit contenir maintenant — le garde-fou du formulaire. */
  cashInDrawer: number
  summary: { achats: number; depenses: number; apports: number; retraits: number; solde: number }
}) {
  const router = useRouter()
  const [dialogKind, setDialogKind] = useState<MovementKind | null>(null)
  const [cancelling, setCancelling] = useState<string | null>(null)

  const cancel = async (m: MovementView) => {
    if (!window.confirm(`Annuler « ${m.label} » (${money(m.amount)}) ? La ligne restera visible, barrée.`)) {
      return
    }
    setCancelling(m._id)
    try {
      const res = await fetch(`/api/recettes/${recetteId}/mouvements/${m._id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Annulation impossible')
      toast.success(`${m.label} annulé`)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Annulation impossible')
    } finally {
      setCancelling(null)
    }
  }

  const chips = [
    { label: 'Achats', value: summary.achats, sign: '−' },
    { label: 'Dépenses', value: summary.depenses, sign: '−' },
    { label: 'Ajouts au fond', value: summary.apports, sign: '+' },
    { label: 'Retraits', value: summary.retraits, sign: '−' },
  ].filter((c) => c.value > 0)

  return (
    <div className="bg-card rounded-xl border overflow-hidden mb-4">
      <div className="px-4 py-3 border-b flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-sm">
            Mouvements de caisse{' '}
            <span className="text-muted-foreground font-normal">({movements.length})</span>
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {chips.length > 0 ? (
              <>
                {chips.map((c, i) => (
                  <span key={c.label}>
                    {i > 0 && ' · '}
                    {c.label} {c.sign} {money(c.value)}
                  </span>
                ))}
                {' · '}
                Solde après sorties{' '}
                <span className="font-semibold text-foreground">{money(summary.solde)}</span>
              </>
            ) : (
              "Ce qui entre et sort du tiroir pendant le service : achats, dépenses, ajouts au fond."
            )}
          </p>
        </div>

        {isOpen && (
          <div className="flex flex-wrap gap-1.5">
            {MOVEMENT_LIST.map((m) => (
              <button
                key={m.kind}
                onClick={() => setDialogKind(m.kind)}
                className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-colors ${m.accent}`}
              >
                {m.sign > 0 ? '+' : '−'} {m.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {isOpen && (
        <div className="px-4 py-2.5 border-b bg-muted/30 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Espèces dans le tiroir</span>
          <span
            className={`font-black ${
              cashInDrawer < -0.005 ? 'text-red-600 dark:text-red-400' : 'text-foreground'
            }`}
          >
            {money(cashInDrawer)}
          </span>
        </div>
      )}

      {movements.length === 0 ? (
        <p className="text-center text-muted-foreground py-8 text-sm">
          Aucun mouvement sur cette recette
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-150">
            <thead className="bg-muted/50 border-b">
              <tr>
                {['Heure', 'Type', 'Libellé', 'Note', 'Par', 'Montant', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {movements.map((m) => {
                const cancelled = Boolean(m.cancelledAt)
                const meta = isMovementKind(m.kind) ? MOVEMENT_META[m.kind] : null
                return (
                  <tr
                    key={m._id}
                    className={cancelled ? 'text-muted-foreground' : 'hover:bg-muted/50'}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">{timeFr(m.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                          meta?.badge ?? 'bg-muted text-muted-foreground'
                        } ${cancelled ? 'opacity-50' : ''}`}
                      >
                        {meta?.short ?? m.kind}
                      </span>
                    </td>
                    <td className={`px-4 py-3 font-medium ${cancelled ? 'line-through' : ''}`}>
                      {m.label}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {cancelled
                        ? `Annulé le ${dateFr(m.cancelledAt)} à ${timeFr(m.cancelledAt)}${
                            m.cancelledBy ? ` par ${m.cancelledBy}` : ''
                          }`
                        : m.note || '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{m.createdBy || '—'}</td>
                    <td
                      className={`px-4 py-3 font-bold whitespace-nowrap ${
                        cancelled ? 'line-through' : (meta?.amountTone ?? '')
                      }`}
                    >
                      {meta && meta.sign > 0 ? '+' : '−'} {money(m.amount)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isOpen && !cancelled && (
                        <button
                          onClick={() => cancel(m)}
                          disabled={cancelling === m._id}
                          className="text-xs font-semibold text-muted-foreground hover:text-red-600 disabled:opacity-40"
                        >
                          {cancelling === m._id ? '…' : 'Annuler'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {dialogKind && (
        <CashMovementDialog
          recetteId={recetteId}
          open
          onOpenChange={(v) => !v && setDialogKind(null)}
          cashInDrawer={cashInDrawer}
          initialKind={dialogKind}
          onSaved={() => router.refresh()}
        />
      )}
    </div>
  )
}
