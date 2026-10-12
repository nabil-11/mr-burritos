'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  DAY_KINDS,
  DAY_KIND_LABELS,
  MAX_SHIFTS_PER_DAY,
  WEEKDAYS,
  type DayKind,
  type Planning,
  type PlanningCell,
  type PlanningEmployee,
  type Shift,
} from '@/lib/planning'

/**
 * La grille de la semaine : une ligne par employé, une colonne par jour.
 *
 * Deux gestes, et ils ne font pas la même chose. Un appui sur une **case**
 * note ce qui se passe ce jour-là seulement — un congé, des horaires changés.
 * Un appui sur un **nom** ouvre sa semaine type, celle qui se répète. La case
 * marquée d'un point a été modifiée à la main : elle ne suit plus la semaine
 * type, jusqu'à ce qu'on la lui rende.
 */

const CELL_TONE: Record<PlanningCell['status'], string> = {
  travail: 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/30',
  repos: 'bg-muted/60 text-muted-foreground border-transparent',
  conge: 'bg-sky-500/10 text-sky-800 dark:text-sky-300 border-sky-500/30',
  maladie: 'bg-violet-500/10 text-violet-800 dark:text-violet-300 border-violet-500/30',
  absence: 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30',
  none: 'text-muted-foreground/60 border-dashed border-border',
}

const hoursLabel = (h: number) => `${Number.isInteger(h) ? h : h.toFixed(1).replace('.', ',')} h`
const dayNum = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`
const DEFAULT_SHIFT: Shift = { from: '11:00', to: '16:00' }

async function send(method: 'PUT' | 'PATCH', body: unknown) {
  const res = await fetch('/api/planning', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Erreur')
}

export default function PlanningBoard({ planning }: { planning: Planning }) {
  const [day, setDay] = useState<{ employee: PlanningEmployee; date: string } | null>(null)
  const [week, setWeek] = useState<PlanningEmployee | null>(null)
  const { employees, days, today, canEdit } = planning
  const unplanned = employees.filter((e) => e.schedule.length === 0).length

  if (employees.length === 0) {
    return (
      <p className="rounded-xl border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
        Aucun employé actif. Ajoutez-les dans{' '}
        <Link href="/employees" className="font-semibold text-[#F5A800] hover:underline">
          Employés
        </Link>{' '}
        pour leur donner un planning.
      </p>
    )
  }

  return (
    <>
      {unplanned > 0 && canEdit && (
        <p className="mb-3 rounded-xl border border-[#F5A800]/40 bg-[#F5A800]/10 px-4 py-2.5 text-sm">
          {unplanned} employé{unplanned > 1 ? 's' : ''} sans semaine type — appuyez sur un nom pour la
          définir : elle se répétera chaque semaine.
        </p>
      )}

      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-225 table-fixed">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="w-48 px-4 py-3 text-left font-medium text-muted-foreground">Employé</th>
                {days.map((d) => (
                  <th
                    key={d.date}
                    className={`px-2 py-2 text-center font-medium ${d.date === today ? 'text-[#F5A800]' : 'text-muted-foreground'}`}
                  >
                    <span className="block text-xs">{WEEKDAYS[d.weekday].slice(0, 3)}. {dayNum(d.date)}</span>
                    <span className="block text-[11px] font-normal">
                      {d.working} en poste{d.away > 0 ? ` · ${d.away} abs.` : ''}
                    </span>
                  </th>
                ))}
                <th className="w-20 px-3 py-3 text-right font-medium text-muted-foreground">Semaine</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {employees.map((e) => (
                <tr key={e._id}>
                  <td className="px-4 py-2">
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() => setWeek(e)}
                      title={canEdit ? 'Modifier sa semaine type' : undefined}
                      className="text-left enabled:hover:text-[#F5A800] transition-colors"
                    >
                      <span className="block font-semibold">{e.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {e.poste || '—'}
                        {e.schedule.length === 0 ? ' · sans semaine type' : ''}
                      </span>
                    </button>
                  </td>
                  {days.map((d) => {
                    const cell = e.cells[d.date]
                    return (
                      <td key={d.date} className={`p-1 align-top ${d.date === today ? 'bg-[#F5A800]/5' : ''}`}>
                        <button
                          type="button"
                          disabled={!canEdit}
                          onClick={() => setDay({ employee: e, date: d.date })}
                          title={cell.note || undefined}
                          className={`relative w-full min-h-14 rounded-lg border px-1.5 py-1.5 text-center text-xs font-semibold leading-tight transition-colors enabled:hover:border-[#F5A800] ${CELL_TONE[cell.status]}`}
                        >
                          {cell.source === 'exception' && (
                            <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[#F5A800]" aria-label="Modifié ce jour-là" />
                          )}
                          {cell.status === 'travail' ? (
                            cell.shifts.length ? (
                              cell.shifts.map((s) => (
                                <span key={s.from} className="block tabular-nums">
                                  {s.from} – {s.to}
                                </span>
                              ))
                            ) : (
                              'Travaille'
                            )
                          ) : cell.status === 'none' ? (
                            '—'
                          ) : (
                            DAY_KIND_LABELS[cell.status]
                          )}
                          {cell.note && <span className="block truncate font-normal opacity-80">{cell.note}</span>}
                        </button>
                      </td>
                    )
                  })}
                  <td className="px-3 py-2 text-right">
                    <span className="block font-bold tabular-nums">{hoursLabel(e.hours)}</span>
                    <span className="block text-xs text-muted-foreground">
                      {e.daysWorked} jour{e.daysWorked > 1 ? 's' : ''}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="px-4 py-2.5 border-t text-[11px] text-muted-foreground leading-snug">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#F5A800] align-middle" /> jour modifié à la
          main — il ne suit plus la semaine type.
          {canEdit
            ? ' Une case : ce jour-là seulement. Un nom : la semaine type, qui se répète.'
            : ' Seul un gérant peut modifier le planning.'}
        </p>
      </div>

      {day && <DayDialog key={`${day.employee._id}:${day.date}`} target={day} onClose={() => setDay(null)} />}
      {week && <WeekDialog key={week._id} employee={week} onClose={() => setWeek(null)} />}
    </>
  )
}

/** Un ou deux créneaux horaires, modifiables. */
function ShiftInputs({ shifts, onChange }: { shifts: Shift[]; onChange: (s: Shift[]) => void }) {
  const set = (i: number, patch: Partial<Shift>) => onChange(shifts.map((s, j) => (j === i ? { ...s, ...patch } : s)))
  return (
    <div className="space-y-2">
      {shifts.map((s, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input type="time" value={s.from} onChange={(e) => set(i, { from: e.target.value })} className="w-28" aria-label="Début" />
          <span className="text-muted-foreground">–</span>
          <Input type="time" value={s.to} onChange={(e) => set(i, { to: e.target.value })} className="w-28" aria-label="Fin" />
          <button
            type="button"
            onClick={() => onChange(shifts.filter((_, j) => j !== i))}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Retirer ce créneau"
          >
            <X size={14} />
          </button>
        </div>
      ))}
      {shifts.length < MAX_SHIFTS_PER_DAY && (
        <button
          type="button"
          onClick={() => onChange([...shifts, shifts.length ? { from: '18:00', to: '23:00' } : DEFAULT_SHIFT])}
          className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          <Plus size={13} /> {shifts.length ? 'Second créneau (coupure)' : 'Ajouter des horaires'}
        </button>
      )}
    </div>
  )
}

/** Ce jour-là seulement. */
function DayDialog({ target, onClose }: { target: { employee: PlanningEmployee; date: string }; onClose: () => void }) {
  const router = useRouter()
  const { employee, date } = target
  const cell = employee.cells[date]
  const [kind, setKind] = useState<DayKind>(cell.status === 'none' ? 'travail' : cell.status)
  const [shifts, setShifts] = useState<Shift[]>(cell.shifts.length ? cell.shifts : [DEFAULT_SHIFT])
  const [note, setNote] = useState(cell.note)
  const [busy, setBusy] = useState(false)

  const save = async (body: Record<string, unknown>, done: string) => {
    setBusy(true)
    try {
      await send('PUT', { employeeId: employee._id, date, ...body })
      toast.success(done)
      onClose()
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setBusy(false)
    }
  }

  const label = new Date(`${date}T12:00:00Z`).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
  })

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {employee.name} · <span className="capitalize">{label}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div className="flex flex-wrap gap-2">
            {DAY_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
                  kind === k ? 'border-[#F5A800] bg-[#F5A800] text-black' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {DAY_KIND_LABELS[k]}
              </button>
            ))}
          </div>
          {kind === 'travail' && <ShiftInputs shifts={shifts} onChange={setShifts} />}
          <Input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="Note (optionnel) — ex : remplace Sami" />
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            {cell.source === 'exception' ? (
              <Button type="button" variant="ghost" disabled={busy} onClick={() => save({ kind: 'semaine' }, 'Jour rendu à la semaine type')}>
                Revenir à la semaine type
              </Button>
            ) : (
              <span />
            )}
            <Button
              type="button"
              disabled={busy}
              onClick={() => save({ kind, shifts: kind === 'travail' ? shifts : [], note }, 'Planning mis à jour')}
              className="bg-[#F5A800] text-black hover:bg-[#FF6B00]"
            >
              {busy ? 'Enregistrement…' : 'Enregistrer ce jour'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** La semaine type : ce qui se répète. */
function WeekDialog({ employee, onClose }: { employee: PlanningEmployee; onClose: () => void }) {
  const router = useRouter()
  const [week, setWeek] = useState<Shift[][]>(() =>
    WEEKDAYS.map((_, day) => employee.schedule.filter((s) => s.day === day).map(({ from, to }) => ({ from, to })))
  )
  const [busy, setBusy] = useState(false)
  const setDay = (day: number, shifts: Shift[]) => setWeek(week.map((d, i) => (i === day ? shifts : d)))
  // Le premier jour rempli sert de modèle : la plupart des semaines sont six fois le même jour.
  const model = week.find((d) => d.length > 0)

  const save = async () => {
    setBusy(true)
    try {
      await send('PATCH', {
        employeeId: employee._id,
        schedule: week.flatMap((shifts, day) => shifts.map((s) => ({ day, ...s }))),
      })
      toast.success(`Semaine type de ${employee.name} enregistrée`)
      onClose()
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Semaine type · {employee.name}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Elle se répète toutes les semaines. Un jour sans horaires est un jour de repos.
        </p>
        <div className="divide-y">
          {WEEKDAYS.map((name, day) => (
            <div key={name} className="flex items-start gap-3 py-2.5">
              <span className="w-20 pt-2 text-sm font-semibold">{name}</span>
              <div className="flex-1">
                {week[day].length === 0 && <p className="pt-2 pb-1 text-sm text-muted-foreground">Repos</p>}
                <ShiftInputs shifts={week[day]} onChange={(s) => setDay(day, s)} />
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            disabled={!model || busy}
            onClick={() => model && setWeek(week.map((d) => (d.length ? d : model.map((s) => ({ ...s })))))}
            title="Donne aux jours de repos les horaires du premier jour rempli"
          >
            Mêmes horaires tous les jours
          </Button>
          <Button type="button" disabled={busy} onClick={save} className="bg-[#F5A800] text-black hover:bg-[#FF6B00]">
            {busy ? 'Enregistrement…' : 'Enregistrer la semaine'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
