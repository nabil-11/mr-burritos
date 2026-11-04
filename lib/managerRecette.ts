import { isMovementKind } from './movementKinds'

/**
 * La recette ouverte vue par l'app du gérant, et les règles de ses écritures —
 * pur, ni Mongo ni serveur, donc vérifié par scripts/check-manager-write.ts.
 *
 * Liste blanche : on n'y copie que ce que l'écran affiche. Pas d'`_id` de
 * sous-document hors `id`, pas de `clientKey`, pas de journal de corrections,
 * pas de totaux figés, rien de la fiche d'un employé (ni téléphone, ni e-mail,
 * ni CIN) : une avance ne porte que `{ id, name }`. Les auteurs sont les noms
 * copiés sur la ligne le jour où elle a été écrite — l'e-mail du compte pour
 * l'app du gérant, un nom de poste pour la caisse.
 */

const round2 = (n: number) => Math.round(n * 100) / 100

// ── La clé d'idempotence ───────────────────────────────────────

/** Générée à l'ouverture du formulaire, gardée pour les nouvelles tentatives. */
const CLIENT_KEY = /^[A-Za-z0-9-]{16,64}$/
export const isClientKey = (v: unknown): v is string => typeof v === 'string' && CLIENT_KEY.test(v)

/**
 * Faut-il rejouer ? Oui si une ligne de la recette porte déjà cette clé : on
 * rend cette ligne, on n'en écrit pas une seconde. Les anciennes lignes (sans
 * clé) et celles de la caisse ne sont jamais prises pour un rejeu.
 */
export function movementByKey<T extends { clientKey?: string | null }>(
  movements: readonly T[] | null | undefined,
  key: string
): T | null {
  return (movements ?? []).find((m) => typeof m.clientKey === 'string' && m.clientKey === key) ?? null
}

/**
 * Le rejeu porte-t-il la même demande que la ligne déjà écrite ? Compare le
 * type, le montant (arrondi à 2), l'employé et le libellé (rogné) ; la note
 * n'entre pas. Une avance a un libellé fait par le serveur (« Avance · Nom ») :
 * on ne compare alors pas le libellé, l'employé suffit.
 */
export function sameMovement(
  stored: { kind?: unknown; label?: unknown; amount?: unknown; employee?: { id?: unknown } | null },
  sent: { kind?: unknown; label?: unknown; amount?: unknown; employeeId?: unknown }
): boolean {
  if (String(stored.kind ?? '') !== String(sent.kind ?? '')) return false
  if (round2(Number(stored.amount) || 0) !== round2(Number(String(sent.amount ?? '').replace(',', '.')) || 0)) return false
  const storedEmployee = stored.employee?.id ? String(stored.employee.id) : null
  const sentEmployee = sent.employeeId ? String(sent.employeeId) : null
  if (storedEmployee !== sentEmployee) return false
  if (sentEmployee) return true
  return String(stored.label ?? '').trim() === String(sent.label ?? '').trim()
}

// ── Les montants ───────────────────────────────────────────────

const MONEY = /^\d+(?:[.,]\d+)?$/
const MAX_MOVEMENT = 100_000
const MAX_CLOSING = 1_000_000

/** Un nombre, ou un texte « 12,5 » : jamais « 12abc », « 1e3 », « -3 » ni du vide. Arrondi à 2 décimales. */
export function parseMoney(raw: unknown): number | null {
  let n: number
  if (typeof raw === 'number') n = raw
  else if (typeof raw === 'string' && MONEY.test(raw.trim())) n = Number(raw.trim().replace(',', '.'))
  else return null
  return Number.isFinite(n) ? round2(n) : null
}

/** Montant d'un mouvement : > 0 (après arrondi) et ≤ 100 000. */
export function parseMovementAmount(raw: unknown): number | null {
  const n = parseMoney(raw)
  return n !== null && n > 0 && n <= MAX_MOVEMENT ? n : null
}

/** Espèces comptées à la clôture : de 0 (un tiroir vide se compte) à 1 000 000. */
export function parseClosingCash(raw: unknown): number | null {
  const n = parseMoney(raw)
  return n !== null && n >= 0 && n <= MAX_CLOSING ? n : null
}

// ── Les corps de requête ───────────────────────────────────────

const OBJECT_ID = /^[0-9a-fA-F]{24}$/
const isObjectId = (v: unknown): v is string => typeof v === 'string' && OBJECT_ID.test(v)

export type Parsed<T> = { ok: true; value: T } | { ok: false; message: string }
const refuse = (message: string): { ok: false; message: string } => ({ ok: false, message })

export interface MovementRequest {
  recetteId: string
  key: string
  input: {
    kind: string
    label: string
    amount: number
    note: string
    employeeId: string | null
    employeeReason: 'avance'
  }
}

/**
 * POST /api/manager/recette/movements. Une avance (`employeeId`) est toujours
 * une dépense au motif « avance » : le serveur l'impose, l'app n'a pas à le
 * dire, et « salaire » demandé par un client est refusé.
 */
export function parseMovementBody(body: Record<string, unknown>): Parsed<MovementRequest> {
  if (!isObjectId(body.recetteId)) return refuse('recetteId invalide')
  if (!isClientKey(body.key)) return refuse('key invalide : 16 à 64 caractères, lettres, chiffres ou tirets')
  if (body.employeeReason === 'salaire' || body.reason === 'salaire') {
    return refuse('Un salaire ne se verse pas depuis cette route')
  }
  const hasEmployee = body.employeeId !== undefined && body.employeeId !== null && body.employeeId !== ''
  if (hasEmployee && !isObjectId(body.employeeId)) return refuse('employeeId invalide')
  const kind = hasEmployee ? 'depense' : body.kind
  if (!isMovementKind(kind)) return refuse('kind invalide : achat, depense, apport ou retrait')
  const amount = parseMovementAmount(body.amount)
  if (amount === null) return refuse('Montant invalide : de 0,01 à 100000')
  if (body.label !== undefined && body.label !== null && typeof body.label !== 'string') return refuse('label invalide')
  if (body.note !== undefined && body.note !== null && typeof body.note !== 'string') return refuse('note invalide')
  const label = typeof body.label === 'string' ? body.label.trim().slice(0, 80) : ''
  if (!label && !hasEmployee) return refuse('Indiquez un libellé')
  return {
    ok: true,
    value: {
      recetteId: body.recetteId,
      key: body.key,
      input: {
        kind,
        label,
        amount,
        note: typeof body.note === 'string' ? body.note.trim().slice(0, 200) : '',
        employeeId: hasEmployee ? (body.employeeId as string) : null,
        employeeReason: 'avance',
      },
    },
  }
}

export interface CloseRequest {
  recetteId: string
  closingCash: number | null
  expectedCash: number
  notes: string
}

/**
 * POST /api/manager/recette/close. Compter ou non est dit, jamais deviné :
 * `closingCash: null` ne passe qu'avec `notCounted: true`, et un montant
 * compté ne passe qu'avec `notCounted: false`.
 */
export function parseCloseBody(body: Record<string, unknown>): Parsed<CloseRequest> {
  if (!isObjectId(body.recetteId)) return refuse('recetteId invalide')
  if (typeof body.notCounted !== 'boolean') return refuse('notCounted attendu : true ou false')
  let closingCash: number | null = null
  if (body.notCounted) {
    if (body.closingCash !== null && body.closingCash !== undefined) return refuse('closingCash doit être null quand la caisse n’est pas comptée')
  } else {
    closingCash = parseClosingCash(body.closingCash)
    if (closingCash === null) return refuse('closingCash invalide : de 0 à 1000000')
  }
  if (typeof body.expectedCash !== 'number' || !Number.isFinite(body.expectedCash)) return refuse('expectedCash invalide')
  if (body.notes !== undefined && body.notes !== null && typeof body.notes !== 'string') return refuse('notes invalide')
  return {
    ok: true,
    value: {
      recetteId: body.recetteId,
      closingCash,
      expectedCash: body.expectedCash,
      notes: typeof body.notes === 'string' ? body.notes.trim().slice(0, 500) : '',
    },
  }
}

/** Les chiffres vus par l'app ne sont plus ceux du serveur : plus de 0,005 DT d'écart (en millimes entiers). */
export const figuresChanged = (clientCash: number, serverCash: number) =>
  Math.round(Math.abs(clientCash - serverCash) * 1000) > 5

// ── La recette ouverte ─────────────────────────────────────────

/** Une commande dans ces états bloque la clôture ; `ready` n'en fait pas partie (voir `readyCount`). */
export const BLOCKING_STATUSES = ['pending', 'confirmed', 'preparing'] as const
/** Plus de commandes que cela : la liste est coupée, `count` dit le vrai nombre. */
export const BLOCKERS_LISTED = 50

export interface Blockers {
  count: number
  orders: { orderNumber: string; status: string }[]
}

export function blockersOf(orders: { orderNumber?: unknown; status?: unknown }[], count = orders.length): Blockers {
  return {
    count,
    orders: orders
      .slice(0, BLOCKERS_LISTED)
      .map((o) => ({ orderNumber: String(o.orderNumber ?? ''), status: String(o.status ?? '') })),
  }
}

type DateLike = Date | string | number | null | undefined
const iso = (v: DateLike): string | null => {
  if (v === null || v === undefined || v === '') return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/** Un mouvement tel qu'il est stocké : tout ce qu'on lit, rien de plus. */
export interface MovementDoc {
  _id?: unknown
  kind?: string
  label?: string
  amount?: number
  note?: string
  employee?: { id?: unknown; name?: string } | null
  createdAt?: DateLike
  createdBy?: { name?: string } | null
  cancelledAt?: DateLike
  cancelledBy?: { name?: string } | null
}

export interface MovementView {
  id: string
  kind: string
  label: string
  amount: number
  note: string
  employee: { id: string; name: string } | null
  createdAt: string
  createdBy: string
  cancelledAt: string | null
  cancelledBy: string | null
}

export function movementOf(m: MovementDoc): MovementView {
  const cancelledAt = iso(m.cancelledAt)
  return {
    id: String(m._id),
    kind: String(m.kind ?? ''),
    label: String(m.label ?? ''),
    amount: round2(Number(m.amount) || 0),
    note: String(m.note ?? ''),
    employee: m.employee?.id ? { id: String(m.employee.id), name: String(m.employee.name ?? '') } : null,
    createdAt: iso(m.createdAt) ?? '',
    createdBy: String(m.createdBy?.name ?? ''),
    cancelledAt,
    cancelledBy: cancelledAt ? String(m.cancelledBy?.name ?? '') : null,
  }
}

export interface RecetteDoc {
  _id?: unknown
  number?: string
  openedAt?: DateLike
  openedBy?: { name?: string } | null
  openingFloat?: number
  mouvements?: MovementDoc[] | null
}

export interface RecetteView {
  id: string
  number: string
  openedAt: string
  openedBy: string
  openingFloat: number
  /** Ce que le tiroir doit contenir (lib/recette cashInDrawer), fond de caisse compris. */
  cashExpected: number
  movements: MovementView[]
  blockers: Blockers
  readyCount: number
}

export function recetteOf(
  doc: RecetteDoc,
  live: { cashExpected: number; blockers: Blockers; readyCount: number }
): RecetteView {
  return {
    id: String(doc._id),
    number: String(doc.number ?? ''),
    openedAt: iso(doc.openedAt) ?? '',
    openedBy: String(doc.openedBy?.name ?? ''),
    openingFloat: round2(Number(doc.openingFloat) || 0),
    cashExpected: round2(live.cashExpected),
    movements: (doc.mouvements ?? []).map(movementOf),
    blockers: live.blockers,
    readyCount: live.readyCount,
  }
}

export interface ClosedView {
  number: string
  closedAt: string
  closedBy: string
  closingCash: number | null
  cashExpected: number
  cashDifference: number | null
}

export function closedOf(
  doc: { number?: string; closedAt?: DateLike; closedBy?: { name?: string } | null; closingCash?: number | null },
  figures: { cashExpected: number; cashDifference: number | null }
): ClosedView {
  return {
    number: String(doc.number ?? ''),
    closedAt: iso(doc.closedAt) ?? '',
    closedBy: String(doc.closedBy?.name ?? ''),
    closingCash: typeof doc.closingCash === 'number' ? round2(doc.closingCash) : null,
    cashExpected: round2(figures.cashExpected),
    cashDifference: figures.cashDifference,
  }
}
