/**
 * Mr. Burritos — Migration : composeur de produits (home page)
 * Lance avec : npm run setup-builder
 *
 * La home page ne vend plus des plats nommés (« Tacos Crispy ») mais une
 * catégorie que le client compose lui-même : taille → viandes → sauces →
 * extras. Ce script met en place les données nécessaires :
 *
 *  1. Les viandes (type « viande », gratuites) — l'image de chacune est reprise
 *     du plat correspondant, pour que l'étape « viandes » soit illustrée.
 *  2. Le nombre de viandes par taille : M 1, XL 2 (double), XXL 3 (triple).
 *  3. Un produit de base par catégorie composable (« Tacos », « Burrito »),
 *     marqué isBase pour rester hors de la grille du menu.
 *
 * Idempotent : relançable sans risque. Ne touche ni aux plats existants ni aux
 * prix déjà configurés en backoffice.
 */

import 'dotenv/config'
import mongoose from 'mongoose'
import { connectDB } from '../lib/mongodb'
import { Category } from '../lib/models/Category'
import { Product } from '../lib/models/Product'
import { Supplement } from '../lib/models/Supplement'

/** Viandes, chacune illustrée par le plat dont elle est tirée. */
const VIANDES = [
  { fr: 'Escalope panée',   ar: 'إسكالوب مقلي',  imageFrom: 'Tacos Crispy' },
  { fr: 'Escalope grillée', ar: 'إسكالوب مشوية', imageFrom: 'Tacos Spicy Chicken' },
  { fr: 'Cordon Bleu',      ar: 'كوردون بلو',     imageFrom: 'Tacos Cordon Bleu' },
  { fr: 'Nuggets',          ar: 'نوجيتس',         imageFrom: 'Tacos Nuggettes' },
  { fr: 'Viande hachée',    ar: 'لحم مفروم',      imageFrom: 'Tacos Beef' },
]

/** Combien de viandes chaque taille donne droit. */
const MEAT_COUNTS: Record<string, number> = {
  'Taille M': 1,
  'Taille XL': 2,
  'Taille XXL': 3,
}

/** Catégories composables et leur produit de base. */
const BASES = [
  {
    slug: 'tacos',
    fr: 'Tacos', ar: 'تاكوس',
    price: 10.9,
    descFr: 'Sauce fromagère, garniture, frites — composez le vôtre',
    descAr: 'صوص فروماجير، حشوة، بطاطس — كوّن التاكوس ديالك',
    imageFrom: 'Tacos Crispy',
  },
  {
    slug: 'burritos',
    fr: 'Burrito', ar: 'بوريتو',
    price: 11.9,
    descFr: 'Riz, maïs, sauce burrito, poivron, frites, sauce fromagère',
    descAr: 'أرز، ذرة، صوص بوريتو، فلفل، بطاطس، صوص فروماجير',
    imageFrom: 'Burrito Crispy',
  },
]

async function main() {
  await connectDB()

  // Réutilise les visuels déjà en ligne plutôt que d'en réclamer de nouveaux.
  const named = await Product.find({ isBase: { $ne: true } }).select('name image')
  const imageOf = (fr: string): string =>
    named.find((p) => p.name.fr === fr)?.image ?? ''

  // ── 1. Viandes ────────────────────────────────────────────────────────────
  console.log('🥩 Viandes...')
  const vianteIds: mongoose.Types.ObjectId[] = []
  for (const v of VIANDES) {
    const doc = await Supplement.findOneAndUpdate(
      { 'name.fr': v.fr },
      { $set: { name: { fr: v.fr, ar: v.ar }, price: 0, type: 'viande', image: imageOf(v.imageFrom), isActive: true } },
      { upsert: true, returnDocument: 'after' }
    )
    vianteIds.push(doc._id)
    console.log(`   ✓ ${v.fr.padEnd(18)} ${doc.image ? 'illustrée' : 'sans image'}`)
  }

  // ── 2. Nombre de viandes par taille ───────────────────────────────────────
  console.log('\n📐 Tailles...')
  for (const [fr, meatCount] of Object.entries(MEAT_COUNTS)) {
    const res = await Supplement.updateOne({ 'name.fr': fr, type: 'size' }, { $set: { meatCount } })
    const label = meatCount === 1 ? 'simple' : meatCount === 2 ? 'double' : 'triple'
    console.log(`   ${res.matchedCount ? '✓' : '⚠'} ${fr.padEnd(12)} ${meatCount} viande(s) — ${label}`)
  }

  // ── 3. Produits de base ───────────────────────────────────────────────────
  console.log('\n🌯 Produits de base...')
  const sauces = await Supplement.find({ type: 'sauce' }).select('_id')
  const sizes = await Supplement.find({ type: 'size' }).select('_id')
  const extras = await Supplement.find({ type: 'extra' }).select('_id')
  const composable = [...sizes.map((s) => s._id), ...vianteIds, ...sauces.map((s) => s._id), ...extras.map((s) => s._id)]

  for (const b of BASES) {
    const cat = await Category.findOne({ slug: b.slug }).select('_id')
    if (!cat) {
      console.log(`   ⚠ Catégorie « ${b.slug} » introuvable — ignorée`)
      continue
    }
    // Le prix n'est posé qu'à la création : un prix ajusté en backoffice survit
    // à une relance du script.
    await Product.findOneAndUpdate(
      { 'name.fr': b.fr, isBase: true },
      {
        $set: {
          name: { fr: b.fr, ar: b.ar },
          description: { fr: b.descFr, ar: b.descAr },
          category: cat._id,
          supplements: composable,
          image: imageOf(b.imageFrom),
          isBase: true,
          isAvailable: true,
          isActive: true,
        },
        $setOnInsert: { price: b.price },
      },
      { upsert: true, returnDocument: 'after' }
    )
    console.log(`   ✓ ${b.fr.padEnd(10)} — ${composable.length} options`)
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Composeur prêt
   Viandes         : ${VIANDES.length}
   Tailles         : M 1 · XL 2 · XXL 3 viandes
   Produits de base: ${BASES.length} (Tacos, Burrito)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`)

  await mongoose.disconnect()
}

main().catch((err) => {
  console.error('❌ Migration échouée :', err)
  process.exit(1)
})
