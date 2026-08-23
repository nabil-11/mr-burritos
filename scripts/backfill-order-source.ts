/**
 * Mr. Burritos — Origine des anciennes commandes
 * Lance avec : npm run backfill-order-source            (simulation)
 *              npm run backfill-order-source -- --write (écriture)
 *
 * Les commandes créées avant le champ `source` n'en portent aucun : elles
 * s'affichent « Origine inconnue » partout, ce qui est honnête mais peu utile
 * sur un historique entier.
 *
 * Ce script devine l'origine à partir du téléphone client, seul indice
 * disponible : le site exige un numéro à 8 chiffres, la caisse et la borne
 * enregistrent « — ». La borne et la caisse restent indiscernables entre elles,
 * donc tout ce qui vient du magasin est marqué `counter`.
 *
 * C'est une heuristique, jamais une certitude : elle ne touche que les
 * commandes SANS source, et ne réécrit donc jamais une origine réelle.
 */

import 'dotenv/config'
import mongoose from 'mongoose'
import { connectDB } from '../lib/mongodb'
import { Order } from '../lib/models/Order'

const write = process.argv.includes('--write')

async function main() {
  await connectDB()

  const noSource = { $or: [{ source: { $exists: false } }, { source: { $in: [null, ''] } }] }
  // Un numéro qui contient au moins un chiffre est un vrai client : le site est
  // la seule origine qui en réclame un.
  const hasRealPhone = { 'customer.phone': { $regex: '[0-9]' } }

  const total = await Order.countDocuments(noSource)

  const webFilter = { $and: [noSource, hasRealPhone] }
  const counterFilter = { $and: [noSource, { $nor: [hasRealPhone] }] }

  const [web, counter] = await Promise.all([
    Order.countDocuments(webFilter),
    Order.countDocuments(counterFilter),
  ])

  console.log(`📦 Commandes sans origine : ${total}`)
  console.log(`   → site web (téléphone client) : ${web}`)
  console.log(`   → caisse / borne (« — »)      : ${counter}`)

  if (!write) {
    console.log('\n🔎 Simulation — rien n\'a été écrit. Relance avec --write pour appliquer.')
  } else {
    const [w, c] = await Promise.all([
      Order.updateMany(webFilter, { $set: { source: 'website' } }),
      Order.updateMany(counterFilter, { $set: { source: 'counter' } }),
    ])
    console.log(`\n✅ Mises à jour : ${w.modifiedCount} site web, ${c.modifiedCount} caisse.`)
  }

  await mongoose.disconnect()
}

main().catch((err) => {
  console.error('❌ Erreur backfill :', err)
  process.exit(1)
})
