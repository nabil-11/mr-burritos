import Link from 'next/link'
import { Eye } from 'lucide-react'
import { overview } from '@/lib/employeeAccount'
import { currentMonth, isMonth } from '@/lib/payroll'
import StatusSwitch from '@/components/backoffice/StatusSwitch'
import { AddEmployeeButton, DeleteEmployeeButton, EditEmployeeButton } from './EmployeeForm'
import MonthNav from './MonthNav'

const money = (n: number) => `${(Number(n) || 0).toFixed(2)} DT`

/**
 * Les employés et leur mois : ce qui leur est dû, ce qu'ils ont déjà reçu,
 * ce qui reste. Le détail, ligne par ligne, est sur la page de chacun.
 */
export default async function EmployeesPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const sp = await searchParams
  const thisMonth = currentMonth()
  const month = isMonth(sp.month) && sp.month <= thisMonth ? sp.month : thisMonth
  const list = await overview(month)

  const sum = (pick: (r: (typeof list)[number]) => number) => list.reduce((s, r) => s + pick(r), 0)
  const cards = [
    { label: 'Salaires du mois', value: sum((r) => r.month.salary), tone: '' },
    { label: 'Avances', value: sum((r) => r.month.avances), tone: 'text-orange-700 dark:text-orange-400' },
    { label: 'Payé', value: sum((r) => r.month.paiements), tone: 'text-sky-700 dark:text-sky-400' },
    {
      label: 'Reste à payer',
      value: sum((r) => Math.max(0, r.month.closing)),
      tone: 'text-[#F5A800]',
    },
  ]

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Employés</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Salaires, avances et paiements. Une avance se donne depuis la caisse : Dépense → l&apos;employé.
          </p>
        </div>
        <AddEmployeeButton />
      </div>

      <div className="mb-4">
        <MonthNav month={month} thisMonth={thisMonth} href={(m) => `/employees?month=${m}`} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-card rounded-xl border p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{c.label}</p>
            <p className={`mt-1 text-xl xl:text-2xl font-black tabular-nums ${c.tone}`}>{money(c.value)}</p>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-190">
            <thead className="bg-muted/50 border-b">
              <tr>
                {['Employé', 'Salaire', 'Avances', 'Primes / retenues', 'Payé', 'Reste à payer', 'Actif', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {list.map(({ employee: e, month: r }) => {
                const adjust = Math.round((r.primes - r.retenues) * 100) / 100
                return (
                  <tr key={e._id} className={`hover:bg-muted/50 ${e.isActive ? '' : 'text-muted-foreground'}`}>
                    <td className="px-4 py-3">
                      <Link href={`/employees/${e._id}?month=${month}`} className="font-semibold text-foreground hover:text-[#F5A800]">
                        {e.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">{[e.poste, e.phone].filter(Boolean).join(' · ') || '—'}</p>
                    </td>
                    <td className="px-4 py-3 tabular-nums whitespace-nowrap">{r.salary > 0 ? money(r.salary) : '—'}</td>
                    <td className="px-4 py-3 tabular-nums whitespace-nowrap">
                      {r.avances > 0 ? <span className="font-semibold text-orange-700 dark:text-orange-400">{money(r.avances)}</span> : '—'}
                    </td>
                    <td className="px-4 py-3 tabular-nums whitespace-nowrap">
                      {adjust === 0 ? (
                        '—'
                      ) : (
                        <span className={adjust > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}>
                          {adjust > 0 ? '+' : '−'} {money(Math.abs(adjust))}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums whitespace-nowrap">
                      {r.paiements > 0 ? <span className="text-sky-700 dark:text-sky-400">{money(r.paiements)}</span> : '—'}
                    </td>
                    <td
                      className={`px-4 py-3 tabular-nums font-bold whitespace-nowrap ${
                        r.closing < -0.005 ? 'text-red-600 dark:text-red-400' : r.closing > 0.005 ? 'text-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      {money(r.closing)}
                      {r.opening !== 0 && (
                        <span className="block text-[11px] font-normal text-muted-foreground">
                          dont report {money(r.opening)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusSwitch id={e._id} field="isActive" checked={e.isActive} apiPath="/api/employees" label="Actif" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Link
                          href={`/employees/${e._id}?month=${month}`}
                          className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:border-[#F5A800]/60 hover:text-[#F5A800] transition-colors"
                        >
                          <Eye size={13} /> Voir
                        </Link>
                        <EditEmployeeButton employee={e} />
                        <DeleteEmployeeButton employee={e} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {list.length === 0 && (
          <p className="text-center text-muted-foreground py-10 text-sm">
            Aucun employé — cliquez sur &ldquo;Ajouter&rdquo; pour commencer
          </p>
        )}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Reste à payer = report du mois précédent + salaire + primes − retenues − avances − paiements. En rouge :
        l&apos;employé a reçu plus que dû, la différence se déduit du mois suivant.
      </p>
    </div>
  )
}
