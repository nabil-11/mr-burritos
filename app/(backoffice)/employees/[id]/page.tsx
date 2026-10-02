import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { accountOf } from '@/lib/employeeAccount'
import { LINE_META, METHOD_LABEL, currentMonth, isMonth, monthLabel, rowFor } from '@/lib/payroll'
import { DEFAULT_TIME_ZONE } from '@/lib/reportTime'
import { EditEmployeeButton } from '../EmployeeForm'
import { CancelEntryButton, EntryActions } from '../EntryActions'
import MonthNav from '../MonthNav'

const money = (n: number) => `${(Number(n) || 0).toFixed(2)} DT`
const when = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: DEFAULT_TIME_ZONE,
  })
const dateFr = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: DEFAULT_TIME_ZONE }) : '—'

/**
 * Le compte d'un employé : sa fiche, le mois choisi décomposé jusqu'au reste à
 * payer, chaque ligne du mois, et l'historique de tous les mois suivis.
 */
export default async function EmployeePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ month?: string }>
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams])
  const account = await accountOf(id)
  if (!account) notFound()
  const { employee: e, rows, lines, balance } = account

  const thisMonth = currentMonth()
  const month = isMonth(sp.month) && sp.month <= thisMonth ? sp.month : thisMonth
  const r = rowFor(rows, month)
  const monthLines = lines.filter((l) => l.month === month)

  const info = [
    { label: 'Poste', value: e.poste || '—' },
    { label: 'Téléphone', value: e.phone || '—' },
    { label: 'CIN', value: e.cin || '—' },
    { label: 'Adresse', value: e.address || '—' },
    { label: 'Embauche', value: dateFr(e.hireDate) },
    { label: 'Salaire', value: e.salary > 0 ? money(e.salary) : '—' },
    { label: 'Suivi depuis', value: monthLabel(e.trackFrom) },
    ...(e.isActive ? [] : [{ label: 'Parti le', value: dateFr(e.leftAt) }]),
  ]

  const steps = [
    { label: 'Report du mois précédent', value: r.opening, sign: '', tone: 'text-muted-foreground', show: true },
    { label: 'Salaire du mois', value: r.salary, sign: '+', tone: '', show: true },
    { label: 'Primes', value: r.primes, sign: '+', tone: 'text-emerald-700 dark:text-emerald-400', show: r.primes > 0 },
    { label: 'Retenues', value: r.retenues, sign: '−', tone: 'text-red-700 dark:text-red-400', show: r.retenues > 0 },
    { label: 'Avances', value: r.avances, sign: '−', tone: 'text-orange-700 dark:text-orange-400', show: true },
    { label: 'Paiements', value: r.paiements, sign: '−', tone: 'text-sky-700 dark:text-sky-400', show: true },
  ].filter((s) => s.show)

  return (
    <div>
      <Link href={`/employees?month=${month}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft size={14} /> Employés
      </Link>

      {/* ── En-tête ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold flex flex-wrap items-center gap-2">
            {e.name}
            {!e.isActive && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">Inactif</span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Dû aujourd&apos;hui :{' '}
            <span className={`font-bold ${balance < -0.005 ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}>
              {money(balance)}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <EntryActions employeeId={e._id} employeeName={e.name} balance={balance} />
          <EditEmployeeButton employee={e} label="Fiche" />
        </div>
      </div>

      <div className="bg-card rounded-xl border p-4 mb-4">
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3 text-sm">
          {info.map((i) => (
            <div key={i.label} className="min-w-0">
              <dt className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{i.label}</dt>
              <dd className="truncate">{i.value}</dd>
            </div>
          ))}
        </dl>
        {e.notes && <p className="mt-3 border-t pt-3 text-sm text-muted-foreground whitespace-pre-line">{e.notes}</p>}
      </div>

      <div className="mb-4">
        <MonthNav month={month} thisMonth={thisMonth} href={(m) => `/employees/${e._id}?month=${m}`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* ── Le mois, jusqu'au reste à payer ─────────────────────── */}
        <section className="bg-card rounded-xl border p-4">
          <h2 className="font-semibold text-sm capitalize mb-3">{monthLabel(month)}</h2>
          <dl className="space-y-2 text-sm">
            {steps.map((s) => (
              <div key={s.label} className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{s.label}</dt>
                <dd className={`tabular-nums font-semibold ${s.tone}`}>
                  {s.sign && s.value > 0 ? `${s.sign} ` : ''}
                  {money(s.value)}
                </dd>
              </div>
            ))}
            <div className="flex justify-between gap-3 border-t pt-2 text-base">
              <dt className="font-bold">Reste à payer</dt>
              <dd className={`tabular-nums font-black ${r.closing < -0.005 ? 'text-red-600 dark:text-red-400' : 'text-[#F5A800]'}`}>
                {money(r.closing)}
              </dd>
            </div>
          </dl>
          {r.closing < -0.005 && (
            <p className="mt-2 text-xs text-red-600 dark:text-red-400">
              Il a reçu {money(-r.closing)} de plus que dû : la différence se déduit du mois suivant.
            </p>
          )}
        </section>

        {/* ── Les lignes du mois ──────────────────────────────────── */}
        <section className="bg-card rounded-xl border overflow-hidden lg:col-span-2">
          <div className="px-4 py-3 border-b">
            <h2 className="font-semibold text-sm">
              Mouvements du mois <span className="font-normal text-muted-foreground">({monthLines.length})</span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Ce qui vient de la caisse s&apos;annule sur sa recette ; le reste, ici.
            </p>
          </div>
          {monthLines.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">Aucun mouvement ce mois-ci</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-140">
                <tbody className="divide-y">
                  {monthLines.map((l) => {
                    const meta = LINE_META[l.kind]
                    return (
                      <tr key={l.id} className={l.cancelled ? 'text-muted-foreground' : 'hover:bg-muted/50'}>
                        <td className="px-4 py-2.5 whitespace-nowrap capitalize">{when(l.at)}</td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${meta.badge} ${l.cancelled ? 'opacity-50' : ''}`}>
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {l.cancelled && <span className="font-semibold">Annulée · </span>}
                          {[l.method ? METHOD_LABEL[l.method] : null, l.note, l.by]
                            .filter(Boolean)
                            .join(' · ')}
                          {l.source === 'caisse' && l.recetteId && (
                            <>
                              {(l.note || l.by) && ' · '}
                              <Link href={`/recettes/${l.recetteId}`} className="font-medium text-foreground hover:text-[#F5A800]">
                                {l.recetteNumber}
                              </Link>
                            </>
                          )}
                        </td>
                        <td className={`px-4 py-2.5 text-right font-bold tabular-nums whitespace-nowrap ${l.cancelled ? 'line-through' : meta.tone}`}>
                          {meta.sign > 0 ? '+' : '−'} {money(l.amount)}
                        </td>
                        <td className="px-4 py-2.5 text-right w-16">
                          {l.source === 'manuel' && !l.cancelled && (
                            <CancelEntryButton employeeId={e._id} entryId={l.id} label={`${meta.label} ${money(l.amount)}`} />
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* ── Tous les mois ─────────────────────────────────────────── */}
      <section className="bg-card rounded-xl border overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h2 className="font-semibold text-sm">Historique</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Chaque mois reprend le reste du précédent.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-180">
            <thead className="bg-muted/50 border-b">
              <tr>
                {['Mois', 'Report', 'Salaire', 'Primes', 'Retenues', 'Avances', 'Payé', 'Reste à payer'].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {[...rows].reverse().map((m) => (
                <tr key={m.month} className={m.month === month ? 'bg-[#F5A800]/5' : 'hover:bg-muted/50'}>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <Link href={`/employees/${e._id}?month=${m.month}`} className="font-medium capitalize hover:text-[#F5A800]">
                      {monthLabel(m.month)}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{money(m.opening)}</td>
                  <td className="px-4 py-2.5 tabular-nums">{money(m.salary)}</td>
                  <td className="px-4 py-2.5 tabular-nums">{m.primes > 0 ? money(m.primes) : '—'}</td>
                  <td className="px-4 py-2.5 tabular-nums">{m.retenues > 0 ? money(m.retenues) : '—'}</td>
                  <td className="px-4 py-2.5 tabular-nums">{m.avances > 0 ? money(m.avances) : '—'}</td>
                  <td className="px-4 py-2.5 tabular-nums">{m.paiements > 0 ? money(m.paiements) : '—'}</td>
                  <td className={`px-4 py-2.5 tabular-nums font-bold ${m.closing < -0.005 ? 'text-red-600 dark:text-red-400' : ''}`}>
                    {money(m.closing)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
