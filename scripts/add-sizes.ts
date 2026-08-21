/**
 * Mr. Burritos — Migration : tailles M / XL / XXL
 * Lance avec : npm run add-sizes
 *
 * Ajoute les suppléments « Taille M » (inclus) et « Taille XXL » (+8 DT) à côté
 * du « Taille XL » existant, puis rattache les trois tailles à tous les produits
 * des catégories Tacos et Burritos.
 *
 * Contrairement à `npm run seed`, ce script ne touche ni aux prix ni aux
 * descriptions des produits : il n'ajoute que les tailles manquantes.
 */

import 'dotenv/config'
import mongoose from 'mongoose'
import { connectDB } from '../lib/mongodb'
import { Category } from '../lib/models/Category'
import { Product } from '../lib/models/Product'
import { Supplement } from '../lib/models/Supplement'

const SIZES = [
  { fr: 'Taille M',   ar: 'حجم M',   price: 0   },
  { fr: 'Taille XL',  ar: 'حجم XL',  price: 4.5 },
  { fr: 'Taille XXL', ar: 'حجم XXL', price: 8   },
]

const SIZED_CATEGORIES = ['tacos', 'burritos']

async function main() {
  await connectDB()

  console.log('📐 Tailles...')
  const sizeIds: mongoose.Types.ObjectId[] = []
  for (const s of SIZES) {
    const doc = await Supplement.findOneAndUpdate(
      { 'name.fr': s.fr },
      { $set: { name: { fr: s.fr, ar: s.ar }, price: s.price, type: 'size', isActive: true } },
      { upsert: true, new: true }
    )
    sizeIds.push(doc._id)
    console.log(`   ✓ ${s.fr.padEnd(12)} ${s.price > 0 ? `+${s.price} DT` : 'inclus'}`)
  }

  const categories = await Category.find({ slug: { $in: SIZED_CATEGORIES } }).select('_id slug')
  if (categories.length === 0) {
    console.log('\n⚠️  Aucune catégorie Tacos/Burritos trouvée — aucun produit mis à jour.')
    await mongoose.disconnect()
    return
  }

  console.log('\n🌯 Produits...')
  const products = await Product.find({ category: { $in: categories.map((c) => c._id) } })
  for (const p of products) {
    // $addToSet garde les sauces et extras déjà configurés par l'admin.
    await Product.updateOne({ _id: p._id }, { $addToSet: { supplements: { $each: sizeIds } } })
    console.log(`   ✓ ${p.name.fr}`)
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Migration terminée
   Tailles   : ${SIZES.length} (M, XL, XXL)
   Produits  : ${products.length} mis à jour
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`)

  await mongoose.disconnect()
}

main().catch((err) => {
  console.error('❌ Migration échouée :', err)
  process.exit(1)
})
