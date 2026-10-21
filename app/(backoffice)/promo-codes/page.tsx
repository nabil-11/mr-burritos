import { connectDB } from '@/lib/mongodb'
import { Order } from '@/lib/models/Order'
import { PromoCode } from '@/lib/models/PromoCode'
import { promoBadge } from '@/lib/promo'
import { defaultExpiry, lastValidDay, type CodeDoc } from '@/lib/promoCodes'
import { DEFAULT_TIME_ZONE, dayOf } from '@/lib/reportTime'
import StatusSwitch from '@/components/backoffice/StatusSwitch'
import PromoCodeForm, { DeletePromoCode, type SerializedPromoCode } from './PromoCodeForm'

type Usage = { _id: string; uses: number; amount: number; revenue: number }

const STATES = {
  active: { label: 'En cours', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
  soon: { label: 'Expire bientôt', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  scheduled: { label: 'Programmé', cls: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300' },
  expired: { label: 'Expiré', cls: 'bg-muted text-muted-foreground' },
  exhausted: { label: 'Épuisé', cls: 'bg-muted text-muted-foreground' },
  off: { label: 'Désactivé', cls: 'bg-muted text-muted-foreground' },
} as const

const frDay = (day: string) => {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('fr-FR', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' })
}
const dt = (n: number) => `${n.toFixed(2)} DT`
const DAY_MS = 86_400_000

export default async function PromoCodesPage() {
  await connectDB()
  const [codes, usage] = await Promise.all([
    PromoCode.find().sort({ createdAt: -1 }).lean() as Promise<(CodeDoc & { createdAt?: Date })[]>,
    // A use is an order that carries the code and still counts — see lib/promoCodes.
    Order.aggregate<Usage>([
      { $match: { 'promo.code': { $gt: '' }, status: { $ne: 'cancelled' } } },
      { $group: { _id: '$promo.code', uses: { $sum: 1 }, amount: { $sum: '$promo.amount' }, revenue: { $sum: '$total' } } },
    ]),
  ])
  const usageOf = new Map(usage.map((u) => [u._id, u]))
  const now = new Date().getTime()

  const rows = codes.map((c) => {
    const u = usageOf.get(c.code)
    const uses = u?.uses ?? 0
    const expiresAt = new Date(c.expiresAt).getTime()
    const state: keyof typeof STATES =
      c.isActive === false
        ? 'off'
        : now >= expiresAt
          ? 'expired'
          : c.maxUses && uses >= c.maxUses
            ? 'exhausted'
            : c.startsAt && now < new Date(c.startsAt).getTime()
              ? 'scheduled'
              : expiresAt - now < 3 * DAY_MS
                ? 'soon'
                : 'active'
    const serialized: SerializedPromoCode = {
      _id: String(c._id),
      code: c.code,
      description: c.description ?? '',
      kind: c.kind,
      value: c.value,
      minSubtotal: c.minSubtotal ?? 0,
      startsOn: c.startsAt ? dayOf(c.startsAt, DEFAULT_TIME_ZONE) : '',
      expiresOn: lastValidDay(new Date(c.expiresAt)),
      maxUses: c.maxUses ?? 0,
      maxUsesPerCustomer: c.maxUsesPerCustomer ?? 0,
      stackable: Boolean(c.stackable),
      isActive: c.isActive !== false,
    }
    return { c: serialized, uses, amount: u?.amount ?? 0, revenue: u?.revenue ?? 0, state, daysLeft: Math.ceil((expiresAt - now) / DAY_MS) }
  })

  const live = rows.filter((r) => r.state === 'active' || r.state === 'soon').length
  const totalGiven = rows.reduce((s, r) => s + r.amount, 0)

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Codes promo</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Saisis par le client au panier du site · {live} en cours · {dt(totalGiven)} de remises accordées
          </p>
        </div>
        <PromoCodeForm defaultExpiresOn={defaultExpiry()} />
      </div>

      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-225">
            <thead className="bg-muted/50 border-b">
              <tr>
                {['Code', 'Réduction', 'Validité', 'Utilisations', 'Remises / CA', 'Actif', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map(({ c, uses, amount, revenue, state, daysLeft }) => (
                <tr key={c._id} className={`hover:bg-muted/50 ${state === 'expired' || state === 'off' ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-3">
                    <p className="font-mono font-black tracking-wider text-foreground">{c.code}</p>
                    {c.description && <p className="text-xs text-muted-foreground mt-0.5">{c.description}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300 font-black text-sm px-2.5 py-1 rounded-full">
                      {promoBadge(c)}
                    </span>
                    <p className="text-xs text-muted-foreground mt-1">
                      {c.stackable ? 'Cumulable avec −15 % en ligne' : 'Remplace −15 % en ligne'}
                      {c.minSubtotal > 0 && ` · dès ${dt(c.minSubtotal)}`}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex text-xs font-bold px-2 py-0.5 rounded-full ${STATES[state].cls}`}>
                      {STATES[state].label}
                      {state === 'soon' && ` · ${daysLeft <= 1 ? 'dernier jour' : `${daysLeft} j`}`}
                    </span>
                    <p className="text-xs text-muted-foreground mt-1">
                      {c.startsOn ? `Du ${frDay(c.startsOn)} au ` : "Jusqu'au "}
                      {frDay(c.expiresOn)} inclus
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold tabular-nums">
                      {uses}
                      {c.maxUses > 0 && <span className="text-muted-foreground font-normal"> / {c.maxUses}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {c.maxUsesPerCustomer > 0 ? `${c.maxUsesPerCustomer}× par client` : 'Sans limite par client'}
                    </p>
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {uses > 0 ? (
                      <>
                        <p className="font-semibold text-green-600">−{dt(amount)}</p>
                        <p className="text-xs text-muted-foreground">{dt(revenue)} encaissés</p>
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusSwitch id={c._id} field="isActive" checked={c.isActive} apiPath="/api/promo-codes" label="Actif" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <PromoCodeForm code={c} defaultExpiresOn={c.expiresOn} />
                      <DeletePromoCode id={c._id} code={c.code} uses={uses} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && (
          <p className="text-center text-muted-foreground py-10 text-sm">
            Aucun code — créez-en un et partagez-le sur vos réseaux, vos flyers ou vos tickets.
          </p>
        )}
      </div>
    </div>
  )
}
