'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeftRight, Lock, LockOpen, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import CashMovementDialog from './CashMovementDialog'

/**
 * Ouverture / clôture de caisse, sitting in the sidebar so it is one click away
 * from anywhere in the back-office — and so the state of the till is visible
 * without going to look for it.
 *
 * It polls `/api/recettes/current` rather than being fed by the server layout:
 * orders keep landing in the session while the manager sits on a page, and the
 * running total is the number they want to glance at.
 *
 * Cash movements are here too, and not only on the recette page. A supplier
 * turns up while the manager is somewhere else entirely; making them navigate
 * first is how an achat ends up never being written down.
 */

interface Totals {
  orders: number
  cancelled: number
  inProgress: number
  revenue: number
  net: number
  cashExpected: number
  cashSales: number
  cardSales?: number
  platformDue?: number
  platformPaid?: number
  unsettled?: number
  /** Encaisse et reste du : voir lib/recette. Absents des serveurs plus anciens. */
  collected?: number
  receivable?: number
  achats: number
  depenses: number
  apports: number
  retraits: number
}

interface OpenRecette {
  _id: string
  number: string
  openedAt: string
  openingFloat: number
  openedBy?: { name?: string }
}

interface Current {
  recette: OpenRecette | null
  totals: Totals
  /** Fond + entrées − sorties, calculé par le serveur pour que tout le monde lise la même chose. */
  cashInDrawer: number
}

const money = (n: number) => `${(n || 0).toFixed(2)} DT`

const timeFr = (iso: string) =>
  new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

/** How often the running total is refreshed while a session is open. */
const POLL_MS = 60_000

export default function RecetteControl({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter()
  const pathname = usePathname()
  const [current, setCurrent] = useState<Current | null>(null)
  const [dialog, setDialog] = useState<'open' | 'close' | 'movement' | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/recettes/current', { cache: 'no-store' })
      if (!res.ok) return
      setCurrent(await res.json())
    } catch {
      // Offline or logged out — keep whatever was on screen rather than
      // flashing "caisse fermée", which would be a lie about the till.
    }
  }, [])

  // Subscribe to the till: a poll whose first tick fires straight away. It is
  // re-armed whenever the manager moves to another page, since an order may
  // have just been rung up on the one they left.
  useEffect(() => {
    const first = setTimeout(load, 0)
    const timer = setInterval(load, POLL_MS)
    return () => {
      clearTimeout(first)
      clearInterval(timer)
    }
  }, [load, pathname])

  const done = () => {
    setDialog(null)
    load()
    router.refresh()
  }

  const recette = current?.recette ?? null
  const totals = current?.totals

  return (
    <div className="px-3 pb-3">
      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/40">
            <Wallet size={13} /> Recette
          </span>
          {current && (
            <span
              className={`flex items-center gap-1 text-[11px] font-bold ${
                recette ? 'text-green-400' : 'text-white/40'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${recette ? 'bg-green-400' : 'bg-white/30'}`}
              />
              {recette ? 'Ouverte' : 'Fermée'}
            </span>
          )}
        </div>

        {!current ? (
          <p className="text-xs text-white/30">Chargement…</p>
        ) : recette ? (
          <>
            <Link
              href={`/recettes/${recette._id}`}
              onClick={onNavigate}
              className="block text-sm font-bold text-white hover:text-[#F5A800] transition-colors"
            >
              {recette.number}
            </Link>
            <p className="text-[11px] text-white/40">depuis {timeFr(recette.openedAt)}</p>
            <p className="mt-1.5 text-sm font-black text-[#F5A800]">{money(totals?.revenue ?? 0)}</p>
            <p className="text-[11px] text-white/40">
              {totals?.orders ?? 0} commande{(totals?.orders ?? 0) > 1 ? 's' : ''}
              {totals?.cancelled ? ` · ${totals.cancelled} annulée${totals.cancelled > 1 ? 's' : ''}` : ''}
            </p>

            {/* Ce que le tiroir doit contenir : le chiffre qu'on vérifie d'un
                coup d'œil avant de payer un fournisseur. */}
            <div className="mt-2 flex items-center justify-between rounded-lg bg-black/20 px-2 py-1.5">
              <span className="text-[11px] text-white/40">Tiroir</span>
              <span
                className={`text-xs font-bold ${
                  (current.cashInDrawer ?? 0) < -0.005 ? 'text-red-400' : 'text-white/80'
                }`}
              >
                {money(current.cashInDrawer ?? 0)}
              </span>
            </div>

            <button
              onClick={() => setDialog('movement')}
              className="mt-1.5 w-full flex items-center justify-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 text-xs font-semibold py-2 transition-colors"
            >
              <ArrowLeftRight size={13} /> Mouvement de caisse
            </button>
            <button
              onClick={() => setDialog('close')}
              className="mt-1.5 w-full flex items-center justify-center gap-1.5 rounded-lg bg-white/10 hover:bg-red-500/20 text-white/80 hover:text-red-300 text-xs font-semibold py-2 transition-colors"
            >
              <Lock size={13} /> Clôturer la caisse
            </button>
          </>
        ) : (
          <>
            <p className="text-[11px] text-white/40 leading-snug">
              Les commandes prises maintenant ne sont rattachées à aucune recette.
            </p>
            <button
              onClick={() => setDialog('open')}
              className="mt-2.5 w-full flex items-center justify-center gap-1.5 rounded-lg bg-[#F5A800] hover:bg-[#FF6B00] text-black text-xs font-bold py-2 transition-colors"
            >
              <LockOpen size={13} /> Ouvrir la caisse
            </button>
          </>
        )}
      </div>

      <OpenDialog open={dialog === 'open'} onClose={() => setDialog(null)} onDone={done} />
      {recette && totals && (
        <>
          <CashMovementDialog
            recetteId={recette._id}
            open={dialog === 'movement'}
            onOpenChange={(v) => !v && setDialog(null)}
            cashInDrawer={current?.cashInDrawer ?? 0}
            onSaved={done}
          />
          <CloseDialog
            open={dialog === 'close'}
            recette={recette}
            totals={totals}
            cashInDrawer={current?.cashInDrawer ?? 0}
            onClose={() => setDialog(null)}
            onDone={done}
          />
        </>
      )}
    </div>
  )
}

function OpenDialog({
  open,
  onClose,
  onDone,
}: {
  open: boolean
  onClose: () => void
  onDone: () => void
}) {
  const [openingFloat, setOpeningFloat] = useState('0')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/recettes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ openingFloat: Number(openingFloat) || 0, notes: notes.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur')
      toast.success(`Caisse ouverte — ${data.number}`)
      setOpeningFloat('0')
      setNotes('')
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Ouvrir la caisse</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4 pt-2">
          <div className="space-y-1">
            <Label>Fond de caisse (DT)</Label>
            <Input
              type="number"
              min="0"
              step="0.1"
              value={openingFloat}
              onChange={(e) => setOpeningFloat(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              La monnaie déjà dans le tiroir avant la première vente.
            </p>
          </div>
          <div className="space-y-1">
            <Label>Note (facultatif)</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-[#F5A800] hover:bg-[#FF6B00] text-black font-bold"
            >
              {loading ? 'Ouverture…' : 'Ouvrir'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function CloseDialog({
  open,
  recette,
  totals,
  cashInDrawer,
  onClose,
  onDone,
}: {
  open: boolean
  recette: OpenRecette
  totals: Totals
  cashInDrawer: number
  onClose: () => void
  onDone: () => void
}) {
  const [closingCash, setClosingCash] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  const expected = cashInDrawer
  const counted = closingCash.trim() === '' ? null : Number(closingCash)
  const gap = counted === null || Number.isNaN(counted) ? null : counted - expected

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch(`/api/recettes/${recette._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ closingCash: closingCash.trim() === '' ? null : Number(closingCash), notes: notes.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur')
      toast.success(`Caisse clôturée — ${data.number}`)
      setClosingCash('')
      setNotes('')
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Clôturer {recette.number}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4 pt-2">
          <dl className="rounded-xl border bg-muted/40 divide-y text-sm">
            <Row label="Commandes" value={String(totals.orders)} />
            <Row label="Chiffre d'affaires" value={money(totals.revenue)} strong />
            <Row label="Net (après commissions)" value={money(totals.net)} />
            <Row label="Fond à l'ouverture" value={money(recette.openingFloat || 0)} />
            <Row label="Ventes en espèces" value={`+ ${money(totals.cashSales ?? 0)}`} />
            {/* Seules les lignes qui ont bougé : une colonne de zéros apprend à
                ne plus lire le bloc. */}
            {(totals.apports ?? 0) > 0 && (
              <Row label="Ajouts au fond" value={`+ ${money(totals.apports)}`} />
            )}
            {(totals.achats ?? 0) > 0 && <Row label="Achats" value={`− ${money(totals.achats)}`} />}
            {(totals.depenses ?? 0) > 0 && (
              <Row label="Dépenses" value={`− ${money(totals.depenses)}`} />
            )}
            {(totals.retraits ?? 0) > 0 && (
              <Row label="Retraits" value={`− ${money(totals.retraits)}`} />
            )}
            <Row label="Espèces attendues" value={money(expected)} strong />
          </dl>

          {/* Avant de compter le tiroir : de tout ce qui a été vendu ce jour,
              qu'est-ce qui est réellement arrivé ? Le tiroir n'en est qu'une
              partie — le TPE est payé sans y être, une plateforme peut ne rien
              avoir versé encore. */}
          {typeof totals.collected === 'number' && (
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  Encaissé
                </p>
                <p className="text-lg font-black tabular-nums text-emerald-600 dark:text-emerald-400">
                  {money(totals.collected)}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  espèces {money(totals.cashSales ?? 0)} · TPE {money(totals.cardSales ?? 0)}
                  {(totals.platformPaid ?? 0) > 0 && ` · plateformes ${money(totals.platformPaid ?? 0)}`}
                </p>
              </div>
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                  À recevoir
                </p>
                <p className="text-lg font-black tabular-nums text-amber-600 dark:text-amber-400">
                  {money(totals.receivable ?? 0)}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  plateformes {money((totals.platformDue ?? 0) - (totals.platformPaid ?? 0))}
                  {(totals.unsettled ?? 0) > 0 && ` · non renseigné ${money(totals.unsettled ?? 0)}`}
                </p>
              </div>
            </div>
          )}
          <p className="text-xs text-muted-foreground -mt-2">
            Comptez le tiroir en entier, fond compris. Ni le TPE ni les plateformes n&apos;y sont :
            payé n&apos;est pas la même chose que dans le tiroir.
          </p>

          <div className="space-y-1">
            <Label>Espèces comptées (DT)</Label>
            <Input
              type="number"
              min="0"
              step="0.1"
              placeholder="laisser vide si non compté"
              value={closingCash}
              onChange={(e) => setClosingCash(e.target.value)}
            />
            {gap !== null && (
              <p
                className={`text-xs font-semibold ${
                  Math.abs(gap) < 0.005 ? 'text-green-600' : gap > 0 ? 'text-amber-600' : 'text-red-600'
                }`}
              >
                Écart : {gap > 0 ? '+' : ''}
                {gap.toFixed(2)} DT
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label>Note (facultatif)</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {totals.inProgress > 0 && (
            <p className="rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs px-3 py-2">
              {totals.inProgress} commande{totals.inProgress > 1 ? 's' : ''} pas encore livrée{totals.inProgress > 1 ? 's' : ''} —
              elle{totals.inProgress > 1 ? 's' : ''} rest{totals.inProgress > 1 ? 'ent' : 'e'} rattachée{totals.inProgress > 1 ? 's' : ''} à cette recette et compte{totals.inProgress > 1 ? 'nt' : ''} dans son total.
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            La clôture fige ces chiffres : la recette ne pourra plus être rouverte.
          </p>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading} className="bg-red-600 hover:bg-red-700 text-white font-bold">
              {loading ? 'Clôture…' : 'Clôturer'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between px-3 py-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={strong ? 'font-black text-foreground' : 'font-semibold text-foreground'}>{value}</dd>
    </div>
  )
}
