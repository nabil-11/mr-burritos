/**
 * Mr. Burritos — vérification des règles d'alertes du manager
 * Lance avec : npm run check:alerts
 *
 * Aucune base, aucun serveur : lib/managerAlerts est pur. Le script échoue
 * (code 1) au premier écart, et affiche une ligne par groupe vérifié.
 */

import assert from 'node:assert/strict'
import {
  ALERT_LIMIT,
  CASH_TOLERANCE_DT,
  LATE_GRACE_MINUTES,
  PENDING_MINUTES,
  buildReport,
  computeAlerts,
  formatDuration,
  type Alert,
  type AlertOrder,
  type AlertRecette,
} from '../lib/managerAlerts'

const MIN = 60_000
const NOW = new Date('2026-11-03T12:00:00.000Z')
const ago = (minutes: number) => new Date(NOW.getTime() - minutes * MIN)
const TODAY = new Date('2026-11-02T23:00:00.000Z') // 00:00 à Tunis

let n = 0
const order = (over: Partial<AlertOrder> = {}): AlertOrder => ({
  _id: `o${++n}`,
  orderNumber: `MB-${n}`,
  status: 'delivered',
  source: 'counter',
  type: 'pickup',
  total: 12.5,
  createdAt: ago(60),
  updatedAt: ago(60),
  recette: 'r1',
  ...over,
})
const recette = (over: Partial<AlertRecette> = {}): AlertRecette => ({
  _id: `r${++n}`,
  number: `R-${n}`,
  status: 'closed',
  closedAt: ago(30),
  closingCash: 100,
  cashDifference: 0,
  corrections: [],
  ...over,
})

const kinds = (alerts: Alert[]) => alerts.map((a) => a.kind)
const run = (orders: AlertOrder[], recettes: AlertRecette[] = [], todayStart: Date | null = TODAY) =>
  computeAlerts({ orders, recettes, now: NOW, todayStart })
const one = (orders: AlertOrder[], recettes: AlertRecette[] = []) => run(orders, recettes)
const section = (name: string) => console.log(`ok  ${name}`)

// ── Rien à signaler ─────────────────────────────────────────────────────────
assert.deepEqual(run([order()], [recette()]), [])
assert.deepEqual(run([], []), [])
section('une journée normale ne lève aucune alerte')

// ── order.pending_stale : plus de 10 min, strictement ───────────────────────
{
  const at = (min: number) => one([order({ status: 'pending', createdAt: ago(min) })])
  assert.deepEqual(at(PENDING_MINUTES - 1), [])
  assert.deepEqual(at(PENDING_MINUTES), [], 'exactement 10 min : pas encore')
  const [a] = at(PENDING_MINUTES + 1)
  assert.equal(a.kind, 'order.pending_stale')
  assert.equal(a.severity, 'warning')
  assert.equal(a.at, ago(PENDING_MINUTES + 1).toISOString())
  assert.equal(a.amount, 12.5)
  assert.equal(a.source, 'counter')
  // Un autre statut n'est jamais « en attente depuis trop longtemps ».
  assert.deepEqual(one([order({ status: 'confirmed', createdAt: ago(300), confirmedAt: ago(1) })]), [])
  // L'état vaut aujourd'hui même s'il date d'avant minuit.
  assert.equal(one([order({ status: 'pending', createdAt: ago(60 * 30) })]).length, 1)
}
section('pending_stale : bornes 10 / 10 min / 11 min')

// ── order.late : échéance + 10 min, strictement ─────────────────────────────
{
  // confirmé il y a X min, préparation de 30 min : échéance à X-30, en retard à X-40.
  const at = (x: number, extra: Partial<AlertOrder> = {}) =>
    one([order({ status: 'preparing', confirmedAt: ago(x), preparationDuration: 30, ...extra })])
  assert.deepEqual(at(30), [], 'à l’échéance')
  assert.deepEqual(at(30 + LATE_GRACE_MINUTES - 1), [])
  assert.deepEqual(at(30 + LATE_GRACE_MINUTES), [], 'exactement échéance + 10 min : pas encore')
  const [a] = at(30 + LATE_GRACE_MINUTES + 1)
  assert.equal(a.kind, 'order.late')
  assert.equal(a.severity, 'critical')
  assert.equal(a.at, ago(1).toISOString(), 'at = l’instant où elle est devenue en retard')
  assert.equal(a.meta.deadline, ago(11).toISOString())
  assert.equal(a.meta.minutesLate, 11)
  // confirmedAt absent : on part de createdAt.
  assert.equal(one([order({ status: 'confirmed', createdAt: ago(41), confirmedAt: undefined, preparationDuration: 30 })])[0].kind, 'order.late')
  // Durée absente : 30 min par défaut.
  assert.equal(one([order({ status: 'confirmed', confirmedAt: ago(41), preparationDuration: null })])[0].kind, 'order.late')
  assert.deepEqual(one([order({ status: 'confirmed', confirmedAt: ago(40), preparationDuration: null })]), [])
  // Durée explicite plus longue.
  assert.deepEqual(at(60, { preparationDuration: 60 }), [])
  // Prête, livrée ou en attente : jamais « en retard ».
  for (const status of ['pending', 'ready', 'delivered']) {
    assert.ok(!kinds(one([order({ status, confirmedAt: ago(500), createdAt: ago(500) })])).includes('order.late'), status)
  }
}
section('late : bornes échéance / +10 min / +11 min, repli sur createdAt et 30 min')

// ── order.auto_settled ──────────────────────────────────────────────────────
{
  const [a] = one([order({ autoSettled: true, deliveredAt: ago(20), updatedAt: ago(5) })])
  assert.equal(a.kind, 'order.auto_settled')
  assert.equal(a.severity, 'warning')
  assert.equal(a.at, ago(20).toISOString(), 'deliveredAt d’abord')
  assert.equal(one([order({ autoSettled: true, deliveredAt: undefined, updatedAt: ago(5) })])[0].at, ago(5).toISOString())
  assert.deepEqual(one([order({ autoSettled: false })]), [])
  assert.deepEqual(one([order({ autoSettled: undefined })]), [])
  // Réglée avant minuit : pas d'alerte du jour.
  assert.deepEqual(one([order({ autoSettled: true, deliveredAt: ago(60 * 20) })]), [])
  // Réglée puis annulée : le drapeau reste (historique), mais seule « annulée » est levée.
  assert.deepEqual(
    kinds(one([order({ autoSettled: true, status: 'cancelled', deliveredAt: ago(20), cancelledAt: ago(5) })])),
    ['order.cancelled']
  )
  // Rétablie ensuite (livrée de nouveau) : l'alerte revient.
  assert.deepEqual(kinds(one([order({ autoSettled: true, status: 'delivered', deliveredAt: ago(20), cancelledAt: ago(5) })])), ['order.auto_settled'])
}
section('auto_settled : deliveredAt puis updatedAt, faux / absent ignorés, annulée exclue')

// ── order.cancelled ─────────────────────────────────────────────────────────
{
  const [a] = one([order({ status: 'cancelled', cancelledAt: ago(15), updatedAt: ago(2) })])
  assert.equal(a.kind, 'order.cancelled')
  assert.equal(a.severity, 'info')
  assert.equal(a.at, ago(15).toISOString())
  assert.equal(one([order({ status: 'cancelled', cancelledAt: undefined, updatedAt: ago(2) })])[0].at, ago(2).toISOString())
  // Annulée hier : hors du jour.
  assert.deepEqual(one([order({ status: 'cancelled', cancelledAt: ago(60 * 20) })]), [])
  // Annulée aujourd'hui mais créée hier : comptée.
  assert.equal(one([order({ status: 'cancelled', createdAt: ago(60 * 30), cancelledAt: ago(3) })]).length, 1)
}
section('cancelled : cancelledAt puis updatedAt, fenêtre du jour')

// ── order.orphan ────────────────────────────────────────────────────────────
{
  for (const recetteValue of [null, undefined]) {
    const [a] = one([order({ recette: recetteValue })])
    assert.equal(a.kind, 'order.orphan')
    assert.equal(a.severity, 'warning')
  }
  assert.deepEqual(one([order({ recette: null, status: 'cancelled', cancelledAt: ago(10) })]).map((a) => a.kind), ['order.cancelled'], 'annulée : pas orpheline')
  assert.equal(one([order({ recette: null, source: 'website' })])[0].kind, 'order.orphan', 'le site est rattaché à la recette ouverte : pas d’exception')
  assert.deepEqual(one([order({ recette: null, createdAt: ago(60 * 20) })]), [], 'créée hier : hors du jour')
  assert.deepEqual(one([order({ recette: 'r9' })]), [])
}
section('orphan : recette absente, annulée exclue, site inclus')

// ── recette.cash_gap : |écart| > 1.000, strictement ─────────────────────────
{
  const gap = (d: number | null) => one([], [recette({ cashDifference: d })])
  assert.deepEqual(gap(0), [])
  assert.deepEqual(gap(0.999), [])
  assert.deepEqual(gap(CASH_TOLERANCE_DT), [], '+1.000 : toléré')
  assert.deepEqual(gap(-CASH_TOLERANCE_DT), [], '-1.000 : toléré')
  assert.deepEqual(gap(1.0004), [], 'sous le millime : toléré')
  const [pos] = gap(1.001)
  assert.equal(pos.kind, 'recette.cash_gap')
  assert.equal(pos.severity, 'critical')
  assert.equal(pos.amount, 1.001)
  const [neg] = gap(-2.5)
  assert.equal(neg.amount, -2.5, 'montant signé')
  assert.match(neg.message, /Manque de 2,50\sDT\./)
  assert.equal(neg.message.match(/DT/g)?.length, 1, 'le montant n’est dit qu’une fois')
  assert.ok(!/[-−]\d+,\d{2}/.test(neg.message), 'le signe est dans le mot')
  assert.match(gap(3)[0].message, /Excédent de 3,00\sDT\./)
  assert.ok(!/\d\.\d/.test(neg.message), 'pas de point décimal')
  assert.deepEqual(gap(null), [], 'écart inconnu : rien d’autre qu’une caisse non comptée')
  // Ouverte : pas d'écart à juger.
  assert.deepEqual(one([], [recette({ status: 'open', cashDifference: 50, closedAt: null })]), [])
  // Clôturée hier : hors du jour.
  assert.deepEqual(one([], [recette({ cashDifference: 50, closedAt: ago(60 * 20) })]), [])
}
section('cash_gap : bornes ±1.000 / ±1.001, signe, ouverte et hier ignorées')

// ── recette.not_counted ─────────────────────────────────────────────────────
{
  const [a] = one([], [recette({ closingCash: null, cashDifference: null })])
  assert.equal(a.kind, 'recette.not_counted')
  assert.equal(a.severity, 'warning')
  assert.equal(a.at, ago(30).toISOString())
  assert.deepEqual(one([], [recette({ closingCash: 0, cashDifference: 0 })]), [], '0 compté n’est pas « non compté »')
  assert.deepEqual(one([], [recette({ status: 'open', closingCash: null, closedAt: null })]), [])
}
section('not_counted : null levé, 0 non, ouverte non')

// ── recette.correction : après closedAt ─────────────────────────────────────
{
  const corr = (at: Date, id = 'c1') => ({ _id: id, at, action: 'order.cancel', target: 'MB-9', reason: 'doublon', by: { name: 'Sami' } })
  const closedAt = ago(120)
  const mk = (cs: ReturnType<typeof corr>[]) => recette({ closedAt, corrections: cs })
  assert.deepEqual(one([], [mk([corr(closedAt)])]), [], 'à l’instant de la clôture : pas une correction')
  assert.deepEqual(one([], [mk([corr(ago(121))])]), [], 'avant la clôture')
  const alerts = one([], [mk([corr(ago(119), 'c1'), corr(ago(10), 'c2')])])
  assert.deepEqual(kinds(alerts), ['recette.correction', 'recette.correction'])
  assert.equal(alerts[0].at, ago(10).toISOString(), 'la plus récente d’abord')
  assert.ok(alerts[0].id.endsWith(':c2') && alerts[0].id.startsWith('recette.correction:r'), alerts[0].id)
  assert.equal(alerts[0].severity, 'warning')
  assert.match(alerts[0].message, /Sami/)
  // Recette ouverte : ses corrections ne sont pas « après clôture ».
  assert.deepEqual(one([], [recette({ status: 'open', closedAt: null, corrections: [corr(ago(5))] })]), [])
  // Correction d'hier : hors du jour, même sur une recette clôturée avant.
  assert.deepEqual(one([], [recette({ closedAt: ago(60 * 40), corrections: [corr(ago(60 * 20))] })]), [])
  // Correction du jour sur une recette clôturée avant minuit : comptée.
  assert.equal(one([], [recette({ closedAt: ago(60 * 20), corrections: [corr(ago(5))] })]).length, 1)
}
section('correction : strictement après closedAt, une alerte par entrée, fenêtre du jour')

// ── Pas de données client ───────────────────────────────────────────────────
{
  const dirty = order({ status: 'pending', createdAt: ago(30) }) as AlertOrder & { customer: unknown }
  dirty.customer = { name: 'Sonia', phone: '98123456', email: 'sonia@example.com', address: '12 rue des Oliviers' }
  const text = JSON.stringify(one([dirty]))
  for (const secret of ['98123456', 'sonia@example.com', 'Oliviers', 'Sonia']) assert.ok(!text.includes(secret), secret)
}
section('aucune donnée client dans les alertes')

// ── Français et montants en « 12,50 DT » ──────────────────────────────────
{
  const [a] = one([order({ status: 'cancelled', cancelledAt: ago(1), total: 7 })])
  assert.match(a.message, /7,00\sDT/)
  assert.ok(!/\d\.\d/.test(a.message), 'pas de point décimal')
  const [b] = one([], [recette({ closingCash: null, cashDifference: null })])
  assert.match(b.title, /Caisse non comptée/)
  assert.match(one([], [recette({ cashDifference: 5 })])[0].title, /Écart de caisse/)
}
section('titres en français, montants au format lib/format (12,50 DT)')

// ── Durées lisibles ─────────────────────────────────────────────────────────
{
  const cases: [number, string][] = [
    [59, '59 min'],
    [60, '1 h 00'],
    [125, '2 h 05'],
    [1439, '23 h 59'],
    [1770, '1 j 5 h'],
    [2880, '2 j 0 h'],
  ]
  for (const [minutes, text] of cases) assert.equal(formatDuration(minutes), text, `${minutes} min`)
  // Dans les messages, et les minutes brutes restent dans meta.
  const [p] = one([order({ status: 'pending', createdAt: ago(1800) })])
  assert.match(p.message, /depuis 1 j 6 h\./)
  assert.equal(p.meta.waitedMinutes, 1800)
  const [l] = one([order({ status: 'preparing', confirmedAt: ago(1800), preparationDuration: 30 })])
  assert.match(l.message, /a 1 j 5 h de retard/)
  assert.equal(l.meta.minutesLate, 1770)
  assert.ok(!/\d{3,} min/.test(p.message + l.message), 'plus de minutes brutes')
}
section('durées : 59 / 60 / 125 / 1439 / 1770 min / 2 jours, messages et meta')

// ── Tri : gravité, puis at décroissant ──────────────────────────────────────
{
  const alerts = run(
    [
      order({ status: 'cancelled', cancelledAt: ago(1) }), // info, récent
      order({ status: 'pending', createdAt: ago(50) }), // warning, ancien
      order({ status: 'pending', createdAt: ago(20) }), // warning, récent
      order({ status: 'preparing', confirmedAt: ago(100) }), // critical, ancien
    ],
    [recette({ cashDifference: -9, closedAt: ago(5) })] // critical, récent
  )
  assert.deepEqual(
    alerts.map((a) => a.severity),
    ['critical', 'critical', 'warning', 'warning', 'info']
  )
  assert.equal(alerts[0].kind, 'recette.cash_gap', 'critique le plus récent en premier')
  assert.equal(alerts[1].kind, 'order.late')
  for (let i = 1; i < alerts.length; i++) {
    if (alerts[i - 1].severity === alerts[i].severity) assert.ok(alerts[i - 1].at >= alerts[i].at)
  }
  // Égalité de gravité et d'heure : l'id tranche, quel que soit l'ordre d'entrée.
  const tied = [order({ _id: 'b', status: 'pending', createdAt: ago(20) }), order({ _id: 'a', status: 'pending', createdAt: ago(20) })]
  assert.deepEqual(run(tied).map((a) => a.id), run([...tied].reverse()).map((a) => a.id))
}
section('tri gravité puis at décroissant, égalités départagées par id')

// ── Stabilité des ids ───────────────────────────────────────────────────────
{
  const orders = [
    order({ _id: 'p', status: 'pending', createdAt: ago(20) }),
    order({ _id: 'l', status: 'preparing', confirmedAt: ago(100) }),
    order({ _id: 'x', autoSettled: true, deliveredAt: ago(5) }),
    order({ _id: 'c', status: 'cancelled', cancelledAt: ago(5) }),
    order({ _id: 'z', recette: null }),
  ]
  const recettes = [
    recette({ _id: 'g', cashDifference: 4 }),
    recette({ _id: 'n', closingCash: null, cashDifference: null }),
    recette({ _id: 'k', closedAt: ago(100), corrections: [{ _id: 'cc', at: ago(3), action: 'count', reason: 'recompté' }] }),
  ]
  const first = computeAlerts({ orders, recettes, now: NOW, todayStart: TODAY })
  const later = computeAlerts({ orders, recettes, now: new Date(NOW.getTime() + 7 * MIN), todayStart: TODAY })
  assert.deepEqual(
    first.map((a) => a.id).sort(),
    [
      'order.auto_settled:x',
      'order.cancelled:c',
      'order.late:l',
      'order.orphan:z',
      'order.pending_stale:p',
      'recette.cash_gap:g',
      'recette.correction:k:cc',
      'recette.not_counted:n',
    ]
  )
  assert.deepEqual(first.map((a) => a.id), computeAlerts({ orders, recettes, now: NOW, todayStart: TODAY }).map((a) => a.id), 'deux appels, mêmes ids')
  assert.deepEqual(first.map((a) => a.id).sort(), later.map((a) => a.id).sort(), 'le temps qui passe ne change pas les ids')
  for (const a of first) assert.ok(!/\d{4}-\d{2}-\d{2}/.test(a.id), `horodatage dans ${a.id}`)
  assert.equal(new Set(first.map((a) => a.id)).size, first.length, 'ids uniques')
  assert.deepEqual(kinds(first).sort(), [
    'order.auto_settled',
    'order.cancelled',
    'order.late',
    'order.orphan',
    'order.pending_stale',
    'recette.cash_gap',
    'recette.correction',
    'recette.not_counted',
  ])
}
section('ids <kind>:<id>, stables, sans horodatage, les huit genres couverts')

// ── buildReport : since, comptes, plafond ───────────────────────────────────
{
  const alerts = run(
    [
      order({ status: 'pending', createdAt: ago(50) }),
      order({ status: 'pending', createdAt: ago(20) }),
      order({ status: 'cancelled', cancelledAt: ago(1) }),
    ],
    [recette({ cashDifference: 9, closedAt: ago(5) })]
  )
  const all = buildReport(alerts)
  assert.deepEqual(all.counts, { total: 4, critical: 1, warning: 2, info: 1 })
  assert.equal(all.truncated, false)
  // since : at >= since, borne incluse.
  const since = buildReport(alerts, { since: ago(20) })
  assert.deepEqual(since.alerts.map((a) => a.kind).sort(), ['order.cancelled', 'order.pending_stale', 'recette.cash_gap'])
  assert.deepEqual(since.counts, { total: 3, critical: 1, warning: 1, info: 1 })
  assert.equal(buildReport(alerts, { since: new Date(ago(1).getTime() + 1) }).counts.total, 0)

  const many = Array.from({ length: ALERT_LIMIT + 5 }, (_, i) => order({ _id: `m${i}`, status: 'pending', createdAt: ago(30 + i) }))
  const big = buildReport(run(many))
  assert.equal(big.alerts.length, ALERT_LIMIT)
  assert.equal(big.counts.total, ALERT_LIMIT + 5, 'les comptes disent le vrai total')
  assert.equal(big.truncated, true)
  assert.equal(buildReport(run(many.slice(0, ALERT_LIMIT))).truncated, false, 'pile 200 : pas tronqué')
  assert.ok(big.alerts[0].at > big.alerts[ALERT_LIMIT - 1].at, 'le plafond garde les plus récentes')
}
section('buildReport : since inclusif, comptes avant plafond, plafond 200')

// ── Sans fenêtre du jour, tout est évalué ───────────────────────────────────
{
  const old = order({ status: 'cancelled', cancelledAt: ago(60 * 100) })
  assert.equal(run([old], [], null).length, 1)
  assert.equal(run([old], [], TODAY).length, 0)
}
section('todayStart facultatif')

console.log('\nTout est bon.')
