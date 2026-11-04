/**
 * Mr. Burritos — vérification des routes d'écriture du manager (sprint 5)
 * Lance avec : npm run check:write
 *
 * Aucune base, aucun serveur : lib/managerRecette, lib/planningDeadline et
 * lib/planning sont purs. Échoue (code 1) au premier écart.
 */

import assert from 'node:assert/strict'
import {
  BLOCKERS_LISTED,
  BLOCKING_STATUSES,
  blockersOf,
  closedOf,
  figuresChanged,
  isClientKey,
  movementByKey,
  parseCloseBody,
  parseClosingCash,
  parseMoney,
  parseMovementAmount,
  parseMovementBody,
  recetteOf,
  sameMovement,
} from '../lib/managerRecette'
import { weekPairs } from '../lib/planning'
import { addDays } from '../lib/reportTime'
import {
  DEFAULT_DEADLINE,
  MAX_AHEAD_DAYS,
  copyWeekRequest,
  deadlineAt,
  deadlineLabel,
  deadlinePassed,
  nextMondays,
  parseCopyWeek,
  parseDeadline,
  parseValidateWeek,
  parseWeek,
  strictDeadline,
  tooFarAhead,
} from '../lib/planningDeadline'

const section = (name: string) => console.log(`ok  ${name}`)
const ID = (n: number) => String(n).padStart(24, 'a')
const KEY = 'k-0123456789abcdef'

// ── La clé d'idempotence ────────────────────────────────────────────────────
{
  assert.ok(isClientKey('a'.repeat(16)))
  assert.ok(isClientKey('a'.repeat(64)))
  assert.ok(isClientKey('3f2b8c1e-9a4d-4e6b-8c1d-0a1b2c3d4e5f'), 'un uuid')
  assert.ok(isClientKey('ABCdef-0123456789-XYZ'))
  assert.ok(!isClientKey('a'.repeat(15)), '15 : trop court')
  assert.ok(!isClientKey('a'.repeat(65)), '65 : trop long')
  assert.ok(!isClientKey('abcdefghijklmnop_'), 'souligné refusé')
  assert.ok(!isClientKey('abcdefghijklmnop '), 'espace refusé')
  assert.ok(!isClientKey('abcdefghijklmnopé'), 'accent refusé')
  assert.ok(!isClientKey(''))
  assert.ok(!isClientKey(null))
  assert.ok(!isClientKey(12345678901234567890))

  // Rejeu : la ligne portant la clé est rendue ; sinon on écrit.
  const lines = [{ id: 'old' }, { id: 'till', clientKey: null }, { id: 'mine', clientKey: KEY }, { id: 'other', clientKey: 'z'.repeat(16) }]
  assert.equal(movementByKey(lines, KEY)?.id, 'mine', 'même clé : rejeu')
  assert.equal(movementByKey(lines, 'q'.repeat(16)), null, 'autre clé : on écrit')
  assert.equal(movementByKey([{ id: 'old' }] as unknown as { clientKey?: string }[], KEY), null, 'anciennes lignes sans clé : jamais un rejeu')
  assert.equal(movementByKey(null, KEY), null)
  assert.equal(movementByKey(undefined, KEY), null)
}
section('clé 16-64 [A-Za-z0-9-], décision de rejeu (anciennes lignes sans clé intactes)')

// ── Les montants ────────────────────────────────────────────────────────────
{
  assert.equal(parseMoney('12,5'), 12.5, 'virgule')
  assert.equal(parseMoney(' 12.50 '), 12.5)
  assert.equal(parseMoney(12.5), 12.5)
  assert.equal(parseMoney('0,004'), 0, 'arrondi à 2 décimales')
  for (const bad of ['', '  ', '12abc', '1e3', '-3', '+3', '0x10', '1,2,3', '.5', '5.', 'abc', NaN, Infinity, true, null, undefined, {}, [], [5]]) {
    assert.equal(parseMoney(bad), null, `refusé : ${JSON.stringify(bad)}`)
  }

  assert.equal(parseMovementAmount('0,01'), 0.01)
  assert.equal(parseMovementAmount(100000), 100000, '100000 : accepté')
  assert.equal(parseMovementAmount('100000,01'), null, 'au-dessus du plafond')
  assert.equal(parseMovementAmount(0), null, 'zéro refusé')
  assert.equal(parseMovementAmount('0,004'), null, 'zéro après arrondi refusé')
  assert.equal(parseMovementAmount(-5), null)

  assert.equal(parseClosingCash(0), 0, 'un tiroir vide se compte')
  assert.equal(parseClosingCash('0'), 0)
  assert.equal(parseClosingCash('152,40'), 152.4)
  assert.equal(parseClosingCash(1_000_000), 1_000_000)
  assert.equal(parseClosingCash(1_000_000.01), null)
  assert.equal(parseClosingCash(-0.01), null)
  assert.equal(parseClosingCash(''), null, 'vide ≠ zéro')
  assert.equal(parseClosingCash(null), null)
  assert.equal(parseClosingCash('12abc'), null)
}
section('montants : virgule, 2 décimales, mouvement 0,01-100000, comptage 0-1000000, strict')

// ── Le corps d'un mouvement ─────────────────────────────────────────────────
{
  const base = { recetteId: ID(1), key: KEY, kind: 'achat', label: 'Pain', amount: '12,5' }
  const ok = parseMovementBody(base)
  assert.ok(ok.ok)
  if (ok.ok) {
    assert.deepEqual(ok.value.input, { kind: 'achat', label: 'Pain', amount: 12.5, note: '', employeeId: null, employeeReason: 'avance' })
  }

  // Une avance : dépense + avance imposées, libellé facultatif.
  const adv = parseMovementBody({ recetteId: ID(1), key: KEY, kind: 'apport', employeeId: ID(2), amount: 40 })
  assert.ok(adv.ok)
  if (adv.ok) {
    assert.equal(adv.value.input.kind, 'depense', 'imposée par le serveur, quoi que dise le client')
    assert.equal(adv.value.input.employeeReason, 'avance')
    assert.equal(adv.value.input.employeeId, ID(2))
  }
  assert.ok(parseMovementBody({ recetteId: ID(1), key: KEY, employeeId: ID(2), amount: 40 }).ok, 'sans kind, c’est une avance')

  // Refus.
  assert.ok(!parseMovementBody({ ...base, employeeId: ID(2), employeeReason: 'salaire' }).ok, 'salaire refusé')
  assert.ok(!parseMovementBody({ ...base, reason: 'salaire' }).ok, 'salaire refusé, même sans employé')
  assert.ok(!parseMovementBody({ ...base, key: 'court' }).ok, 'clé invalide')
  assert.ok(!parseMovementBody({ ...base, key: undefined }).ok, 'clé absente')
  assert.ok(!parseMovementBody({ ...base, recetteId: 'nope' }).ok, 'recetteId invalide')
  assert.ok(!parseMovementBody({ ...base, kind: 'cadeau' }).ok, 'kind inconnu')
  assert.ok(!parseMovementBody({ ...base, amount: '0' }).ok)
  assert.ok(!parseMovementBody({ ...base, amount: '12abc' }).ok)
  assert.ok(!parseMovementBody({ ...base, label: '   ' }).ok, 'libellé requis sans employé')
  assert.ok(!parseMovementBody({ ...base, label: 42 }).ok, 'libellé non texte')
  assert.ok(!parseMovementBody({ ...base, employeeId: 'nope' }).ok, 'employeeId invalide')

  // Coupes et auteur.
  const long = parseMovementBody({ ...base, label: 'x'.repeat(200), note: 'n'.repeat(500) })
  assert.ok(long.ok)
  if (long.ok) {
    assert.equal(long.value.input.label.length, 80)
    assert.equal(long.value.input.note.length, 200)
  }
  const authored = parseMovementBody({ ...base, createdBy: { name: 'pirate' }, userName: 'pirate', author: 'pirate' })
  assert.ok(authored.ok)
  assert.ok(!JSON.stringify(authored).includes('pirate'), 'un auteur dans le corps est ignoré')
}
section('corps d’un mouvement : avance imposée, salaire refusé, coupes 80/200, auteur du corps ignoré')

// ── Le corps d'une clôture ──────────────────────────────────────────────────
{
  const counted = { recetteId: ID(1), closingCash: '152,4', notCounted: false, expectedCash: 150 }
  const a = parseCloseBody(counted)
  assert.ok(a.ok)
  if (a.ok) assert.deepEqual(a.value, { recetteId: ID(1), closingCash: 152.4, expectedCash: 150, notes: '' })

  const b = parseCloseBody({ recetteId: ID(1), closingCash: null, notCounted: true, expectedCash: 150, notes: ' ok ' })
  assert.ok(b.ok)
  if (b.ok) assert.deepEqual(b.value, { recetteId: ID(1), closingCash: null, expectedCash: 150, notes: 'ok' })

  assert.ok(parseCloseBody({ ...counted, closingCash: 0 }).ok, 'zéro compté')
  assert.ok(!parseCloseBody({ ...counted, closingCash: null }).ok, 'null sans notCounted : refusé')
  assert.ok(!parseCloseBody({ ...counted, closingCash: undefined }).ok, 'absent sans notCounted : refusé')
  assert.ok(!parseCloseBody({ recetteId: ID(1), closingCash: 100, notCounted: true, expectedCash: 150 }).ok, 'un montant ET non compté : refusé')
  assert.ok(!parseCloseBody({ recetteId: ID(1), closingCash: '', notCounted: false, expectedCash: 150 }).ok, 'vide ≠ zéro')
  assert.ok(!parseCloseBody({ ...counted, closingCash: '12abc' }).ok)
  assert.ok(!parseCloseBody({ ...counted, closingCash: -1 }).ok)
  assert.ok(!parseCloseBody({ ...counted, closingCash: 1_000_001 }).ok)
  const missing: Record<string, unknown> = { ...counted }
  delete missing.notCounted
  assert.ok(!parseCloseBody(missing).ok, 'notCounted absent : refusé')
  assert.ok(!parseCloseBody({ ...counted, notCounted: 'false' }).ok, 'notCounted texte : refusé')
  assert.ok(!parseCloseBody({ ...counted, expectedCash: '150' }).ok, 'expectedCash doit être un nombre')
  assert.ok(!parseCloseBody({ ...counted, expectedCash: undefined }).ok)
  assert.ok(!parseCloseBody({ ...counted, recetteId: 'x' }).ok)
}
section('corps de clôture : null sans notCounted refusé, compté 0-1000000, expectedCash numérique')

// ── Bloquants et chiffres changés ───────────────────────────────────────────
{
  assert.deepEqual([...BLOCKING_STATUSES], ['pending', 'confirmed', 'preparing'])
  assert.ok(!(BLOCKING_STATUSES as readonly string[]).includes('ready'), 'ready ne bloque pas')
  assert.ok(!(BLOCKING_STATUSES as readonly string[]).includes('delivered'))
  assert.ok(!(BLOCKING_STATUSES as readonly string[]).includes('cancelled'))

  assert.deepEqual(blockersOf([]), { count: 0, orders: [] })
  assert.deepEqual(blockersOf([{ orderNumber: 'MB-1', status: 'pending', _id: 'x', customer: { phone: '06' } }] as unknown as { orderNumber?: unknown; status?: unknown }[]), {
    count: 1,
    orders: [{ orderNumber: 'MB-1', status: 'pending' }],
  })
  const many = blockersOf(Array.from({ length: 80 }, (_, i) => ({ orderNumber: `MB-${i}`, status: 'preparing' })), 80)
  assert.equal(many.count, 80, 'count dit le vrai nombre')
  assert.equal(many.orders.length, BLOCKERS_LISTED, 'la liste est coupée')

  assert.equal(figuresChanged(10, 10), false)
  assert.equal(figuresChanged(10.005, 10), false, '0,005 d’écart : toléré')
  assert.equal(figuresChanged(10, 10.005), false)
  assert.equal(figuresChanged(10.006, 10), true, '0,006 d’écart : changé')
  assert.equal(figuresChanged(10, 9.994), true)
  assert.equal(figuresChanged(0.1 + 0.2, 0.3), false, 'pas de faux écart de virgule flottante')
  assert.equal(figuresChanged(-5, 5), true)
}
section('bloquants pending/confirmed/preparing (ready compté à part), figures_changed à 0,005')

// ── L'échéance ──────────────────────────────────────────────────────────────
{
  // Jeudi 18:00 à Tunis (UTC+1, pas d'heure d'été) = 17:00 UTC.
  const at = deadlineAt('2026-11-09', DEFAULT_DEADLINE)
  assert.equal(at.toISOString(), '2026-11-05T17:00:00.000Z')
  assert.equal(deadlineAt('2026-11-16', DEFAULT_DEADLINE).toISOString(), '2026-11-12T17:00:00.000Z', 'la semaine d’après : sept jours plus tard')
  assert.equal(deadlineAt('2026-11-09', { weekday: 0, time: '09:30' }).toISOString(), '2026-11-02T08:30:00.000Z', 'lundi : le lundi d’avant')
  assert.equal(deadlineAt('2026-11-09', { weekday: 6, time: '23:59' }).toISOString(), '2026-11-08T22:59:00.000Z', 'dimanche : la veille')
  assert.equal(deadlineAt('2026-07-13', DEFAULT_DEADLINE).toISOString(), '2026-07-09T17:00:00.000Z', 'été : même heure, la Tunisie n’a pas d’heure d’été')

  const t = at.getTime()
  assert.equal(deadlinePassed(at, new Date(t - 60_000)), false, 'une minute avant')
  assert.equal(deadlinePassed(at, new Date(t - 1)), false, '1 ms avant')
  assert.equal(deadlinePassed(at, new Date(t)), false, 'à 18:00 pile, il est encore temps')
  assert.equal(deadlinePassed(at, new Date(t + 1)), true, '1 ms après')
  assert.equal(deadlinePassed(at, new Date(t + 60_000)), true, 'une minute après')

  // Réglage : absent ou invalide, jeudi 18:00.
  const dflt = { weekday: 3, time: '18:00' }
  assert.deepEqual(DEFAULT_DEADLINE, dflt)
  for (const bad of [undefined, null, '', 'pas du json', 42, [], {}, { weekday: 7, time: '18:00' }, { weekday: -1, time: '18:00' },
    { weekday: 3.5, time: '18:00' }, { weekday: '3', time: '18:00' }, { weekday: 3, time: '25:00' }, { weekday: 3, time: '18:60' },
    { weekday: 3, time: '8:00' }, { weekday: 3 }, { time: '18:00' }, '{"weekday":9,"time":"18:00"}']) {
    assert.deepEqual(parseDeadline(bad), dflt, `repli : ${JSON.stringify(bad)}`)
  }
  assert.deepEqual(parseDeadline({ weekday: 4, time: '12:30' }), { weekday: 4, time: '12:30' })
  assert.deepEqual(parseDeadline('{"weekday":0,"time":"00:00"}'), { weekday: 0, time: '00:00' }, 'JSON en texte')
  assert.deepEqual(parseDeadline({ weekday: 3, time: '18:00', extra: 1 }), dflt, 'rien de plus que weekday et time')
  const copy = parseDeadline(undefined)
  copy.weekday = 0
  assert.equal(DEFAULT_DEADLINE.weekday, 3, 'le défaut n’est pas partagé')
  assert.equal(deadlineLabel(DEFAULT_DEADLINE), 'jeudi 18:00')

  // Les deux prochains lundis, strictement après aujourd’hui.
  assert.deepEqual(nextMondays('2026-11-02', 2), ['2026-11-09', '2026-11-16'], 'un lundi : le suivant, pas lui-même')
  assert.deepEqual(nextMondays('2026-11-04', 2), ['2026-11-09', '2026-11-16'])
  assert.deepEqual(nextMondays('2026-11-08', 2), ['2026-11-09', '2026-11-16'], 'un dimanche')
  assert.deepEqual(nextMondays('2026-12-30', 2), ['2027-01-04', '2027-01-11'], 'fin d’année')
}
section('échéance jeudi 18:00 Tunis -> 17:00 UTC, deux côtés de la borne, repli du réglage, prochains lundis')

// ── La semaine visée et la copie ────────────────────────────────────────────
{
  const today = '2026-11-04' // un mercredi ; le lundi de la semaine est le 2
  assert.deepEqual(parseWeek('2026-11-09', today), { ok: true, monday: '2026-11-09' })
  assert.deepEqual(parseWeek('2026-11-02', today), { ok: true, monday: '2026-11-02' }, 'cette semaine : permis')
  assert.deepEqual(parseWeek('2026-10-26', today), { ok: false, code: 'past_week' })
  assert.deepEqual(parseWeek('2026-11-10', today), { ok: false, code: 'bad_request' }, 'pas un lundi')
  assert.deepEqual(parseWeek('2026-02-30', today), { ok: false, code: 'bad_request' }, 'jour inexistant')
  assert.deepEqual(parseWeek('09/11/2026', today), { ok: false, code: 'bad_request' })
  assert.deepEqual(parseWeek(undefined, today), { ok: false, code: 'bad_request' })
  assert.deepEqual(parseWeek(20261109, today), { ok: false, code: 'bad_request' })
  // Un dimanche : sa semaine a commencé le lundi d’avant.
  assert.deepEqual(parseWeek('2026-11-02', '2026-11-08'), { ok: true, monday: '2026-11-02' })
  assert.deepEqual(parseWeek('2026-11-02', '2026-11-09'), { ok: false, code: 'past_week' }, 'le lundi suivant, elle est passée')

  // copy-week : la semaine d’avant, recopiée une fois sur la cible.
  const req = copyWeekRequest('2026-11-09')
  assert.deepEqual(req, { mode: 'week', from: '2026-11-02', weeks: 1 })
  const pairs = weekPairs(req.from, req.weeks)
  assert.equal(pairs.length, 7)
  assert.deepEqual(pairs[0], { source: '2026-11-02', target: '2026-11-09' })
  assert.deepEqual(pairs[6], { source: '2026-11-08', target: '2026-11-15' })
  assert.ok(pairs.every((p, i) => p.target > p.source && new Date(`${p.target}T00:00:00Z`).getTime() - new Date(`${p.source}T00:00:00Z`).getTime() === 7 * 86_400_000 && i >= 0))
  assert.deepEqual(copyWeekRequest('2027-01-04'), { mode: 'week', from: '2026-12-28', weeks: 1 }, 'à cheval sur l’année')
}
section('week : lundi seulement, semaine passée refusée, copy-week = sept paires jour pour jour')

// ── La recette ouverte ne fuit rien ─────────────────────────────────────────
{
  const SECRETS = ['0600112233', 'boss@example.test', 'CIN-998877', 'oid-secret', 'KEY-SECRET-0000000000', 'note privee']
  const FORBIDDEN_KEYS = ['_id', 'phone', 'email', 'cin', 'address', 'notes', 'clientKey', 'corrections', 'totals', 'user', 'reason', 'closedBy', 'mouvements']
  const doc = {
    _id: 'rec1',
    number: 'R-20261104-01',
    status: 'open',
    openedAt: new Date('2026-11-04T10:00:00Z'),
    openedBy: { user: SECRETS[3], name: 'Caisse' },
    openingFloat: 50,
    notes: SECRETS[5],
    totals: { revenue: 999 },
    corrections: [{ reason: SECRETS[5] }],
    mouvements: [
      {
        _id: 'm1', kind: 'achat', label: 'Pain', amount: 12.5, note: 'frais', clientKey: SECRETS[4],
        createdAt: new Date('2026-11-04T10:05:00Z'), createdBy: { user: SECRETS[3], name: 'boss@example.test' },
        cancelledAt: null, cancelledBy: { name: '' }, addedLater: null,
      },
      {
        _id: 'm2', kind: 'depense', label: 'Avance · Houssine', amount: 40, note: '',
        employee: { id: 'emp1', name: 'Houssine', reason: 'avance', phone: SECRETS[0], email: SECRETS[1], cin: SECRETS[2] },
        createdAt: new Date('2026-11-04T10:10:00Z'), createdBy: { name: 'boss@example.test' },
        cancelledAt: new Date('2026-11-04T10:20:00Z'), cancelledBy: { user: SECRETS[3], name: 'boss@example.test' },
      },
    ],
  }
  const view = recetteOf(doc, { cashExpected: 77.5, blockers: blockersOf([{ orderNumber: 'MB-9', status: 'pending', customer: { phone: SECRETS[0] } }] as unknown as { orderNumber?: unknown; status?: unknown }[]), readyCount: 2 })

  assert.deepEqual(Object.keys(view).sort(), ['blockers', 'cashExpected', 'id', 'movements', 'number', 'openedAt', 'openedBy', 'openingFloat', 'readyCount'])
  assert.deepEqual(
    Object.keys(view.movements[0]).sort(),
    ['amount', 'cancelledAt', 'cancelledBy', 'createdAt', 'createdBy', 'employee', 'id', 'kind', 'label', 'note'],
  )
  assert.deepEqual(Object.keys(view.movements[1].employee ?? {}).sort(), ['id', 'name'], 'l’employé : id et nom, rien de sa fiche')
  assert.deepEqual(view.blockers, { count: 1, orders: [{ orderNumber: 'MB-9', status: 'pending' }] })

  // Les valeurs.
  assert.equal(view.id, 'rec1')
  assert.equal(view.openedAt, '2026-11-04T10:00:00.000Z')
  assert.equal(view.cashExpected, 77.5)
  assert.equal(view.readyCount, 2)
  assert.equal(view.movements[0].employee, null)
  assert.equal(view.movements[0].cancelledAt, null)
  assert.equal(view.movements[0].cancelledBy, null, 'pas annulée : pas d’annuleur')
  assert.equal(view.movements[1].cancelledAt, '2026-11-04T10:20:00.000Z')
  assert.equal(view.movements[1].cancelledBy, 'boss@example.test')

  // Ni clé interdite, ni secret, à aucune profondeur. (L’e-mail de l’auteur est
  // le nom copié sur la ligne : voulu, on le retire de la liste des secrets.)
  const forbiddenValues = SECRETS.filter((s) => s !== 'boss@example.test')
  const walk = (v: unknown, path: string) => {
    if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`))
    else if (v && typeof v === 'object') {
      for (const [k, x] of Object.entries(v)) {
        assert.ok(!FORBIDDEN_KEYS.includes(k), `clé interdite ${path}.${k}`)
        walk(x, `${path}.${k}`)
      }
    } else if (typeof v === 'string') for (const s of forbiddenValues) assert.ok(!v.includes(s), `fuite de « ${s} » en ${path}`)
  }
  walk(view, '')
  assert.ok(!JSON.stringify(view).includes('KEY-SECRET'), 'la clé d’idempotence ne sort pas')

  // Une recette vide, et des champs absents : pas d’exception, pas de « undefined ».
  const bare = recetteOf({ _id: 'r' }, { cashExpected: 0, blockers: blockersOf([]), readyCount: 0 })
  assert.equal(bare.movements.length, 0)
  assert.ok(!JSON.stringify(bare).includes('undefined'))

  // La clôture rendue.
  const closed = closedOf(
    { number: 'R-1', closedAt: new Date('2026-11-04T22:00:00Z'), closedBy: { name: 'boss@example.test' }, closingCash: 152.4, ...{ totals: { revenue: 1 }, notes: SECRETS[5] } },
    { cashExpected: 150, cashDifference: 2.4 }
  )
  assert.deepEqual(closed, { number: 'R-1', closedAt: '2026-11-04T22:00:00.000Z', closedBy: 'boss@example.test', closingCash: 152.4, cashExpected: 150, cashDifference: 2.4 })
  assert.deepEqual(
    closedOf({ number: 'R-2', closedAt: new Date('2026-11-04T22:00:00Z'), closedBy: { name: 'x' }, closingCash: null }, { cashExpected: 10, cashDifference: null }),
    { number: 'R-2', closedAt: '2026-11-04T22:00:00.000Z', closedBy: 'x', closingCash: null, cashExpected: 10, cashDifference: null },
    'non compté : closingCash et cashDifference null',
  )
}
section('recette ouverte : liste blanche, ni _id d’ailleurs, ni clé, ni fiche d’employé, ni journal')

// ── Fix round : rejeu avec une autre demande ────────────────────────────────
{
  const stored = { kind: 'achat', label: 'Pain', amount: 12.5, employee: null }
  assert.ok(sameMovement(stored, { kind: 'achat', label: 'Pain', amount: 12.5 }), 'même demande')
  assert.ok(sameMovement(stored, { kind: 'achat', label: '  Pain  ', amount: '12,50' }), 'normalisé : libellé rogné, virgule, 2 décimales')
  assert.ok(sameMovement(stored, { kind: 'achat', label: 'Pain', amount: 12.499 }), 'arrondi à 2 avant de comparer')
  assert.ok(!sameMovement(stored, { kind: 'depense', label: 'Pain', amount: 12.5 }), 'autre type')
  assert.ok(!sameMovement(stored, { kind: 'achat', label: 'Pain', amount: 12.51 }), 'autre montant')
  assert.ok(!sameMovement(stored, { kind: 'achat', label: 'Pains', amount: 12.5 }), 'autre libellé')
  assert.ok(!sameMovement(stored, { kind: 'achat', label: 'Pain', amount: 12.5, employeeId: ID(2) }), 'un employé en plus')

  const advance = { kind: 'depense', label: 'Avance · Houssine', amount: 40, employee: { id: ID(2) } }
  assert.ok(sameMovement(advance, { kind: 'depense', label: 'autre texte du client', amount: 40, employeeId: ID(2) }), 'avance : libellé fait par le serveur, non comparé')
  assert.ok(!sameMovement(advance, { kind: 'depense', label: 'x', amount: 40, employeeId: ID(3) }), 'autre employé')
  assert.ok(!sameMovement(advance, { kind: 'depense', label: 'Avance · Houssine', amount: 40 }), 'sans employé : autre demande')
}
section('rejeu : même demande normalisée = rejeu, autre type/montant/libellé/employé = key_conflict')

// ── Fix round : semaines et dates du planning ───────────────────────────────
{
  const today = '2026-11-04' // mercredi ; lundi de la semaine : 2 nov.
  // validate : cette semaine ou les 2 suivantes.
  for (const ok of ['2026-11-02', '2026-11-09', '2026-11-16']) assert.deepEqual(parseValidateWeek(ok, today), { ok: true, monday: ok })
  assert.deepEqual(parseValidateWeek('2026-11-23', today), { ok: false, code: 'bad_request' }, '+3 semaines : refusé')
  assert.deepEqual(parseValidateWeek('2027-11-01', today), { ok: false, code: 'bad_request' }, 'dans un an : refusé')
  assert.deepEqual(parseValidateWeek('2026-10-26', today), { ok: false, code: 'past_week' })
  assert.deepEqual(parseValidateWeek('2026-11-10', today), { ok: false, code: 'bad_request' }, 'pas un lundi')
  // Un dimanche, la fenêtre suit le lundi de sa semaine.
  assert.deepEqual(parseValidateWeek('2026-11-16', '2026-11-08'), { ok: true, monday: '2026-11-16' })
  assert.deepEqual(parseValidateWeek('2026-11-23', '2026-11-08'), { ok: false, code: 'bad_request' })

  // copy-week : une semaine après la semaine en cours.
  assert.deepEqual(parseCopyWeek('2026-11-02', today), { ok: false, code: 'past_week' }, 'la semaine en cours : past_week')
  assert.deepEqual(parseCopyWeek('2026-10-26', today), { ok: false, code: 'past_week' })
  assert.deepEqual(parseCopyWeek('2026-11-09', today), { ok: true, monday: '2026-11-09' })
  assert.deepEqual(parseCopyWeek('2026-11-02', '2026-11-08'), { ok: false, code: 'past_week' }, 'dimanche : toujours la semaine en cours')
  assert.deepEqual(parseCopyWeek('2026-11-09', '2026-11-08'), { ok: true, monday: '2026-11-09' })
  assert.deepEqual(parseCopyWeek('2026-11-10', today), { ok: false, code: 'bad_request' })

  // Plafond : aujourd'hui + 1 an.
  const limit = addDays(today, MAX_AHEAD_DAYS)
  assert.ok(!tooFarAhead(limit, today), 'le dernier jour permis')
  assert.ok(tooFarAhead(addDays(limit, 1), today), 'le lendemain : refusé')
  assert.ok(!tooFarAhead('2026-11-04', today) && !tooFarAhead('2026-01-01', today), 'passé et aujourd’hui : pas concernés')
  assert.deepEqual(parseCopyWeek('2027-11-15', today), { ok: false, code: 'bad_request' }, 'copy-week au-delà d’un an')
  assert.deepEqual(parseCopyWeek('2027-11-01', today), { ok: true, monday: '2027-11-01' }, 'dans l’année')
}
section('validate = cette semaine + 2 suivantes, copy-week = après la semaine en cours, plafond 1 an')

// ── Fix round : l'échéance écrite par POST /api/configuration ───────────────
{
  assert.deepEqual(strictDeadline({ weekday: 3, time: '18:00' }), { weekday: 3, time: '18:00' })
  assert.deepEqual(strictDeadline('{"weekday":0,"time":"09:30"}'), { weekday: 0, time: '09:30' }, 'JSON en texte (le formulaire)')
  for (const bad of [null, undefined, '', 'jeudi', '{"weekday":7,"time":"18:00"}', '{"weekday":3,"time":"24:00"}', { weekday: 3 }, { weekday: '3', time: '18:00' }, { weekday: 1.5, time: '18:00' }, [], 42, true, { weekday: 3, time: '8:00' }]) {
    assert.equal(strictDeadline(bad), null, `refusé : ${JSON.stringify(bad)}`)
  }
  assert.deepEqual(parseDeadline('jeudi'), DEFAULT_DEADLINE, 'la lecture, elle, retombe sur le défaut')
}
section('échéance en écriture : stricte (objet ou JSON), sinon refusée')

console.log('\nTout est bon.')
