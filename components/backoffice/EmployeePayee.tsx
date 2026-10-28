'use client'

import { useEffect, useState } from 'react'
import { Label } from '@/components/ui/label'

/**
 * « Versé à un employé » — partagé par le mouvement de caisse en direct et le
 * mouvement oublié d'une recette clôturée.
 *
 * Une dépense peut être versée à un employé — une avance, ou son salaire. Elle
 * est alors rattachée à son compte, et le serveur l'intitule « Avance ·
 * Houssine ». Son solde est affiché pour qu'on voie avant de donner — ici
 * seulement : la caisse, elle, ne reçoit que les noms.
 */

export interface PayableEmployee {
  _id: string
  name: string
  poste?: string
  balance?: number
}

export type PayReason = 'avance' | 'salaire'

const money = (n: number) => `${(Number(n) || 0).toFixed(2)} DT`

/** Les employés qu'on peut encore payer, avec leur reste à payer. */
export function usePayableEmployees() {
  const [employees, setEmployees] = useState<PayableEmployee[]>([])
  useEffect(() => {
    let live = true
    fetch('/api/employees?active=1&balance=1')
      .then((r) => (r.ok ? r.json() : []))
      .then((list) => live && Array.isArray(list) && setEmployees(list))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [])
  return employees
}

export const payLabel = (employee: PayableEmployee, reason: PayReason) =>
  `${reason === 'salaire' ? 'Salaire' : 'Avance'} · ${employee.name}`

export function EmployeePayeePicker({
  employees,
  employeeId,
  onEmployee,
  reason,
  onReason,
  amount,
  accent,
}: {
  employees: PayableEmployee[]
  employeeId: string | null
  onEmployee: (id: string | null) => void
  reason: PayReason
  onReason: (r: PayReason) => void
  /** Le montant saisi : en rouge, le solde qu'il dépasse. */
  amount: number | null
  /** Les classes du genre de mouvement, pour l'employé choisi. */
  accent: string
}) {
  if (employees.length === 0) return null
  const employee = employees.find((e) => e._id === employeeId) ?? null
  return (
    <div className="space-y-1.5">
      <Label>Versé à un employé</Label>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Employé">
        {employees.map((e) => (
          <button
            key={e._id}
            type="button"
            aria-pressed={employeeId === e._id}
            title={e.poste || undefined}
            onClick={() => onEmployee(employeeId === e._id ? null : e._id)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
              employeeId === e._id ? accent : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            {e.name}
          </button>
        ))}
      </div>
      {employee && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-muted/40 px-3 py-2">
          <div className="inline-flex rounded-lg border bg-background p-0.5 text-xs font-semibold" role="radiogroup">
            {(['avance', 'salaire'] as const).map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={reason === r}
                onClick={() => onReason(r)}
                className={`rounded-md px-2.5 py-1 transition-colors ${
                  reason === r ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {r === 'avance' ? 'Avance' : 'Salaire'}
              </button>
            ))}
          </div>
          {typeof employee.balance === 'number' && (
            <span className="text-xs text-muted-foreground">
              Reste à lui payer :{' '}
              <span
                className={`font-bold ${
                  amount !== null && amount > employee.balance + 0.005
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-foreground'
                }`}
              >
                {money(employee.balance)}
              </span>
            </span>
          )}
        </div>
      )}
    </div>
  )
}
