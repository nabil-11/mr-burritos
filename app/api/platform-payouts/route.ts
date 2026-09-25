import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { connectDB } from '@/lib/mongodb'
import { Order } from '@/lib/models/Order'
import { PlatformPayout } from '@/lib/models/PlatformPayout'
import { DeliveryCompany } from '@/lib/models/DeliveryCompany'
import { requireAuth } from '@/lib/auth'
import { callerFrom } from '@/lib/caisseCaller'
import {
  ageInDays,
  commissionOf,
  companyOf,
  isPaid,
  isPayoutMethod,
  receivableOf,
  type PlatformOrderLike,
} from '@/lib/platformSettlement'

/**
 * Les créances plateformes et les versements qui les soldent.
 *
 * Deux échelles de temps se croisent ici, et les confondre est l'erreur à ne
 * pas commettre :
 *
 *   — **Ce qui est dû n'a pas de période.** Une commande Glovo de mardi dernier
 *     jamais réglée reste due aujourd'hui. Les créances sont donc comptées sur
 *     toute l'histoire, filtre de dates ou non : une facture oubliée doit
 *     rester visible même quand on regarde la semaine en cours.
 *   — **Ce qui a été reçu porte une date.** Les versements, eux, se lisent sur
 *     la période choisie : c'est le relevé du mois qu'on vient rapprocher.
 *
 * Le calcul n'est pas fait par Mongo mais par lib/platformSettlement, sur les
 * commandes chargées. Une créance dépend du mode de règlement, de la plateforme
 * et du type de commande : la même règle sert au tiroir de la caisse et aux
 * factures, et deux écritures de cette règle finiraient par diverger.
 */

/** Le balayage des créances. Au-delà, la réponse le dit plutôt que de mentir. */
const MAX_SCAN = 5000
/** Ce qu'un tableau affiche d'un coup. */
const MAX_LIST = 300

const round2 = (n: number) => Math.round(n * 100) / 100
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

type OrderDoc = PlatformOrderLike & {
  _id: unknown
  orderNumber?: string
  reference?: string
  createdAt?: Date
  customer?: { name?: string }
}

/**
 * Le filtre Mongo des commandes susceptibles d'être une créance : une
 * plateforme nommée, non annulée, et pas d'argent déjà encaissé au comptoir.
 * `receivableOf` retranche ensuite le reste — c'est lui qui a le dernier mot.
 */
const RECEIVABLE_QUERY = {
  status: { $ne: 'cancelled' },
  'deliveryCompany.name': { $nin: ['', null] },
  // Un champ absent vaut null : une commande dont la caisse n'a rien noté passe
  // bien ce filtre, et c'est voulu — la plateforme la doit quand même.
  'payment.method': { $nin: ['cash', 'card'] },
} as const

const PROJECTION =
  'orderNumber total type status source payment deliveryCompany reference createdAt customer.name'

function flattenOrder(o: OrderDoc) {
  return {
    id: String(o._id),
    orderNumber: o.orderNumber ?? '',
    reference: o.reference ?? '',
    company: companyOf(o),
    customer: o.customer?.name ?? '',
    gross: round2(o.total || 0),
    commission: commissionOf(o),
    net: receivableOf(o),
    rate: o.deliveryCompany?.commission ?? 0,
    paid: isPaid(o),
    paidAt: o.deliveryCompany?.paidAt ? new Date(o.deliveryCompany.paidAt).toISOString() : null,
    payoutRef: o.deliveryCompany?.payoutRef ?? '',
    createdAt: o.createdAt ? new Date(o.createdAt).toISOString() : null,
    days: ageInDays(o.createdAt),
    status: o.status ?? '',
    source: o.source ?? '',
  }
}

export type SettlementOrder = ReturnType<typeof flattenOrder>

interface CompanyRow {
  name: string
  companyId: string | null
  rate: number | null
  unpaid: { count: number; gross: number; commission: number; net: number }
  paid: { count: number; net: number }
  /** La plus ancienne créance non réglée, et son âge en jours. */
  oldest: string | null
  days: number
}

export async function GET(req: NextRequest) {
  try {
    await connectDB()
    const { searchParams } = new URL(req.url)
    const company = text(searchParams.get('company'), 60)
    const status = searchParams.get('status') === 'paid' ? 'paid' : 'unpaid'
    const asDate = (raw: string | null) => {
      if (!raw) return null
      const d = new Date(raw)
      return Number.isNaN(d.getTime()) ? null : d
    }
    const period = { from: asDate(searchParams.get('from')), to: asDate(searchParams.get('to')) }
    const inPeriod = (at: Date | null) => {
      if (!period.from && !period.to) return true
      if (!at) return false
      const t = at.getTime()
      if (period.from && t < period.from.getTime()) return false
      if (period.to && t > period.to.getTime()) return false
      return true
    }

    const query: Record<string, unknown> = { ...RECEIVABLE_QUERY }
    if (company) query['deliveryCompany.name'] = company

    const [docs, companies, payoutDocs] = await Promise.all([
      Order.find(query, PROJECTION).sort({ createdAt: -1 }).limit(MAX_SCAN).lean() as Promise<OrderDoc[]>,
      DeliveryCompany.find({}, 'name commission isActive').sort({ name: 1 }).lean() as Promise<
        { _id: unknown; name?: string; commission?: number; isActive?: boolean }[]
      >,
      PlatformPayout.find({
        ...(company ? { 'company.name': company } : {}),
        ...(period.from || period.to
          ? {
              createdAt: {
                ...(period.from ? { $gte: period.from } : {}),
                ...(period.to ? { $lte: period.to } : {}),
              },
            }
          : {}),
      })
        .sort({ createdAt: -1 })
        .limit(MAX_LIST)
        .lean() as Promise<Record<string, unknown>[]>,
    ])

    // Une ligne par plateforme. Les sociétés sans créance figurent quand même :
    // « Presto, rien à recevoir » est une information ; une ligne absente, non.
    const rows = new Map<string, CompanyRow>()
    const rowFor = (name: string): CompanyRow => {
      const found = rows.get(name)
      if (found) return found
      const known = companies.find((c) => (c.name ?? '').trim() === name)
      const row: CompanyRow = {
        name,
        companyId: known ? String(known._id) : null,
        rate: typeof known?.commission === 'number' ? known.commission : null,
        unpaid: { count: 0, gross: 0, commission: 0, net: 0 },
        paid: { count: 0, net: 0 },
        oldest: null,
        days: 0,
      }
      rows.set(name, row)
      return row
    }
    for (const c of companies) {
      const name = (c.name ?? '').trim()
      if (name && (!company || name === company)) rowFor(name)
    }

    const unpaidList: SettlementOrder[] = []
    const paidList: SettlementOrder[] = []
    let scanned = 0
    for (const doc of docs) {
      if (receivableOf(doc) <= 0) continue
      scanned++
      const flat = flattenOrder(doc)
      const row = rowFor(flat.company)
      if (flat.paid) {
        // Un règlement pointé appartient à la période où il est arrivé, pas à
        // celle où la commande a été prise : c'est le relevé qu'on rapproche.
        if (inPeriod(flat.paidAt ? new Date(flat.paidAt) : null)) {
          row.paid.count++
          row.paid.net = round2(row.paid.net + flat.net)
          paidList.push(flat)
        }
      } else {
        row.unpaid.count++
        row.unpaid.gross = round2(row.unpaid.gross + flat.gross)
        row.unpaid.commission = round2(row.unpaid.commission + flat.commission)
        row.unpaid.net = round2(row.unpaid.net + flat.net)
        // La liste vient du plus récent au plus ancien : la dernière vue est la
        // plus vieille, donc celle qui attend depuis le plus longtemps.
        row.oldest = flat.createdAt
        row.days = flat.days
        unpaidList.push(flat)
      }
    }

    const ordered = [...rows.values()].sort(
      (a, b) => b.unpaid.net - a.unpaid.net || a.name.localeCompare(b.name)
    )
    const payouts = payoutDocs.map((p) => {
      const c = (p.company ?? {}) as { name?: string }
      return {
        id: String(p._id),
        company: c.name ?? '',
        amount: round2(Number(p.amount) || 0),
        expected: round2(Number(p.expected) || 0),
        gap: round2(Number(p.gap) || 0),
        orderCount: Number(p.orderCount) || 0,
        from: p.from ? new Date(p.from as Date).toISOString() : null,
        to: p.to ? new Date(p.to as Date).toISOString() : null,
        method: String(p.method ?? 'transfer'),
        reference: String(p.reference ?? ''),
        note: String(p.note ?? ''),
        recordedBy: String(p.recordedBy ?? ''),
        createdAt: p.createdAt ? new Date(p.createdAt as Date).toISOString() : null,
      }
    })

    return NextResponse.json({
      period: { from: period.from?.toISOString() ?? null, to: period.to?.toISOString() ?? null },
      companies: ordered,
      totals: {
        unpaidCount: ordered.reduce((s, c) => s + c.unpaid.count, 0),
        unpaidNet: round2(ordered.reduce((s, c) => s + c.unpaid.net, 0)),
        paidCount: ordered.reduce((s, c) => s + c.paid.count, 0),
        paidNet: round2(ordered.reduce((s, c) => s + c.paid.net, 0)),
        /** L'âge de la créance la plus ancienne, toutes plateformes confondues. */
        oldestDays: ordered.reduce((s, c) => Math.max(s, c.days), 0),
        payoutsCount: payouts.length,
        payoutsAmount: round2(payouts.reduce((s, p) => s + p.amount, 0)),
      },
      orders: (status === 'paid' ? paidList : unpaidList).slice(0, MAX_LIST),
      /** Vrai quand le balayage a été tronqué : les totaux sont alors partiels. */
      truncated: docs.length >= MAX_SCAN,
      scanned,
      payouts,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur serveur'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/**
 * POST — pointer des commandes comme réglées, ou revenir en arrière.
 *
 * Deux façons de désigner les commandes, parce que deux gestes réels :
 *
 *   — `orderIds` : ce que produisent les cases cochées d'un tableau, jusqu'à la
 *     commande unique qu'on rattrape à la main ;
 *   — `company` (+ `until`) : « Glovo a viré 500 DT, solde tout jusqu'à
 *     dimanche ». Personne ne cochera quarante-huit lignes.
 *
 * Un montant (`amount`) crée en plus une trace : ce qui était attendu, ce qui
 * est arrivé, et l'écart entre les deux. Sans montant, le pointage reste un
 * simple drapeau — le geste de correction d'une ligne, qui n'a pas à inventer
 * un virement.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = requireAuth(req)
    await connectDB()
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
    if (!body) return NextResponse.json({ error: 'Requête illisible' }, { status: 400 })

    const paid = body.paid !== false
    const company = text(body.company, 60)
    const ids = Array.isArray(body.orderIds)
      ? body.orderIds.map((v) => String(v)).filter((v) => mongoose.isValidObjectId(v))
      : []
    const untilRaw = text(body.until, 40)
    const until = untilRaw ? new Date(untilRaw) : null

    const query: Record<string, unknown> = { ...RECEIVABLE_QUERY }
    if (ids.length) query._id = { $in: ids }
    else if (company) {
      query['deliveryCompany.name'] = company
      // Pointer, c'est solder ce qui est dû : une commande déjà réglée n'a pas à
      // être touchée deux fois, ni à gonfler l'attendu d'un versement.
      query['deliveryCompany.paid'] = paid ? { $ne: true } : true
      if (until && !Number.isNaN(until.getTime())) query.createdAt = { $lte: until }
    } else {
      return NextResponse.json(
        { error: 'Précisez les commandes à pointer, ou la plateforme' },
        { status: 400 }
      )
    }

    const docs = (await Order.find(query, PROJECTION).lean()) as OrderDoc[]
    const targets = docs.filter((o) => receivableOf(o) > 0 && isPaid(o) !== paid)
    if (targets.length === 0) {
      return NextResponse.json(
        {
          error: paid
            ? 'Aucune commande à pointer — tout est déjà réglé'
            : 'Aucune commande à dépointer',
        },
        { status: 409 }
      )
    }
    // Une seule plateforme par versement : additionner Glovo et Presto dans un
    // même virement rendrait l'écart illisible.
    const names = [...new Set(targets.map((o) => companyOf(o)))]
    if (paid && names.length > 1) {
      return NextResponse.json(
        { error: `Un versement par plateforme — ${names.join(', ')} sont mélangées` },
        { status: 400 }
      )
    }

    const expected = round2(targets.reduce((s, o) => s + receivableOf(o), 0))
    const dates = targets
      .map((o) => (o.createdAt ? new Date(o.createdAt).getTime() : null))
      .filter((t): t is number => t !== null)
    const caller = callerFrom(req, body.userName)
    const by = caller.name || auth.email
    const reference = text(body.reference, 80)

    let payout: { _id: unknown; amount: number; gap: number } | null = null
    const amount = num(body.amount)
    if (paid && amount !== null) {
      const received = round2(Math.max(0, amount))
      const created = await PlatformPayout.create({
        company: {
          companyId: targets[0]?.deliveryCompany?.companyId ?? null,
          name: names[0] ?? company,
        },
        amount: received,
        expected,
        gap: round2(received - expected),
        orderCount: targets.length,
        from: dates.length ? new Date(Math.min(...dates)) : null,
        to: dates.length ? new Date(Math.max(...dates)) : null,
        method: isPayoutMethod(body.method) ? body.method : 'transfer',
        reference,
        note: text(body.note, 300),
        recordedBy: by,
      })
      payout = created.toObject()
    }

    const stamp = paid
      ? {
          'deliveryCompany.paid': true,
          'deliveryCompany.paidAt': new Date(),
          'deliveryCompany.paidBy': by,
          'deliveryCompany.payout': payout?._id ?? null,
          'deliveryCompany.payoutRef': reference || (payout ? `Versement ${names[0] ?? company}` : ''),
        }
      : {
          'deliveryCompany.paid': false,
          'deliveryCompany.paidAt': null,
          'deliveryCompany.paidBy': '',
          'deliveryCompany.payout': null,
          'deliveryCompany.payoutRef': '',
        }
    await Order.updateMany({ _id: { $in: targets.map((o) => o._id) } }, { $set: stamp })

    return NextResponse.json({
      count: targets.length,
      company: names[0] ?? company,
      expected,
      amount: payout ? payout.amount : null,
      gap: payout ? payout.gap : null,
      payoutId: payout ? String(payout._id) : null,
      paid,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur serveur'
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 })
  }
}
