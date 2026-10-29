/**
 * Mr. Burritos — pose les prix barrés de lib/commerce (COMPARE_AT_PRICES).
 * Lance avec : npm run compare-prices
 *
 * Ne touche qu'au champ `compareAtPrice` des produits nommés, retrouvés par
 * leur nom exact. Idempotent : relancé, il réécrit les mêmes valeurs. Un
 * produit absent de la carte est signalé, jamais créé. Ensuite, chaque prix
 * barré se règle dans le back-office (fiche produit → « Prix barré »).
 *
 * Attention : la base visée est celle de MONGO_URL (.env), donc la production
 * si rien d'autre n'est précisé.
 */

import 'dotenv/config'
import mongoose from 'mongoose'
import { connectDB } from '../lib/mongodb'
import { Product } from '../lib/models/Product'
import { COMPARE_AT_PRICES } from '../lib/commerce'

async function main() {
  await connectDB()
  for (const [name, compareAtPrice] of Object.entries(COMPARE_AT_PRICES)) {
    const doc = (await Product.findOne({ 'name.fr': name, isActive: true }).select('price').lean()) as {
      price?: number
    } | null
    if (!doc) {
      console.log(`   ✗ ${name.padEnd(28)} introuvable sur la carte`)
      continue
    }
    if ((doc.price ?? 0) >= compareAtPrice) {
      console.log(`   ! ${name.padEnd(28)} prix ${doc.price} DT ≥ prix barré ${compareAtPrice} DT : rien ne s'affichera`)
    }
    await Product.updateOne({ 'name.fr': name, isActive: true }, { $set: { compareAtPrice } })
    console.log(`   ✓ ${name.padEnd(28)} ${doc.price} DT au lieu de ${compareAtPrice} DT`)
  }
  await mongoose.disconnect()
}

main().catch((err) => {
  console.error('❌ Échec :', err)
  process.exit(1)
})
