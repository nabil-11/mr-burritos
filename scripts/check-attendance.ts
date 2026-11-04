/**
 * Mr. Burritos — vérification du pointage (sprint 7)
 * Lance avec : npm run check:attendance
 *
 * Aucune base, aucun serveur : lib/attendance, lib/attendanceDeadline et
 * lib/managerAttendance sont purs. Échoue (code 1) au premier écart, et affiche
 * une ligne par groupe vérifié.
 */

import assert from 'node:assert/strict'
import {
  AttendanceError,
  HISTORY_CAP,
  assertWritable,
  alertDates,
  cleanDate,
  cleanRealShifts,
  cleanRows,
  editWindow,
  figuresOf,
  markerOutcome,
  parseSummaryRange,
  planWrite,
  plannedMinutesOf,
  pushHistory,
  snapshotOf,
  statusDates,
  summarize,
  toMinutes,
  wrapDelta,
  type PlannedSnapshot,
  type RowInput,
  type RowOp,
  type StoredAttendance,
} from '../lib/attendance'
import {
  DEFAULT_ATTENDANCE_DEADLINE,
  attendanceDeadlineAt,
  attendanceDeadlineLabel,
  attendanceDeadlinePassed,
  parseAttendanceDeadline,
  strictAttendanceDeadline,
} from '../lib/attendanceDeadline'
import { dayBody, statusBody, storedOf, summaryBody, type RosterEntry } from '../lib/managerAttendance'
import { shiftMinutes, type PlanningCell, type Shift } from '../lib/planning'
import { startOfDay } from '../lib/reportTime'

const section = (name: string) => console.log(`ok  ${name}`)
const sh = (from: string, to: string): Shift => ({ from, to })
const ID = (n: number) => n.toString(16).padStart(24, '0')
const planned = (...shifts: Shift[]): PlannedSnapshot => ({ status: 'travail', shifts, source: 'semaine' })
const cellOf = (status: PlanningCell['status'], shifts: Shift[] = [], note = ''): PlanningCell => ({
  status,
  shifts,
  hours: 0,
  source: status === 'none' ? 'none' : 'semaine',
  note,
})
const fig = (p: Shift[], r: Shift[]) => figuresOf('present', planned(...p), r)
const code = (fn: () => unknown) => {
  try {
    fn()
  } catch (e) {
    assert.ok(e instanceof AttendanceError, `AttendanceError attendue, reçu ${String(e)}`)
    return e
  }
  assert.fail('une AttendanceError était attendue')
}

// ── Les minutes ──────────────────────────────────────────────────────────────
{
  assert.equal(toMinutes('00:00'), 0)
  assert.equal(toMinutes('18:30'), 1110)
  assert.equal(shiftMinutes(sh('11:00', '16:00')), 300)
  assert.equal(shiftMinutes(sh('22:00', '02:00')), 240, 'passe minuit')
  assert.equal(shiftMinutes(sh('18:00', '00:00')), 360, 'finir à 00:00 est passer minuit, pas durer 0')
  assert.equal(wrapDelta(5), 5)
  assert.equal(wrapDelta(-1435), 5, '23:55 -> 00:00 : +5, pas -1435')
  assert.equal(wrapDelta(1435), -5)
  assert.equal(wrapDelta(719), 719)
  assert.equal(wrapDelta(720), -720, 'borne : [-12 h, +12 h)')
  assert.equal(wrapDelta(-720), -720)
  assert.equal(wrapDelta(0), 0)
  assert.equal(plannedMinutesOf(planned(sh('11:00', '16:00'), sh('18:00', '23:00'))), 600)
  assert.equal(plannedMinutesOf({ status: 'conge', shifts: [sh('11:00', '16:00')], source: 'exception' }), 0, 'seul `travail` est prévu')
  section('minutes : durée, passage de minuit, écart ramené dans [-12 h, +12 h)')
}

// ── Retard, départ anticipé, heures en plus ──────────────────────────────────
{
  // Exactement comme prévu.
  assert.deepEqual(fig([sh('11:00', '16:00')], [sh('11:00', '16:00')]), {
    unplanned: false, lateMinutes: 0, earlyMinutes: 0, extraMinutes: 0, workedMinutes: 300,
  })
  // Retard et départ anticipé.
  assert.deepEqual(fig([sh('11:00', '16:00')], [sh('11:25', '15:40')]), {
    unplanned: false, lateMinutes: 25, earlyMinutes: 20, extraMinutes: 0, workedMinutes: 255,
  })
  // Arrivé plus tôt, parti plus tard : heures en plus.
  assert.deepEqual(fig([sh('11:00', '16:00')], [sh('10:30', '16:15')]), {
    unplanned: false, lateMinutes: 0, earlyMinutes: 0, extraMinutes: 45, workedMinutes: 345,
  })

  // Passage de minuit : 18:00 -> 01:00.
  assert.deepEqual(fig([sh('18:00', '01:00')], [sh('18:00', '01:00')]).workedMinutes, 420)
  assert.deepEqual(fig([sh('18:00', '01:00')], [sh('18:00', '02:00')]), {
    unplanned: false, lateMinutes: 0, earlyMinutes: 0, extraMinutes: 60, workedMinutes: 480,
  })
  const mid = fig([sh('18:00', '01:00')], [sh('18:30', '00:30')])
  assert.deepEqual([mid.lateMinutes, mid.earlyMinutes, mid.extraMinutes, mid.workedMinutes], [30, 30, 0, 360])
  // Fin à 00:00 contre 23:55 : 5 minutes, pas 1435.
  const endsLate = fig([sh('18:00', '23:55')], [sh('18:00', '00:00')])
  assert.deepEqual([endsLate.extraMinutes, endsLate.earlyMinutes, endsLate.workedMinutes], [5, 0, 360])
  const endsEarly = fig([sh('18:00', '00:00')], [sh('18:00', '23:55')])
  assert.deepEqual([endsEarly.extraMinutes, endsEarly.earlyMinutes, endsEarly.workedMinutes], [0, 5, 355])
  // Début à 23:55 contre 00:00 (service du soir qui commence tard) : 5 minutes de retard.
  const startsLate = fig([sh('00:00', '04:00')], [sh('00:05', '04:00')])
  assert.deepEqual([startsLate.lateMinutes, startsLate.workedMinutes], [5, 235])

  // Deux services, appariés par recouvrement.
  const two = fig([sh('11:00', '16:00'), sh('18:00', '23:00')], [sh('11:10', '16:00'), sh('18:00', '22:30')])
  assert.deepEqual([two.lateMinutes, two.earlyMinutes, two.extraMinutes, two.workedMinutes], [10, 30, 0, 560])
  assert.equal(two.unplanned, false)

  // Un réel pour deux prévus : le second prévu manque en entier (départ anticipé).
  const oneReal = fig([sh('11:00', '16:00'), sh('18:00', '23:00')], [sh('11:00', '16:00')])
  assert.deepEqual([oneReal.lateMinutes, oneReal.earlyMinutes, oneReal.extraMinutes, oneReal.workedMinutes], [0, 300, 0, 300])
  // Deux réels pour un prévu : le second réel compte en entier en heures en plus.
  const twoReal = fig([sh('11:00', '16:00')], [sh('11:00', '16:00'), sh('18:00', '20:00')])
  assert.deepEqual([twoReal.lateMinutes, twoReal.earlyMinutes, twoReal.extraMinutes, twoReal.workedMinutes], [0, 0, 120, 420])

  // Ordre inversé : on trie avant d'apparier.
  const ordered = fig([sh('11:00', '16:00'), sh('18:00', '23:00')], [sh('11:10', '16:00'), sh('18:00', '22:30')])
  const swapped = fig([sh('18:00', '23:00'), sh('11:00', '16:00')], [sh('18:00', '22:30'), sh('11:10', '16:00')])
  assert.deepEqual(swapped, ordered, 'prévu et réel donnés à l’envers donnent le même résultat')

  // Midi manqué : le seul réel (18:00-23:00) s'apparie au soir, pas au midi par rang.
  const lunchMissed = fig([sh('11:00', '16:00'), sh('18:00', '23:00')], [sh('18:00', '23:00')])
  assert.deepEqual(lunchMissed, { unplanned: false, lateMinutes: 0, earlyMinutes: 300, extraMinutes: 0, workedMinutes: 300 }, 'midi manqué')
  // L'inverse : seul le midi est fait, le soir est un départ anticipé en entier.
  const dinnerMissed = fig([sh('11:00', '16:00'), sh('18:00', '23:00')], [sh('11:00', '16:00')])
  assert.deepEqual(dinnerMissed, { unplanned: false, lateMinutes: 0, earlyMinutes: 300, extraMinutes: 0, workedMinutes: 300 }, 'soir manqué')
  // Deux réels sur un seul prévu : le plus recouvrant s'apparie, l'autre compte en entier en plus.
  const bothOnOne = fig([sh('11:00', '16:00')], [sh('11:00', '13:00'), sh('14:00', '16:00')])
  assert.deepEqual(bothOnOne, { unplanned: false, lateMinutes: 0, earlyMinutes: 180, extraMinutes: 120, workedMinutes: 240 }, 'deux réels, un prévu (égalité : début le plus proche)')
  assert.deepEqual(
    fig([sh('11:00', '16:00')], [sh('10:00', '12:00'), sh('13:00', '16:00')]),
    { unplanned: false, lateMinutes: 120, earlyMinutes: 0, extraMinutes: 120, workedMinutes: 300 },
    'le réel qui recouvre le plus (13:00-16:00) prend le prévu ; 10:00-12:00 en plus'
  )
  // Aucun recouvrement : pas d'appariement, prévu manqué en entier + créneau hors planning en entier.
  assert.deepEqual(
    fig([sh('11:00', '16:00')], [sh('18:00', '23:00')]),
    { unplanned: false, lateMinutes: 0, earlyMinutes: 300, extraMinutes: 300, workedMinutes: 300 },
    'réel 18-23 contre prévu 11-16 seul : sans recouvrement'
  )
  // Réel qui passe minuit : 22:00-02:00 contre 18:00-01:00 -> retard 240, plus 60.
  const crossReal = fig([sh('18:00', '01:00')], [sh('22:00', '02:00')])
  assert.deepEqual(crossReal, { unplanned: false, lateMinutes: 240, earlyMinutes: 0, extraMinutes: 60, workedMinutes: 240 }, 'réel 22:00-02:00 / prévu 18:00-01:00')

  // Service de nuit : 00:30-03:00 réel contre 23:00-03:00 prévu s'apparie (frise circulaire) : retard 90, rien d'autre.
  assert.deepEqual(
    fig([sh('23:00', '03:00')], [sh('00:30', '03:00')]),
    { unplanned: false, lateMinutes: 90, earlyMinutes: 0, extraMinutes: 0, workedMinutes: 150 },
    'réel 00:30-03:00 / prévu 23:00-03:00'
  )
  // Un réel 01:00-02:00 contre 18:00-01:00 : aucun recouvrement, même sur la frise circulaire.
  assert.deepEqual(
    fig([sh('18:00', '01:00')], [sh('01:00', '02:00')]),
    { unplanned: false, lateMinutes: 0, earlyMinutes: 420, extraMinutes: 60, workedMinutes: 60 },
    'réel 01:00-02:00 / prévu 18:00-01:00 : pas apparié'
  )
  // Même appariement avec un second service de jour, et dans l'autre sens (réel qui commence avant minuit).
  const nightTwo = fig([sh('11:00', '15:00'), sh('23:00', '03:00')], [sh('11:00', '15:00'), sh('00:30', '03:00')])
  assert.deepEqual([nightTwo.lateMinutes, nightTwo.earlyMinutes, nightTwo.extraMinutes, nightTwo.workedMinutes], [90, 0, 0, 390])
  const nightEarly = fig([sh('00:30', '03:00')], [sh('23:00', '03:00')])
  assert.deepEqual([nightEarly.lateMinutes, nightEarly.earlyMinutes, nightEarly.extraMinutes, nightEarly.workedMinutes], [0, 150, 240, 240], 'sens inverse (prévu 00:30-03:00, réel 23:00-03:00) : la règle est à 0 ou +24 h, pas apparié')
  // Le réel ne se pose qu'à 0 ou +24 h (jamais -24 h), comme figures() de l'app : 22:00-10:00 ne rejoint pas 00:00-08:00.
  const longNight = fig([sh('00:00', '08:00')], [sh('22:00', '10:00')])
  assert.deepEqual([longNight.lateMinutes, longNight.earlyMinutes, longNight.extraMinutes, longNight.workedMinutes], [0, 480, 720, 720])

  // Absent : tout à zéro.
  assert.deepEqual(figuresOf('absent', planned(sh('11:00', '16:00')), []), {
    unplanned: false, lateMinutes: 0, earlyMinutes: 0, extraMinutes: 0, workedMinutes: 0,
  })
  assert.deepEqual(figuresOf('absent', planned(sh('11:00', '16:00')), [sh('11:00', '12:00')]).workedMinutes, 0, 'un absent ne travaille pas')

  // Hors planning : repos, congé, absence, rien.
  for (const status of ['repos', 'conge', 'absence', 'none'] as const) {
    const u = figuresOf('present', { status, shifts: [], source: 'semaine' }, [sh('12:00', '15:00')])
    assert.deepEqual(u, { unplanned: true, lateMinutes: 0, earlyMinutes: 0, extraMinutes: 180, workedMinutes: 180 }, status)
  }
  section('retard, départ anticipé, heures en plus : minuit, 00:00 contre 23:55, deux services, 1 réel / 2 prévus, 2 réels / 1 prévu, ordre inversé, absent, hors planning')
}

// ── travaillé = prévu - retard - départ + plus (boucle aléatoire) ────────────
{
  let seed = 20261104
  const rnd = () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const int = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1))
  const hhmm = (m: number) => {
    const x = ((m % 1440) + 1440) % 1440
    return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`
  }
  let crossing = 0
  for (let i = 0; i < 3000; i++) {
    const count = rnd() < 0.5 ? 1 : 2
    const plan: Shift[] = []
    const real: Shift[] = []
    let start = int(6 * 60, 20 * 60)
    for (let k = 0; k < count; k++) {
      const dur = int(240, 360)
      const ds = int(-60, 60)
      const de = int(-60, 60)
      plan.push(sh(hhmm(start), hhmm(start + dur)))
      real.push(sh(hhmm(start + ds), hhmm(start + dur + de)))
      if (start + dur >= 1440) crossing++
      start += dur + int(150, 300)
      if (start > 20 * 60 + 600) break
    }
    // Les créneaux d'un jour ne se chevauchent pas : on garde ceux qui se tiennent.
    let pl: Shift[]
    let re: Shift[]
    try {
      re = cleanRealShifts(real)
      pl = plan
    } catch {
      continue
    }
    const f = figuresOf('present', planned(...pl), re)
    const plannedTotal = plannedMinutesOf(planned(...pl))
    const workedTotal = re.reduce((s, x) => s + shiftMinutes(x), 0)
    assert.equal(f.workedMinutes, workedTotal, 'travaillé = somme des durées réelles')
    assert.equal(
      f.workedMinutes,
      plannedTotal - f.lateMinutes - f.earlyMinutes + f.extraMinutes,
      `invariant ${JSON.stringify(pl)} / ${JSON.stringify(re)}`
    )
    assert.ok(f.lateMinutes >= 0 && f.earlyMinutes >= 0 && f.extraMinutes >= 0)

    // Un réel de moins (le dernier) : le prévu orphelin compte en entier en départ anticipé, l'invariant tient.
    if (re.length === 2) {
      const g = figuresOf('present', planned(...pl), [re[0]])
      assert.equal(g.workedMinutes, plannedTotal - g.lateMinutes - g.earlyMinutes + g.extraMinutes)
    }
  }
  assert.ok(crossing > 100, 'la boucle traverse minuit')
  section('invariant travaillé = prévu - retard - départ + plus (3000 jours aléatoires, minuit compris)')
}

// ── Créneaux saisis ──────────────────────────────────────────────────────────
{
  assert.deepEqual(cleanRealShifts([sh('18:00', '23:00'), sh('11:00', '16:00')]), [sh('11:00', '16:00'), sh('18:00', '23:00')], 'rangés dans l’ordre du jour')
  assert.deepEqual(cleanRealShifts([sh('11:00', '16:00'), sh('16:00', '20:00')]).length, 2, 'bout à bout : pas un chevauchement')
  assert.equal(cleanRealShifts([sh('18:00', '01:00')]).length, 1, 'passage de minuit accepté')
  assert.deepEqual(cleanRealShifts(null), [])
  assert.equal(code(() => cleanRealShifts([sh('11:00', '16:00'), sh('15:00', '20:00')])).code, 'shifts_overlap')
  assert.equal(code(() => cleanRealShifts([sh('20:00', '02:00'), sh('23:00', '01:00')])).code, 'shifts_overlap', 'chevauchement à travers minuit')
  assert.equal(cleanRealShifts([sh('22:00', '02:00'), sh('01:00', '03:00')]).length, 2, '01:00 le même jour de service est avant 22:00 : pas un conflit')
  assert.equal(code(() => cleanRealShifts([sh('08:00', '10:00'), sh('11:00', '16:00'), sh('18:00', '23:00')])).code, 'invalid_shifts', 'trois créneaux')
  assert.equal(code(() => cleanRealShifts([sh('11:00', '11:00')])).code, 'invalid_shifts', 'de = à')
  assert.equal(code(() => cleanRealShifts([sh('24:00', '11:00')])).code, 'invalid_shifts')
  assert.equal(code(() => cleanRealShifts([{ from: '11:00' }])).code, 'invalid_shifts')
  assert.equal(code(() => cleanRealShifts('11:00')).code, 'invalid_shifts')
  assert.equal(code(() => cleanRealShifts([sh('11:00', '16:00'), sh('15:00', '20:00')])).status, 400)
  section('créneaux saisis : tri, chevauchement, 3 créneaux, de = à, format')
}

// ── Le corps d'une validation ────────────────────────────────────────────────
{
  assert.equal(cleanDate('2026-11-03'), '2026-11-03')
  for (const bad of ['2026-02-30', '2026-13-01', '03/11/2026', '', null, 20261103]) assert.equal(code(() => cleanDate(bad)).code, 'bad_request')

  const rows = cleanRows([
    {
      employeeId: ID(1),
      status: 'present',
      shifts: [sh('18:00', '23:00'), sh('11:00', '16:00')],
      note: '  en retard  ',
      // Tout cela est ignoré.
      unplanned: true,
      lateMinutes: 999,
      workedMinutes: 99999,
      extraMinutes: 5,
      updatedBy: 'pirate@example.com',
      history: [{ at: 'x' }],
      planned: { status: 'repos' },
      createdBy: 'x',
    },
  ])
  assert.deepEqual(Object.keys(rows[0]).sort(), ['asPlanned', 'employeeId', 'justification', 'note', 'shifts', 'status'])
  assert.deepEqual(rows[0].shifts, [sh('11:00', '16:00'), sh('18:00', '23:00')])
  assert.equal(rows[0].note, 'en retard')

  const asPlanned = cleanRows([{ employeeId: ID(2), status: 'present', asPlanned: true, shifts: [sh('99:00', '11:00')] }])
  assert.deepEqual([asPlanned[0].asPlanned, asPlanned[0].shifts], [true, []], 'comme prévu : les créneaux du corps sont ignorés')
  const gone = cleanRows([{ employeeId: ID(3), status: 'absent', shifts: [sh('99:00', '11:00')], justification: 'justifiee' }])
  assert.deepEqual([gone[0].shifts, gone[0].justification], [[], 'justifiee'])

  assert.equal(code(() => cleanRows([{ employeeId: ID(1), status: 'present' }, { employeeId: ID(1), status: 'absent' }])).code, 'bad_request', 'doublon')
  assert.equal(code(() => cleanRows(Array.from({ length: 101 }, (_, i) => ({ employeeId: ID(i + 1), status: 'absent' })))).code, 'bad_request', '101 lignes')
  assert.equal(cleanRows(Array.from({ length: 100 }, (_, i) => ({ employeeId: ID(i + 1), status: 'absent' }))).length, 100, '100 lignes passent')
  assert.equal(code(() => cleanRows([{ employeeId: 'nope', status: 'absent' }])).code, 'not_found')
  assert.equal(code(() => cleanRows([{ employeeId: ID(1), status: 'late' }])).code, 'bad_request')
  assert.equal(code(() => cleanRows([{ employeeId: ID(1), status: 'absent', justification: 'maybe' }])).code, 'bad_request')
  assert.equal(code(() => cleanRows([{ employeeId: ID(1), status: 'absent', note: 'x'.repeat(201) }])).code, 'bad_request')
  assert.equal(cleanRows([{ employeeId: ID(1), status: 'absent', note: 'x'.repeat(200) }])[0].note.length, 200)
  assert.equal(code(() => cleanRows({})).code, 'bad_request')
  assert.equal(code(() => cleanRows(['x'])).code, 'bad_request')
  assert.equal(code(() => cleanRows([{ status: 'absent' }])).code, 'bad_request')
  assert.equal(code(() => cleanRows([{ employeeId: ID(1), status: 'present', shifts: [sh('11:00', '16:00'), sh('15:00', '20:00')] }])).code, 'shifts_overlap')
  section('corps : champs inconnus ignorés, doublon, 100 lignes, id, statut, justification, note')
}

// ── Le plan d'écriture ───────────────────────────────────────────────────────

const A = ID(0xa)
const B = ID(0xb)
const C = ID(0xc)
const NOW = new Date('2026-11-04T09:00:00.000Z')
const DATE = '2026-11-03'

const row = (employeeId: string, over: Partial<RowInput> = {}): RowInput => ({
  employeeId, status: 'present', asPlanned: true, justification: null, shifts: [], note: '', ...over,
})
const LIVE = new Map<string, PlanningCell>([
  [A, cellOf('travail', [sh('11:00', '16:00'), sh('18:00', '23:00')])],
  [B, cellOf('travail', [sh('18:00', '01:00')])],
  [C, cellOf('repos')],
])

/** Rejoue des ops comme la base le fait ($set, $push + $slice, $inc), pour suivre une ligne d'une écriture à l'autre. */
function apply(store: Map<string, StoredAttendance>, ops: RowOp[], date = DATE) {
  for (const op of ops) {
    const cur = store.get(op.employeeId)
    const { updatedBy, updatedAt, planned: snap, ...rest } = op.set
    const next: StoredAttendance = {
      employeeId: op.employeeId,
      date,
      planned: cur?.planned as PlannedSnapshot,
      updatedBy: cur?.updatedBy ?? '',
      updatedAt: cur?.updatedAt ?? null,
      history: cur?.history ?? [],
      historyDropped: cur?.historyDropped ?? 0,
      created: cur?.created ?? op.created,
      ...rest,
    } as StoredAttendance
    if (snap) next.planned = snap
    if (updatedBy !== undefined) {
      next.updatedBy = updatedBy
      next.updatedAt = updatedAt ?? null
    }
    if (op.entry) {
      const h = pushHistory(cur?.history ?? [], cur?.historyDropped ?? 0, op.entry)
      assert.equal(h.historyDropped, (cur?.historyDropped ?? 0) + op.droppedInc, '`$inc` de la base = ce que pushHistory fait sortir')
      next.history = h.history
      next.historyDropped = h.historyDropped
    }
    store.set(op.employeeId, next)
  }
}

const base = (over: Partial<Parameters<typeof planWrite>[0]> = {}): Parameters<typeof planWrite>[0] => ({
  date: DATE, validated: false, now: NOW, by: 'gerant@example.com', rows: [], live: LIVE,
  required: [A, B], existing: new Map(), ...over,
})

{
  // missing_rows : première validation seulement.
  const first = code(() => planWrite(base({ rows: [row(A)] })))
  assert.equal(first.code, 'missing_rows')
  assert.equal(first.status, 400)
  assert.deepEqual(first.extra, { employeeIds: [B] })
  assert.doesNotThrow(() => planWrite(base({ validated: true, rows: [row(A)] })), 'après validation, on peut n’envoyer que les lignes qui changent')
  assert.doesNotThrow(() => planWrite(base({ rows: [row(A), row(B), row(C, { status: 'present', shifts: [sh('12:00', '15:00')], asPlanned: false })] })), 'un employé hors planning en plus')
  assert.doesNotThrow(() => planWrite(base({ required: [], rows: [] })), 'personne n’est planifié : rien ne manque')

  // Refus de ligne.
  assert.equal(code(() => planWrite(base({ rows: [row(A), row(B), row(C, { status: 'absent' })] }))).code, 'absent_not_planned')
  assert.equal(code(() => planWrite(base({ rows: [row(A), row(B), row(C)] }))).code, 'shifts_required', '« comme prévu » un jour de repos')
  assert.equal(code(() => planWrite(base({ rows: [row(A), row(B), row(C, { asPlanned: false })] }))).code, 'shifts_required', 'présent sans créneaux un jour non planifié')

  // Première validation : comme prévu, retard, absent, hors planning.
  const rows = [
    row(A),
    row(B, { asPlanned: false, shifts: [sh('18:25', '01:00')], note: 'bus' }),
    row(C, { asPlanned: false, shifts: [sh('12:00', '15:00')] }),
  ]
  const store = new Map<string, StoredAttendance>()
  const p1 = planWrite(base({ rows }))
  assert.equal(p1.changed, 3)
  assert.deepEqual(p1.ops.map((o) => o.kind), ['insert', 'insert', 'insert'])
  const [opA, opB, opC] = p1.ops
  assert.deepEqual([opA.set.workedMinutes, opA.set.lateMinutes, opA.set.shifts.length], [600, 0, 2], 'A : comme prévu = ses créneaux planifiés')
  assert.deepEqual([opB.set.workedMinutes, opB.set.lateMinutes, opB.set.note], [395, 25, 'bus'])
  assert.deepEqual([opC.set.unplanned, opC.set.extraMinutes, opC.set.workedMinutes], [true, 180, 180])
  assert.equal(opA.entry?.before, null, 'création : avant = null')
  assert.equal(opA.entry?.by, 'gerant@example.com')
  assert.deepEqual(Object.keys(opA.entry!.after).sort(), ['justification', 'note', 'shifts', 'status'], 'l’historique ne garde que les 4 champs')
  assert.equal(opA.set.updatedBy, 'gerant@example.com')
  apply(store, p1.ops)

  // Rejouer le même corps : rien ne change, aucune entrée d'historique.
  const p2 = planWrite(base({ validated: true, rows, existing: store }))
  assert.equal(p2.changed, 0)
  assert.deepEqual(p2.ops, [], 'idempotent : aucune écriture')
  assert.equal(store.get(A)!.history.length, 1)

  // Un mélange : B change (retard 25 -> 10 min), A et C restent tels quels.
  const mixed = planWrite(
    base({
      validated: true,
      existing: store,
      rows: [rows[0], row(B, { asPlanned: false, shifts: [sh('18:10', '01:00')], note: 'bus' }), rows[2]],
    })
  )
  assert.equal(mixed.changed, 1)
  assert.deepEqual(mixed.ops.map((o) => [o.employeeId, o.kind]), [[B, 'update']], 'seule la ligne qui change s’écrit')
  assert.deepEqual(mixed.ops[0].entry?.before?.shifts, [sh('18:25', '01:00')])
  assert.deepEqual(mixed.ops[0].entry?.after.shifts, [sh('18:10', '01:00')])
  assert.equal(mixed.ops[0].set.lateMinutes, 10)
  assert.equal(mixed.ops[0].set.planned, undefined, 'la photo d’un jour validé n’est pas réécrite')
  apply(store, mixed.ops)
  assert.equal(store.get(B)!.history.length, 2)
  assert.equal(store.get(A)!.history.length, 1, 'une ligne identique n’ajoute pas d’entrée')

  section('écriture : missing_rows, refus de lignes, première validation, rejouée à l’identique (changed 0), mélange changé / inchangé')
}

// ── Justification, photo du planning ─────────────────────────────────────────
{
  const d = planWrite(base({ required: [], rows: [row(A, { status: 'absent', asPlanned: false })] })).ops[0]
  assert.equal(d.set.justification, 'non_justifiee', 'absent sans justification : non justifié')
  assert.deepEqual([d.set.workedMinutes, d.set.shifts.length], [0, 0])
  const j = planWrite(base({ required: [], rows: [row(A, { status: 'absent', asPlanned: false, justification: 'justifiee' })] })).ops[0]
  assert.equal(j.set.justification, 'justifiee')
  const p = planWrite(base({ required: [], rows: [row(A, { justification: 'justifiee' })] })).ops[0]
  assert.equal(p.set.justification, null, 'une justification sur un présent n’est pas gardée')

  // La photo : statut, créneaux, provenance — rien d’autre.
  assert.deepEqual(snapshotOf(cellOf('maladie', [], 'grippe, certificat du Dr X')), { status: 'absence', shifts: [], source: 'semaine' })
  assert.ok(!JSON.stringify(snapshotOf(cellOf('maladie', [], 'grippe'))).includes('grippe'), 'le motif ne se copie jamais')
  assert.ok(!JSON.stringify(snapshotOf(cellOf('travail', [sh('11:00', '16:00')], 'note privée'))).includes('privée'), 'la note du planning non plus')
  assert.equal(snapshotOf(cellOf('conge')).status, 'conge')
  assert.equal(snapshotOf(cellOf('none')).status, 'none')
  assert.deepEqual(snapshotOf(cellOf('repos', [sh('11:00', '16:00')])).shifts, [], 'un repos n’a pas de créneaux')
  for (const op of planWrite(base({ rows: [row(A), row(B)] })).ops) {
    assert.deepEqual(Object.keys(op.set.planned!).sort(), ['shifts', 'source', 'status'])
  }

  // Avant la validation, chaque écriture rafraîchit la photo ; après, elle est figée.
  const store = new Map<string, StoredAttendance>()
  apply(store, planWrite(base({ rows: [row(A), row(B)] })).ops)
  const moved = new Map(LIVE)
  moved.set(A, cellOf('travail', [sh('14:00', '22:00')]))

  const before = planWrite(base({ live: moved, existing: store, rows: [row(A), row(B)] }))
  const opA = before.ops.find((o) => o.employeeId === A)!
  assert.equal(opA.kind, 'update', 'avant validation, « comme prévu » suit le planning du moment')
  assert.deepEqual(opA.set.planned?.shifts, [sh('14:00', '22:00')], 'photo rafraîchie')
  assert.equal(opA.set.workedMinutes, 480)
  const refreshed = before.ops.find((o) => o.employeeId === B)!
  assert.deepEqual([refreshed.kind, refreshed.changed, refreshed.entry], ['refresh', false, null], 'rien de saisi n’a changé : on rafraîchit sans historique')
  assert.ok(refreshed.set.planned)
  assert.equal(before.changed, 1)

  const after = planWrite(base({ validated: true, live: moved, existing: store, rows: [row(A), row(B)] }))
  assert.deepEqual(after.ops, [], 'jour validé : la photo figée garde « comme prévu » identique')
  const absent = planWrite(base({ validated: true, live: moved, existing: store, rows: [row(A, { status: 'absent', asPlanned: false, justification: 'justifiee' })] }))
  assert.equal(absent.ops[0].set.planned, undefined, 'photo non réécrite')
  assert.equal(absent.ops[0].set.workedMinutes, 0)
  // Contre la photo figée (11-16 / 18-23), pas contre le planning d’aujourd’hui (14-22).
  const late = planWrite(base({ validated: true, live: moved, existing: store, rows: [row(A, { asPlanned: false, shifts: [sh('11:30', '16:00'), sh('18:00', '23:00')] })] }))
  assert.deepEqual([late.ops[0].set.lateMinutes, late.ops[0].set.extraMinutes], [30, 0])

  // Une ligne neuve après validation prend la photo du planning du moment.
  const D = ID(0xd)
  const fresh = planWrite(base({ validated: true, required: [], live: new Map([[D, cellOf('travail', [sh('09:00', '12:00')])]]), rows: [row(D)] }))
  assert.equal(fresh.ops[0].kind, 'insert')
  assert.deepEqual(fresh.ops[0].set.planned?.shifts, [sh('09:00', '12:00')])
  section('absent sans justification, photo du planning sans note ni motif (maladie = absence), photo rafraîchie avant validation puis figée')
}

// ── Historique : 20 gardées, le reste compté ────────────────────────────────
{
  const store = new Map<string, StoredAttendance>()
  for (let i = 0; i < 25; i++) {
    const r = planWrite(base({ validated: i > 0, required: [], existing: store, rows: [row(A, { note: `n${i}` })] }))
    assert.equal(r.changed, 1)
    apply(store, r.ops)
  }
  const a = store.get(A)!
  assert.equal(a.history.length, HISTORY_CAP)
  assert.equal(HISTORY_CAP, 20)
  assert.equal(a.historyDropped, 5, '25 modifications : 20 gardées, 5 sorties')
  assert.equal(a.history[0].after.note, 'n5')
  assert.equal(a.history[19].after.note, 'n24', 'la plus récente en dernier')
  assert.equal(a.history[0].before?.note, 'n4')
  // Un rejeu ne bouge rien.
  assert.deepEqual(planWrite(base({ validated: true, required: [], existing: store, rows: [row(A, { note: 'n24' })] })).ops, [])
  // pushHistory seul.
  const h = pushHistory([], 0, { at: NOW, by: 'x', before: null, after: { status: 'absent', justification: null, shifts: [], note: '' } })
  assert.deepEqual([h.history.length, h.historyDropped], [1, 0])
  // Le créateur reste épinglé : 25 modifications ont fait sortir sa propre entrée de l'historique, pas `created`.
  assert.equal(a.history.some((h) => h.before === null), false, 'l’entrée de création est sortie de l’historique')
  assert.deepEqual([a.created?.by, a.created?.after.note, a.created?.at], ['gerant@example.com', 'n0', NOW])
  const out = dayBody({ date: DATE, now: NOW, role: 'manager', marker: null, roster: [{ employeeId: A, name: 'Alice', poste: '', active: true, cell: LIVE.get(A)! }], records: [a], people: new Map() }).rows[0]
  assert.deepEqual([out.created?.by, out.created?.after.note, out.historyDropped], ['gerant@example.com', 'n0', 5])
  assert.deepEqual(Object.keys(out.created!), ['at', 'by', 'after'])
  // Une ligne neuve : `created` posé à l'insertion seulement, jamais sur une mise à jour.
  const fresh = planWrite(base({ required: [], rows: [row(A)] })).ops[0]
  assert.deepEqual([fresh.kind, fresh.prevUpdatedAt, fresh.created?.by], ['insert', null, 'gerant@example.com'])
  const upd = planWrite(base({ validated: true, required: [], existing: store, rows: [row(A, { note: 'autre' })] })).ops[0]
  assert.deepEqual([upd.kind, upd.created, upd.prevUpdatedAt], ['update', null, a.updatedAt], 'la mise à jour filtre sur l’updatedAt lu')
  section('historique : 25 modifications laissent 20 entrées et historyDropped 5, created épinglé')
}

// ── Le premier qui valide reste ──────────────────────────────────────────────
{
  const first = markerOutcome(null, { by: 'a@x.tn', at: new Date('2026-11-04T08:00:00Z') })
  assert.deepEqual([first.validatedBy, first.alreadyValidated], ['a@x.tn', false])
  const second = markerOutcome({ validatedBy: 'a@x.tn', validatedAt: first.validatedAt }, { by: 'b@x.tn', at: new Date('2026-11-04T09:00:00Z') })
  assert.deepEqual([second.validatedBy, second.alreadyValidated], ['a@x.tn', true])
  assert.equal(second.validatedAt.getTime(), first.validatedAt.getTime(), 'la date du premier aussi')
  section('marqueur : le premier validateur reste, alreadyValidated au second passage')
}

// ── La fenêtre de saisie ─────────────────────────────────────────────────────
{
  // Le 4 nov. 2026 : la fenêtre d'un gérant s'arrête au début du 7 nov. à Tunis, soit le 6 nov. 23:00 UTC.
  const D = '2026-11-04'
  const limit = startOfDay('2026-11-07', 'Africa/Tunis')
  assert.equal(limit.toISOString(), '2026-11-06T23:00:00.000Z')
  assert.equal(editWindow(D, new Date(limit.getTime() - 1), 'manager').editableUntil.getTime(), limit.getTime())
  assert.equal(editWindow(D, new Date(limit.getTime() - 1), 'manager').canEdit, true, 'une ms avant : ouvert')
  assert.equal(editWindow(D, limit, 'manager').canEdit, false, 'pile à startOfDay(D+3) : fermé')
  assert.equal(editWindow(D, new Date(limit.getTime() + 1), 'manager').canEdit, false)

  // La date UTC et la date de Tunis diffèrent : 23:30 UTC le 6 nov. est déjà le 7 nov. à Tunis.
  const odd = new Date('2026-11-06T23:30:00.000Z')
  assert.equal(odd.toISOString().slice(0, 10), '2026-11-06')
  assert.equal(editWindow(D, odd, 'manager').canEdit, false, 'un gérant est refusé : à Tunis on est le 7')
  assert.equal(code(() => assertWritable(D, odd, 'manager')).code, 'window_closed')
  assert.equal(code(() => assertWritable(D, odd, 'manager')).status, 403)
  assert.doesNotThrow(() => assertWritable(D, new Date('2026-11-06T22:30:00.000Z'), 'manager'), '22:30 UTC = 23:30 à Tunis le 6 : ouvert')

  // Un admin écrit toujours.
  assert.equal(editWindow(D, new Date('2027-06-01T00:00:00Z'), 'admin').canEdit, true)
  assert.doesNotThrow(() => assertWritable(D, new Date('2027-06-01T00:00:00Z'), 'admin'))

  // Jour futur : refusé pour tous. Aujourd'hui : permis. Le jour de Tunis fait foi, pas celui de l'UTC.
  const now = new Date('2026-11-06T23:30:00.000Z') // le 7 à Tunis
  assert.doesNotThrow(() => assertWritable('2026-11-07', now, 'manager'), 'aujourd’hui (Tunis) est permis')
  assert.equal(code(() => assertWritable('2026-11-08', now, 'manager')).code, 'future_day')
  assert.equal(code(() => assertWritable('2026-11-08', now, 'admin')).code, 'future_day', 'même pour un admin')
  assert.equal(code(() => assertWritable('2026-11-08', now, 'admin')).status, 400)
  assert.equal(editWindow('2026-11-08', now, 'admin').future, true)
  assert.equal(editWindow('2026-11-08', now, 'admin').canEdit, false)

  assert.deepEqual(statusDates('2026-11-04'), ['2026-11-02', '2026-11-03', '2026-11-04'])
  assert.deepEqual(alertDates('2026-11-04'), ['2026-11-02', '2026-11-03'])
  section('fenêtre : startOfDay(D+3) à Tunis (une ms avant / pile), UTC ≠ Tunis, admin toujours, futur refusé')
}

// ── L'échéance ───────────────────────────────────────────────────────────────
{
  assert.deepEqual(DEFAULT_ATTENDANCE_DEADLINE, { afterDays: 1, time: '12:00' })
  // Le 3 nov. : échéance le 4 nov. 12:00 à Tunis = 11:00 UTC.
  const at = attendanceDeadlineAt('2026-11-03', DEFAULT_ATTENDANCE_DEADLINE)
  assert.equal(at.toISOString(), '2026-11-04T11:00:00.000Z')
  assert.equal(attendanceDeadlinePassed(at, at), false, 'à 12:00 pile : pas en retard')
  assert.equal(attendanceDeadlinePassed(at, new Date(at.getTime() + 1)), true, 'une ms après : en retard')
  assert.equal(attendanceDeadlinePassed(at, new Date(at.getTime() - 1)), false)
  assert.equal(attendanceDeadlineAt('2026-11-03', { afterDays: 0, time: '23:30' }).toISOString(), '2026-11-03T22:30:00.000Z')
  assert.equal(attendanceDeadlineAt('2026-11-30', { afterDays: 2, time: '08:00' }).toISOString(), '2026-12-02T07:00:00.000Z', 'à cheval sur le mois')

  // Réglage : valide, JSON en texte, sinon le défaut.
  assert.deepEqual(parseAttendanceDeadline({ afterDays: 0, time: '20:00' }), { afterDays: 0, time: '20:00' })
  assert.deepEqual(parseAttendanceDeadline('{"afterDays":2,"time":"09:15"}'), { afterDays: 2, time: '09:15' })
  const bads: unknown[] = [undefined, null, '', 'nope', '{', [], 42, {}, { afterDays: 1 }, { time: '12:00' }, { afterDays: 3, time: '12:00' }, { afterDays: -1, time: '12:00' }, { afterDays: 1.5, time: '12:00' }, { afterDays: '1', time: '12:00' }, { afterDays: 1, time: '24:00' }, { afterDays: 1, time: '9:00' }, { weekday: 3, time: '18:00' }]
  for (const bad of bads) {
    assert.deepEqual(parseAttendanceDeadline(bad), DEFAULT_ATTENDANCE_DEADLINE, `repli sur le défaut : ${JSON.stringify(bad)}`)
    assert.equal(strictAttendanceDeadline(bad), null, `refusé à l’écriture : ${JSON.stringify(bad)}`)
  }
  assert.notEqual(parseAttendanceDeadline(undefined), DEFAULT_ATTENDANCE_DEADLINE, 'une copie, pas le défaut partagé')
  assert.equal(attendanceDeadlineLabel({ afterDays: 1, time: '12:00' }), 'le lendemain 12:00')
  assert.equal(attendanceDeadlineLabel({ afterDays: 0, time: '20:00' }), 'le jour même 20:00')
  assert.equal(attendanceDeadlineLabel({ afterDays: 2, time: '09:00' }), 'le surlendemain 09:00')
  section('échéance : D+1 12:00 Tunis (pile : pas en retard, +1 ms : en retard), repli sur le défaut, refus à l’écriture')
}

// ── La synthèse ──────────────────────────────────────────────────────────────
{
  assert.deepEqual(parseSummaryRange('2026-08-01', '2026-10-31'), { from: '2026-08-01', to: '2026-10-31' }, '92 jours bornes comprises')
  assert.equal(code(() => parseSummaryRange('2026-08-01', '2026-11-01')).code, 'range_too_long', '93 jours')
  assert.deepEqual(parseSummaryRange('2026-11-03', '2026-11-03'), { from: '2026-11-03', to: '2026-11-03' })
  const badRanges: [unknown, unknown][] = [['2026-11-04', '2026-11-03'], ['x', '2026-11-03'], ['2026-11-03', null], [null, null], ['2026-02-30', '2026-03-01']]
  for (const [f, t] of badRanges) assert.equal(code(() => parseSummaryRange(f, t)).code, 'bad_request')

  const rec = (employeeId: string, date: string, over: Record<string, unknown> = {}) => ({
    employeeId, date, status: 'present' as const, justification: null, plannedMinutes: 300, workedMinutes: 300,
    lateMinutes: 0, earlyMinutes: 0, extraMinutes: 0, unplanned: false, ...over,
  })
  const s = summarize({
    validatedDates: new Set(['2026-11-02', '2026-11-03']),
    records: [
      rec(A, '2026-11-02', { lateMinutes: 25, workedMinutes: 275 }),
      rec(A, '2026-11-03', { status: 'absent', justification: 'justifiee', workedMinutes: 0 }),
      rec(B, '2026-11-03', { status: 'absent', justification: 'non_justifiee', workedMinutes: 0 }),
      rec(B, '2026-11-04', { workedMinutes: 300 }), // jour non validé : ne compte pas
      rec(B, '2026-11-02', { extraMinutes: 30, workedMinutes: 330 }),
    ],
    employees: [
      { employeeId: A, name: 'Alice', active: true, plannedDates: ['2026-11-02', '2026-11-03', '2026-11-04'] },
      { employeeId: B, name: 'Bob', active: true, plannedDates: ['2026-11-02'] },
    ],
    withDays: false,
  })
  const [sa, sb] = s.employees
  assert.deepEqual([sa.plannedMinutes, sa.workedMinutes, sa.daysPresent, sa.lateCount, sa.lateMinutes, sa.absentJustified, sa.absentUnjustified], [600, 275, 1, 1, 25, 1, 0])
  assert.deepEqual([sa.validatedDays, sa.unvalidatedDays], [2, 1], '4 nov. est planifié mais non validé')
  assert.deepEqual([sb.workedMinutes, sb.extraMinutes, sb.absentUnjustified, sb.validatedDays, sb.unvalidatedDays], [330, 30, 1, 2, 0])
  assert.equal(s.totals.workedMinutes, 605)
  assert.equal(s.totals.absentJustified + s.totals.absentUnjustified, 2)
  assert.equal(sa.days, undefined)
  const withDays = summarize({ validatedDates: new Set(['2026-11-02', '2026-11-03']), records: [rec(B, '2026-11-03'), rec(B, '2026-11-02')], employees: [{ employeeId: B, name: 'Bob', active: true, plannedDates: [] }], withDays: true })
  assert.deepEqual(withDays.employees[0].days!.map((d) => d.date), ['2026-11-02', '2026-11-03'], 'jours dans l’ordre')
  assert.deepEqual(Object.keys(withDays.employees[0].days![0]).sort(), ['date', 'earlyMinutes', 'extraMinutes', 'justification', 'lateMinutes', 'plannedMinutes', 'status', 'unplanned', 'workedMinutes'])
  section('synthèse : 92 jours bornes comprises, jours validés seulement, jours non validés comptés, days avec employeeId')
}

// ── Ce que le gérant lit (liste blanche) ─────────────────────────────────────
{
  const SECRETS = ['0612345678', 'CIN-998877', 'grippe sévère', 'certificat du Dr', 'rue Secrète', 'sekret@perso.tn', 'ffffffffffffffffffffffff', '__v', 'password', 'salary']
  const dirtyEntry = (status: string, extra: Record<string, unknown> = {}) => ({ status, justification: null, shifts: [], note: '', medicalReason: 'certificat du Dr', ...extra })
  const dirtyDoc = {
    _id: ID(0x99),
    __v: 3,
    employee: A,
    date: DATE,
    status: 'present',
    justification: null,
    shifts: [{ from: '11:00', to: '16:00', _id: 'zz', cin: 'CIN-998877' }],
    unplanned: false,
    lateMinutes: 0,
    earlyMinutes: 0,
    extraMinutes: 0,
    workedMinutes: 300,
    note: 'RAS',
    planned: { status: 'travail', shifts: [sh('11:00', '16:00')], source: 'semaine', note: 'grippe sévère', medicalReason: 'certificat du Dr' },
    updatedBy: { user: 'ffffffffffffffffffffffff', name: 'gerant@example.com', phone: '0612345678' },
    updatedAt: new Date('2026-11-04T08:00:00Z'),
    createdAt: new Date('2026-11-04T08:00:00Z'),
    history: [{ at: new Date('2026-11-04T08:00:00Z'), by: 'gerant@example.com', before: null, after: dirtyEntry('present', { note: 'RAS', shifts: [sh('11:00', '16:00')], phone: '0612345678' }), ip: '10.0.0.1' }],
    historyDropped: 0,
    created: { at: new Date('2026-11-04T08:00:00Z'), by: 'gerant@example.com', after: dirtyEntry('present', { note: 'RAS', shifts: [sh('11:00', '16:00')], phone: '0612345678' }), ip: '10.0.0.1' },
    password: 'x',
  }
  const stored = storedOf(dirtyDoc)!
  assert.ok(stored)
  const dirtyRoster = [
    { employeeId: A, name: 'Alice', poste: 'Cuisine', active: true, cell: cellOf('travail', [sh('14:00', '22:00')], 'grippe sévère'), phone: '0612345678', cin: 'CIN-998877', address: 'rue Secrète', email: 'sekret@perso.tn', salary: 900 },
    { employeeId: B, name: 'Bob', poste: 'Caisse', active: true, cell: cellOf('travail', [sh('18:00', '01:00')], 'certificat du Dr'), phone: '0612345678' },
    { employeeId: C, name: 'Chadi', poste: 'Livreur', active: true, cell: cellOf('maladie', [], 'grippe sévère'), cin: 'CIN-998877' },
    { employeeId: ID(0xd), name: 'Dora', poste: 'Salle', active: false, cell: cellOf('repos'), address: 'rue Secrète' },
  ] as unknown as RosterEntry[]
  const body = dayBody({
    date: DATE,
    now: NOW,
    role: 'manager',
    marker: { validatedBy: 'gerant@example.com', validatedAt: new Date('2026-11-04T08:00:00Z') },
    roster: dirtyRoster,
    records: [stored],
    people: new Map(),
  })

  const json = JSON.stringify(body)
  for (const secret of SECRETS) assert.ok(!json.includes(secret), `fuite : ${secret}`)

  assert.deepEqual(Object.keys(body), ['date', 'validated', 'validatedBy', 'validatedAt', 'canEdit', 'editableUntil', 'rows', 'others', 'totals'])
  assert.deepEqual(Object.keys(body.totals), ['plannedMinutes', 'workedMinutes', 'lateCount', 'lateMinutes', 'earlyMinutes', 'extraMinutes', 'absentJustified', 'absentUnjustified'])
  const rowKeys = ['employeeId', 'name', 'poste', 'active', 'planned', 'plannedMinutes', 'recorded', 'status', 'justification', 'shifts', 'unplanned', 'lateMinutes', 'earlyMinutes', 'extraMinutes', 'workedMinutes', 'note', 'updatedBy', 'updatedAt', 'history', 'created', 'historyDropped']
  for (const r of body.rows) {
    assert.deepEqual(Object.keys(r), rowKeys)
    assert.deepEqual(Object.keys(r.planned), ['status', 'shifts', 'source'])
    if (r.created) {
      assert.deepEqual(Object.keys(r.created), ['at', 'by', 'after'])
      assert.deepEqual(Object.keys(r.created.after), ['status', 'justification', 'shifts', 'note'])
    }
    for (const h of r.history) {
      assert.deepEqual(Object.keys(h), ['at', 'by', 'before', 'after'])
      assert.deepEqual(Object.keys(h.after), ['status', 'justification', 'shifts', 'note'])
    }
  }
  for (const o of body.others) assert.deepEqual(Object.keys(o), ['employeeId', 'name', 'poste', 'plannedStatus'])

  // Alice a une ligne : lue dans sa photo (11-16), pas dans le planning du moment (14-22).
  const alice = body.rows.find((r) => r.employeeId === A)!
  assert.deepEqual([alice.recorded, alice.planned.shifts, alice.plannedMinutes, alice.workedMinutes, alice.updatedBy], [true, [sh('11:00', '16:00')], 300, 300, 'gerant@example.com'])
  assert.deepEqual(Object.keys(alice.shifts[0]), ['from', 'to'], 'les créneaux ne portent que de/à')
  // Bob n'a pas de ligne : lu dans le planning, rien de saisi.
  const bob = body.rows.find((r) => r.employeeId === B)!
  assert.deepEqual([bob.recorded, bob.status, bob.plannedMinutes, bob.workedMinutes, bob.history.length, bob.updatedAt], [false, null, 420, 0, 0, null])
  // Chadi est malade : pas dans les lignes, et la maladie est une absence.
  assert.ok(!body.rows.some((r) => r.employeeId === C))
  assert.deepEqual(body.others.map((o) => [o.name, o.plannedStatus]), [['Chadi', 'absence']], 'les inactifs et les lignes ne sont pas dans others')
  assert.equal(body.validated, true)
  assert.equal(body.totals.plannedMinutes, 720)
  assert.equal(body.totals.workedMinutes, 300)
  // Une ligne d'un employé hors effectif est rendue quand même.
  const eve = ID(0xe)
  const outside = storedOf({ ...dirtyDoc, employee: eve })!
  const withOutside = dayBody({ date: DATE, now: NOW, role: 'manager', marker: null, roster: dirtyRoster, records: [outside], people: new Map([[eve, { name: 'Eve', poste: 'Plonge', active: false }]]) })
  assert.ok(withOutside.rows.some((r) => r.name === 'Eve' && r.active === false))
  assert.equal(withOutside.validated, false)
  assert.deepEqual([withOutside.validatedBy, withOutside.validatedAt], [null, null])

  // Absents, retards, comptés dans les totaux.
  const mk = (id: string, over: Record<string, unknown>) => storedOf({ ...dirtyDoc, employee: id, ...over })!
  const empty = { date: DATE, now: NOW, role: 'manager', marker: null, roster: [] as RosterEntry[], records: [], people: new Map() }
  const totalsBody = dayBody({
    ...empty,
    roster: dirtyRoster,
    records: [
      mk(A, { lateMinutes: 25, earlyMinutes: 10, extraMinutes: 5, workedMinutes: 270 }),
      mk(B, { status: 'absent', justification: 'justifiee', workedMinutes: 0, shifts: [] }),
      mk(C, { status: 'absent', justification: null, workedMinutes: 0, shifts: [] }),
    ],
  })
  assert.deepEqual(totalsBody.totals, { plannedMinutes: 900, workedMinutes: 270, lateCount: 1, lateMinutes: 25, earlyMinutes: 10, extraMinutes: 5, absentJustified: 1, absentUnjustified: 1 })

  // canEdit : l'horloge du serveur et le rôle.
  assert.equal(dayBody(empty).canEdit, true)
  assert.equal(dayBody({ ...empty, now: new Date('2026-11-06T23:00:00Z') }).canEdit, false)
  assert.equal(dayBody({ ...empty, now: new Date('2026-11-06T23:00:00Z'), role: 'admin' }).canEdit, true)
  assert.equal(dayBody(empty).editableUntil, '2026-11-05T23:00:00.000Z', 'D+3 pour le 3 nov. : le 6 nov. 00:00 Tunis')

  // Les formes A1 et A4.
  const status = statusBody({
    tz: 'Africa/Tunis', now: new Date('2026-11-04T11:00:01Z'), role: 'manager', deadline: DEFAULT_ATTENDANCE_DEADLINE,
    days: [
      { date: '2026-11-02', plannedCount: 5, marker: { validatedBy: 'a@x.tn', validatedAt: new Date('2026-11-03T08:00:00Z') } },
      { date: '2026-11-03', plannedCount: 6, marker: null },
      { date: '2026-11-04', plannedCount: 0, marker: null },
    ],
  })
  assert.deepEqual(Object.keys(status), ['tz', 'deadline', 'days'])
  assert.deepEqual(status.deadline, { afterDays: 1, time: '12:00' })
  assert.deepEqual(Object.keys(status.days[0]), ['date', 'plannedCount', 'validated', 'validatedBy', 'validatedAt', 'deadlineAt', 'deadlinePassed', 'editableUntil'])
  assert.deepEqual(status.days.map((d) => [d.validated, d.deadlinePassed]), [[true, true], [false, true], [false, false]])
  assert.deepEqual([status.days[1].validatedBy, status.days[1].validatedAt], [null, null])
  assert.equal(status.days[1].deadlineAt, '2026-11-04T11:00:00.000Z')

  const sum = summaryBody('2026-11-01', '2026-11-30', summarize({
    validatedDates: new Set([DATE]), records: [], employees: [{ employeeId: A, name: 'Alice', active: true, plannedDates: [] }], withDays: false,
  }))
  assert.deepEqual(Object.keys(sum), ['from', 'to', 'employees', 'totals'])
  assert.deepEqual(Object.keys(sum.employees[0]), ['employeeId', 'name', 'active', 'plannedMinutes', 'workedMinutes', 'daysPresent', 'lateCount', 'lateMinutes', 'earlyMinutes', 'extraMinutes', 'absentJustified', 'absentUnjustified', 'validatedDays', 'unvalidatedDays'])

  // storedOf : une chose qui n'est pas une ligne n'en est pas une.
  assert.equal(storedOf(null), null)
  assert.equal(storedOf({ employee: A, status: 'weird' }), null)
  assert.deepEqual(storedOf({ ...dirtyDoc, planned: { status: 'maladie', note: 'grippe sévère' } })!.planned, { status: 'none', shifts: [], source: 'none' }, 'une photo inconnue n’est pas recopiée telle quelle')
  section('liste blanche : aucun champ privé ne sort, formes A1 / A2 / A4, ligne lue dans sa photo, maladie = absence')
}
