'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import type { EmployeeView } from '@/lib/employeeAccount'
import { currentMonth } from '@/lib/payroll'

export type { EmployeeView }

const POSTES = ['Cuisinier', 'Aide cuisinier', 'Caissier', 'Serveur', 'Livreur', 'Plonge', 'Gérant']

const dayOf = (iso: string | null) => (iso ? iso.slice(0, 10) : '')

function EmployeeDialog({ employee, trigger }: { employee?: EmployeeView; trigger: React.ReactElement }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const thisMonth = currentMonth()
  const initial = {
    name: employee?.name ?? '',
    poste: employee?.poste ?? '',
    phone: employee?.phone ?? '',
    cin: employee?.cin ?? '',
    address: employee?.address ?? '',
    hireDate: dayOf(employee?.hireDate ?? null),
    salary: employee?.salary ? String(employee.salary) : '',
    salaryFrom: thisMonth,
    trackFrom: employee?.trackFrom ?? thisMonth,
    openingBalance: employee?.openingBalance ? String(employee.openingBalance) : '',
    notes: employee?.notes ?? '',
  }
  const [form, setForm] = useState(initial)
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value })

  const salaryChanged = Boolean(employee) && Number(form.salary.replace(',', '.') || 0) !== (employee?.salary ?? 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { salaryFrom, ...rest } = form
      const body = salaryChanged || !employee ? { ...rest, salaryFrom } : rest
      const url = employee ? `/api/employees/${employee._id}` : '/api/employees'
      const res = await fetch(url, {
        method: employee ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Erreur')
      toast.success(employee ? 'Fiche mise à jour' : 'Employé ajouté')
      setOpen(false)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (v) setForm(initial)
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{employee ? `Modifier · ${employee.name}` : 'Nouvel employé'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 pt-1">
          <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <legend className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Fiche</legend>
            <div className="space-y-1">
              <Label htmlFor="emp-name">Nom *</Label>
              <Input id="emp-name" value={form.name} maxLength={60} onChange={set('name')} placeholder="ex : Houssine" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="emp-poste">Poste</Label>
              <Input id="emp-poste" list="emp-postes" value={form.poste} maxLength={40} onChange={set('poste')} placeholder="Cuisinier, livreur…" />
              <datalist id="emp-postes">
                {POSTES.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1">
              <Label htmlFor="emp-phone">Téléphone</Label>
              <Input id="emp-phone" value={form.phone} maxLength={30} inputMode="tel" onChange={set('phone')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="emp-cin">CIN</Label>
              <Input id="emp-cin" value={form.cin} maxLength={20} onChange={set('cin')} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="emp-address">Adresse</Label>
              <Input id="emp-address" value={form.address} maxLength={120} onChange={set('address')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="emp-hire">Date d&apos;embauche</Label>
              <Input id="emp-hire" type="date" value={form.hireDate} onChange={set('hireDate')} />
            </div>
          </fieldset>

          <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <legend className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Salaire et compte</legend>
            <div className="space-y-1">
              <Label htmlFor="emp-salary">Salaire mensuel (DT)</Label>
              <Input id="emp-salary" value={form.salary} inputMode="decimal" placeholder="0.00" onChange={set('salary')} />
            </div>
            {salaryChanged && (
              <div className="space-y-1">
                <Label htmlFor="emp-salary-from">Nouveau salaire à partir de</Label>
                <Input id="emp-salary-from" type="month" value={form.salaryFrom} max={thisMonth} onChange={set('salaryFrom')} />
                <p className="text-[11px] text-muted-foreground">Les mois d&apos;avant gardent l&apos;ancien salaire.</p>
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="emp-track">Début du suivi</Label>
              <Input id="emp-track" type="month" value={form.trackFrom} max={thisMonth} onChange={set('trackFrom')} />
              <p className="text-[11px] text-muted-foreground">Premier mois dont le salaire compte.</p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="emp-opening">Solde de départ (DT)</Label>
              <Input id="emp-opening" value={form.openingBalance} inputMode="decimal" placeholder="0.00" onChange={set('openingBalance')} />
              <p className="text-[11px] text-muted-foreground">
                Ce qui lui était dû au début du suivi — négatif s&apos;il devait de l&apos;argent.
              </p>
            </div>
          </fieldset>

          <div className="space-y-1">
            <Label htmlFor="emp-notes">Notes</Label>
            <textarea
              id="emp-notes"
              value={form.notes}
              maxLength={500}
              rows={2}
              onChange={set('notes')}
              className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading} className="bg-[#F5A800] hover:bg-[#FF6B00] text-black font-bold">
              {loading ? 'Sauvegarde...' : 'Sauvegarder'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function DeleteEmployeeButton({ employee }: { employee: Pick<EmployeeView, '_id' | 'name'> }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    if (!confirm(`Supprimer « ${employee.name} » ?`)) return
    setLoading(true)
    try {
      const res = await fetch(`/api/employees/${employee._id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Erreur')
      toast.success('Supprimé')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      aria-label={`Supprimer ${employee.name}`}
      className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 transition-colors"
    >
      <Trash2 size={14} />
    </button>
  )
}

export function AddEmployeeButton() {
  return (
    <EmployeeDialog
      trigger={
        <Button className="bg-[#F5A800] hover:bg-[#FF6B00] text-black font-bold gap-1">
          <Plus size={16} /> Ajouter
        </Button>
      }
    />
  )
}

export function EditEmployeeButton({ employee, label }: { employee: EmployeeView; label?: string }) {
  return (
    <EmployeeDialog
      employee={employee}
      trigger={
        label ? (
          <Button variant="outline" className="gap-1">
            <Pencil size={14} /> {label}
          </Button>
        ) : (
          <button
            aria-label={`Modifier ${employee.name}`}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Pencil size={14} />
          </button>
        )
      }
    />
  )
}
