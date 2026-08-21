/**
 * Mr. Burritos — Migration : nouvelle carte (panneaux 2026)
 * Lance avec : npm run upgrade-menu
 *
 * Aligne la base sur les trois panneaux du restaurant :
 *
 *  1. Tacos   — M 11 · XL 16 · XXL 19 DT (1 / 2 / 3 viandes)
 *  2. Burrito — M 12 · XL 16 · XXL 19 DT (1 / 2 / 3 viandes)
 *  3. Six viandes, cinq sauces offertes, dix suppléments payants
 *  4. Nouvelles familles : Burgers, Bowls, Time Healthy
 *  5. Snacks à 6.5 DT, Box Duo / Chilla / Famille, boissons
 *
 * Les tailles ne coûtent plus le même supplément dans les deux familles
 * (Tacos +5 / +8, Burrito +4 / +7) : chaque famille composable a donc désormais
 * son propre jeu de tailles, nommé « Taille XL (Tacos) », « Taille XL (Burrito) ».
 *
 * Idempotent. Ne supprime rien : ce qui quitte la carte est simplement
 * désactivé, pour que les commandes déjà passées gardent leurs références.
 * Les visuels déjà en ligne sont conservés — les articles renommés gardent le leur.
 */

import 'dotenv/config'
import mongoose from 'mongoose'
import { connectDB } from '../lib/mongodb'
import { Category } from '../lib/models/Category'
import { Product } from '../lib/models/Product'
import { Supplement } from '../lib/models/Supplement'

type Id = mongoose.Types.ObjectId

// ─── Catégories ──────────────────────────────────────────────────────────────
const CATEGORIES = [
  { slug: 'tacos',    fr: 'Tacos',        ar: 'تاكوس',      order: 1 },
  { slug: 'burritos', fr: 'Burritos',     ar: 'بوريتوس',    order: 2 },
  { slug: 'burgers',  fr: 'Burgers',      ar: 'برغر',        order: 3 },
  { slug: 'bowls',    fr: 'Bowls',        ar: 'بول',         order: 4 },
  { slug: 'healthy',  fr: 'Time Healthy', ar: 'تايم هيلثي', order: 5 },
  { slug: 'snacks',   fr: 'Snacks',       ar: 'سناكس',      order: 6 },
  { slug: 'boxes',    fr: 'Boxes',        ar: 'بوكس',        order: 7 },
  { slug: 'boissons', fr: 'Boissons',     ar: 'مشروبات',    order: 8 },
]

// ─── Renommages ──────────────────────────────────────────────────────────────
// La carte rebaptise des articles qui existent déjà. Les renommer plutôt que
// d'en créer de nouveaux préserve leur photo et leur historique.
const SUPPLEMENT_RENAMES = [
  { from: 'Escalope panée',   to: 'Chicken Crispy',   type: 'viande' },
  { from: 'Escalope grillée', to: 'Spicy Chicken',    type: 'viande' },
  { from: 'Nuggets',          to: 'Crispy',           type: 'viande' },
  { from: 'Mozzarella',       to: 'Mozzarella fondu', type: 'extra'  },
]

const PRODUCT_RENAMES = [
  { from: 'Poppers Box',                  to: 'Boulette de fromage (6 pièces)' },
  { from: 'Nuggets Box 6 pièces',         to: 'Nuggets (6 pièces)'             },
  { from: 'Chicken Fingers Box 8 pièces', to: 'Chicken Finger (8 pièces)'      },
  { from: 'Canette (24 cl)',              to: 'Soda Canette'                   },
  { from: 'Box Hob',                      to: 'Box Duo'                        },
]

// ─── Suppléments ─────────────────────────────────────────────────────────────
/** Sauces offertes — « SAUCES AUX CHOIX » du panneau Burrito. */
const SAUCES = [
  { fr: 'Olive',         ar: 'زيتون'      },
  { fr: 'Spicy Sauce',   ar: 'صوص حار'    },
  { fr: 'Sauce Burrito', ar: 'صوص بوريتو' },
  { fr: 'Mayonnaise',    ar: 'مايونيز'    },
  { fr: 'BBQ',           ar: 'BBQ'        },
]

/**
 * Tailles, par famille. Le prix reste l'écart avec la taille M, elle-même prix
 * de base du produit composable : Tacos 11 → 16 → 19, Burrito 12 → 16 → 19.
 */
const SIZES = [
  { slug: 'tacos',    fr: 'Taille M (Tacos)',     ar: 'حجم M (تاكوس)',    price: 0, meatCount: 1 },
  { slug: 'tacos',    fr: 'Taille XL (Tacos)',    ar: 'حجم XL (تاكوس)',   price: 5, meatCount: 2 },
  { slug: 'tacos',    fr: 'Taille XXL (Tacos)',   ar: 'حجم XXL (تاكوس)',  price: 8, meatCount: 3 },
  { slug: 'burritos', fr: 'Taille M (Burrito)',   ar: 'حجم M (بوريتو)',   price: 0, meatCount: 1 },
  { slug: 'burritos', fr: 'Taille XL (Burrito)',  ar: 'حجم XL (بوريتو)',  price: 4, meatCount: 2 },
  { slug: 'burritos', fr: 'Taille XXL (Burrito)', ar: 'حجم XXL (بوريتو)', price: 7, meatCount: 3 },
]

/** Les six viandes du panneau « CHOISIS TA VIANDE ». */
const VIANDES = [
  { fr: 'Crispy',              ar: 'كريسبي',       imageFrom: 'Tacos Nuggettes'                },
  { fr: 'Spicy Chicken',       ar: 'سبايسي تشيكن', imageFrom: 'Tacos Spicy Chicken'            },
  { fr: 'Cordon Bleu',         ar: 'كوردون بلو',   imageFrom: 'Tacos Cordon Bleu'              },
  { fr: 'Chicken Crispy',      ar: 'تشيكن كريسبي', imageFrom: 'Tacos Crispy'                   },
  { fr: 'Boulette de fromage', ar: 'بولات جبنة',   imageFrom: 'Boulette de fromage (6 pièces)' },
  { fr: 'Viande hachée',       ar: 'لحم مفروم',    imageFrom: 'Tacos Beef'                     },
]

/** Suppléments payants — panneaux « SUPPLÉMENTS » (Burrito et Burger). */
const EXTRAS = [
  { fr: 'Fromage Slice',           ar: 'جبنة شريحة',           price: 1   },
  { fr: 'Oeuf',                    ar: 'بيض',                  price: 1   },
  { fr: 'Nachos',                  ar: 'ناتشوز',               price: 2   },
  { fr: 'Fromage Gruyère',         ar: 'جبنة غرويير',          price: 2.5 },
  { fr: 'Frites',                  ar: 'بطاطس',                price: 2.5 },
  { fr: 'Fromage Raclette',        ar: 'جبنة راكليت',          price: 3   },
  { fr: 'Mozzarella fondu',        ar: 'موزاريلا ذائبة',       price: 3   },
  { fr: 'Bacon',                   ar: 'بيكون',                price: 3.5 },
  { fr: 'Portion viande au choix', ar: 'حصة لحم حسب الاختيار', price: 4   },
  { fr: 'Guacamole',               ar: 'غواكامولي',            price: 5   },
]

// ─── Produits composables ────────────────────────────────────────────────────
const BASES = [
  {
    slug: 'tacos', fr: 'Tacos', ar: 'تاكوس', price: 11,
    descFr: 'Garni de frites et de notre sauce fromagère unique Mr Burritos',
    descAr: 'محشو بالبطاطس وصوص الجبن الخاص بـ Mr Burritos',
    imageFrom: 'Tacos Crispy',
  },
  {
    slug: 'burritos', fr: 'Burrito', ar: 'بوريتو', price: 12,
    descFr: 'Garni de maïs, haricots, riz, salade fraîche, mozzarella et sauce fromagère, avec portion de frites',
    descAr: 'محشو بالذرة والفاصولياء والأرز وسلطة طازجة وموزاريلا وصوص الجبن، مع حصة بطاطس',
    imageFrom: 'Burrito Crispy',
  },
]

// ─── Plats à la carte ────────────────────────────────────────────────────────
/** `options` dit quels groupes de suppléments le plat accepte. */
interface Dish {
  slug: string
  fr: string
  ar: string
  price: number
  descFr: string
  descAr: string
  options: ('sauce' | 'extra')[]
}

const DISHES: Dish[] = [
  // ── BURGERS ───────────────────────────────────────────────────────────────
  {
    slug: 'burgers', fr: 'Crispy Burger Simple', ar: 'كريسبي برغر سيمبل', price: 12.5,
    descFr: 'Blanc de poulet pané, laitue, tomate, oignon, sauce burger (portion frites)',
    descAr: 'صدر دجاج مقلي، خس، طماطم، بصل، صوص برغر (حصة بطاطس)',
    options: ['sauce', 'extra'],
  },
  {
    slug: 'burgers', fr: 'Burger Cheese Bacon', ar: 'برغر تشيز بيكون', price: 15.2,
    descFr: '100 g de viande hachée, bacon, oignons, tomates, sauce burger, fromage cheddar (portion frites)',
    descAr: '100 غ لحم مفروم، بيكون، بصل، طماطم، صوص برغر، جبنة شيدر (حصة بطاطس)',
    options: ['sauce', 'extra'],
  },
  {
    slug: 'burgers', fr: 'Double Crispy Burger', ar: 'دابل كريسبي برغر', price: 15.8,
    descFr: '2 blancs de poulet panés, laitue, tomate, oignon, sauce spicy, fromage cheddar (portion frites)',
    descAr: 'صدرا دجاج مقليان، خس، طماطم، بصل، صوص حار، جبنة شيدر (حصة بطاطس)',
    options: ['sauce', 'extra'],
  },
  {
    slug: 'burgers', fr: 'Burger Big Beef', ar: 'برغر بيغ بيف', price: 16.8,
    descFr: 'Double beef, double cheese, laitue, tomate, oignon, sauce burger (portion frites)',
    descAr: 'دابل بيف، دابل تشيز، خس، طماطم، بصل، صوص برغر (حصة بطاطس)',
    options: ['sauce', 'extra'],
  },

  // ── BOWLS ─────────────────────────────────────────────────────────────────
  {
    slug: 'bowls', fr: 'Ultimate Mix', ar: 'ألتيمت ميكس', price: 16.5,
    descFr: 'Frites, chips tortillas, mozzarella, sauce fromagère, double viande, sauce au choix',
    descAr: 'بطاطس، رقائق تورتيلا، موزاريلا، صوص الجبن، لحم مضاعف، صوص حسب الاختيار',
    options: ['sauce', 'extra'],
  },
  {
    slug: 'bowls', fr: 'Mexi Nachos', ar: 'ميكسي ناتشوز', price: 17,
    descFr: 'Nachos, sauce fromage, guacamole, crème sour, viande hachée, tomate, oignons et jalapeños',
    descAr: 'ناتشوز، صوص الجبن، غواكامولي، كريمة حامضة، لحم مفروم، طماطم، بصل وهالابينو',
    options: ['sauce', 'extra'],
  },

  // ── TIME HEALTHY ──────────────────────────────────────────────────────────
  {
    slug: 'healthy', fr: 'Healthy Burrito', ar: 'هيلثي بوريتو', price: 15.5,
    descFr: "100 g d'escalope grillée, riz, haricots, maïs, sauce burrito, garniture, œufs grillés, sauce fromage gruyère, avocat avec portion frites",
    descAr: '100 غ إسكالوب مشوية، أرز، فاصولياء، ذرة، صوص بوريتو، حشوة، بيض مشوي، صوص جبنة غرويير، أفوكادو مع حصة بطاطس',
    options: ['sauce', 'extra'],
  },
  {
    slug: 'healthy', fr: 'Burrito Bowl', ar: 'بوريتو بول', price: 15.9,
    descFr: 'Riz, haricots, maïs, salade fraîche, avocat, viande au choix et sauce fromagère — servi en bowl',
    descAr: 'أرز، فاصولياء، ذرة، سلطة طازجة، أفوكادو، لحم حسب الاختيار وصوص الجبن — يقدّم في بول',
    options: ['sauce', 'extra'],
  },

  // ── SNACKS ────────────────────────────────────────────────────────────────
  {
    slug: 'snacks', fr: 'Nuggets (6 pièces)', ar: 'نوجيتس (6 قطع)', price: 6.5,
    descFr: 'Nuggets — 6 pièces', descAr: 'نوجيتس — 6 قطع',
    options: ['extra'],
  },
  {
    slug: 'snacks', fr: 'Chicken Finger (8 pièces)', ar: 'تشيكن فينجر (8 قطع)', price: 6.5,
    descFr: 'Chicken fingers — 8 pièces', descAr: 'تشيكن فينجرز — 8 قطع',
    options: ['extra'],
  },
  {
    slug: 'snacks', fr: 'Boulette de fromage (6 pièces)', ar: 'بولات جبنة (6 قطع)', price: 6.5,
    descFr: 'Boulettes de fromage — 6 pièces', descAr: 'بولات جبنة — 6 قطع',
    options: ['extra'],
  },

  // ── BOXES ─────────────────────────────────────────────────────────────────
  {
    slug: 'boxes', fr: 'Box Duo', ar: 'بوكس ديو', price: 29.9,
    descFr: '2 Tacos (grillée, pané, cordon bleu, nuggets) · Méga frites · 2 Boissons · Mix (2 Poppers, 2 Nuggets, 2 Fingers)',
    descAr: '2 تاكوس (مشوي، مقلي، كوردون بلو، نوجيتس) · فريت ميقا · 2 مشروبات · ميكس (2 بوبرز، 2 نوجيتس، 2 فينجرز)',
    options: [],
  },
  {
    slug: 'boxes', fr: 'Box Chilla', ar: 'بوكس شيلا', price: 45,
    descFr: '3 Tacos (grillée, pané, cordon bleu, nuggets) · Méga frites · 3 Boissons · Mix (3 Poppers, 3 Nuggets, 3 Fingers)',
    descAr: '3 تاكوس (مشوي، مقلي، كوردون بلو، نوجيتس) · فريت ميقا · 3 مشروبات · ميكس (3 بوبرز، 3 نوجيتس، 3 فينجرز)',
    options: [],
  },
  {
    slug: 'boxes', fr: 'Box Famille', ar: 'بوكس فاميل', price: 59.9,
    descFr: '4 Tacos (grillée, pané, cordon bleu, nuggets) · Méga frites · 4 Boissons · Mix (4 Poppers, 4 Nuggets, 4 Fingers)',
    descAr: '4 تاكوس (مشوي، مقلي، كوردون بلو، نوجيتس) · فريت ميقا · 4 مشروبات · ميكس (4 بوبرز، 4 نوجيتس، 4 فينجرز)',
    options: [],
  },

  // ── BOISSONS ──────────────────────────────────────────────────────────────
  {
    slug: 'boissons', fr: 'Soda Canette', ar: 'صودا علبة', price: 2.5,
    descFr: 'Boisson gazeuse en canette', descAr: 'مشروب غازي في علبة',
    options: [],
  },
  {
    slug: 'boissons', fr: 'Eau (0.5 L)', ar: 'ماء (0.5 ل)', price: 1,
    descFr: 'Eau minérale 0.5 L', descAr: 'ماء معدني 0.5 لتر',
    options: [],
  },
]

/** Les familles que le client compose lui-même ; leurs plats nommés ne servent que de photos. */
const COMPOSABLE = new Set(BASES.map((b) => b.slug))

// ─── Migration ───────────────────────────────────────────────────────────────
async function main() {
  await connectDB()

  // ── 0. Renommages, avant tout upsert par nom ──────────────────────────────
  console.log('✏️  Renommages...')
  for (const r of SUPPLEMENT_RENAMES) {
    if (await Supplement.exists({ 'name.fr': r.to })) continue
    const res = await Supplement.updateOne(
      { 'name.fr': r.from, type: r.type },
      { $set: { 'name.fr': r.to } }
    )
    if (res.modifiedCount) console.log(`   ✓ ${r.from} → ${r.to}`)
  }
  for (const r of PRODUCT_RENAMES) {
    if (await Product.exists({ 'name.fr': r.to })) continue
    const res = await Product.updateOne({ 'name.fr': r.from }, { $set: { 'name.fr': r.to } })
    if (res.modifiedCount) console.log(`   ✓ ${r.from} → ${r.to}`)
  }

  // ── 1. Catégories ─────────────────────────────────────────────────────────
  console.log('\n📂 Catégories...')
  const cats: Record<string, Id> = {}
  for (const c of CATEGORIES) {
    const doc = await Category.findOneAndUpdate(
      { slug: c.slug },
      { $set: { name: { fr: c.fr, ar: c.ar }, order: c.order, isActive: true } },
      { upsert: true, returnDocument: 'after' }
    )
    cats[c.slug] = doc._id
    console.log(`   ✓ ${c.fr}`)
  }

  // Les photos déjà en ligne servent d'illustration aux viandes et aux bases.
  const shot = await Product.find({}).select('name image').lean()
  const imageOf = (fr: string): string =>
    String(shot.find((p) => (p.name as { fr: string }).fr === fr)?.image ?? '')

  // ── 2. Suppléments ────────────────────────────────────────────────────────
  /** Upsert par nom, en ne posant l'image que si le document n'en a pas déjà une. */
  async function putSupplement(
    fr: string,
    fields: Record<string, unknown>,
    fallbackImage = ''
  ): Promise<Id> {
    const existing = await Supplement.findOne({ 'name.fr': fr }).select('image').lean()
    const image = (existing as { image?: string } | null)?.image || fallbackImage
    const doc = await Supplement.findOneAndUpdate(
      { 'name.fr': fr },
      { $set: { ...fields, image, isActive: true } },
      { upsert: true, returnDocument: 'after' }
    )
    return doc._id
  }

  console.log('\n🥫 Sauces...')
  const sauceIds: Id[] = []
  for (const s of SAUCES) {
    sauceIds.push(await putSupplement(s.fr, { name: { fr: s.fr, ar: s.ar }, price: 0, type: 'sauce' }))
    console.log(`   ✓ ${s.fr.padEnd(16)} offerte`)
  }

  console.log('\n📐 Tailles...')
  const sizeIdsBySlug: Record<string, Id[]> = {}
  for (const s of SIZES) {
    const id = await putSupplement(s.fr, {
      name: { fr: s.fr, ar: s.ar },
      price: s.price,
      type: 'size',
      meatCount: s.meatCount,
    })
    ;(sizeIdsBySlug[s.slug] ??= []).push(id)
    const base = BASES.find((b) => b.slug === s.slug)!.price
    console.log(`   ✓ ${s.fr.padEnd(24)} ${(base + s.price).toFixed(2)} DT · ${s.meatCount} viande(s)`)
  }

  console.log('\n🥩 Viandes...')
  const viandeIds: Id[] = []
  for (const v of VIANDES) {
    const id = await putSupplement(
      v.fr,
      { name: { fr: v.fr, ar: v.ar }, price: 0, type: 'viande' },
      imageOf(v.imageFrom)
    )
    viandeIds.push(id)
    console.log(`   ✓ ${v.fr}`)
  }

  console.log('\n➕ Suppléments payants...')
  const extraIds: Id[] = []
  for (const e of EXTRAS) {
    extraIds.push(await putSupplement(e.fr, { name: { fr: e.fr, ar: e.ar }, price: e.price, type: 'extra' }))
    console.log(`   ✓ ${e.fr.padEnd(24)} +${e.price} DT`)
  }

  // Ce qui a quitté la carte est désactivé, jamais supprimé.
  const keptSupplements = [
    ...SAUCES.map((s) => s.fr),
    ...SIZES.map((s) => s.fr),
    ...VIANDES.map((v) => v.fr),
    ...EXTRAS.map((e) => e.fr),
  ]
  const dropped = await Supplement.find({ 'name.fr': { $nin: keptSupplements }, isActive: true })
    .select('name')
    .lean()
  if (dropped.length > 0) {
    await Supplement.updateMany(
      { 'name.fr': { $nin: keptSupplements } },
      { $set: { isActive: false } }
    )
    console.log('\n🗄️  Retirés de la carte :')
    for (const d of dropped) console.log(`   – ${(d.name as { fr: string }).fr}`)
  }

  // ── 3. Produits composables ───────────────────────────────────────────────
  console.log('\n🌯 Produits de base...')
  const composableIds: Record<string, Id[]> = {}
  for (const b of BASES) {
    composableIds[b.slug] = [...sizeIdsBySlug[b.slug], ...viandeIds, ...sauceIds, ...extraIds]
    await Product.findOneAndUpdate(
      { 'name.fr': b.fr, isBase: true },
      {
        $set: {
          name: { fr: b.fr, ar: b.ar },
          description: { fr: b.descFr, ar: b.descAr },
          price: b.price,
          category: cats[b.slug],
          supplements: composableIds[b.slug],
          image: imageOf(b.imageFrom),
          isBase: true,
          isAvailable: true,
          isActive: true,
        },
      },
      { upsert: true, returnDocument: 'after' }
    )
    const sizes = SIZES.filter((s) => s.slug === b.slug)
    console.log(
      `   ✓ ${b.fr.padEnd(10)} ${sizes.map((s) => (b.price + s.price).toFixed(0)).join(' / ')} DT`
    )
  }

  // Les plats nommés d'une famille composable ne se commandent plus : ils ne
  // restent en ligne que pour illustrer la catégorie. On aligne quand même leur
  // prix sur la taille M, pour que le backoffice n'affiche pas d'ancien tarif.
  console.log('\n🖼️  Plats-photos des familles composables...')
  for (const b of BASES) {
    const res = await Product.updateMany(
      { category: cats[b.slug], isBase: { $ne: true } },
      { $set: { price: b.price, supplements: composableIds[b.slug], isActive: true } }
    )
    console.log(`   ✓ ${b.fr.padEnd(10)} ${res.matchedCount} visuel(s) à ${b.price} DT`)
  }

  // ── 4. Plats à la carte ───────────────────────────────────────────────────
  console.log('\n🍔 Plats à la carte...')
  for (const d of DISHES) {
    const supplements = [
      ...(d.options.includes('sauce') ? sauceIds : []),
      ...(d.options.includes('extra') ? extraIds : []),
    ]
    await Product.findOneAndUpdate(
      { 'name.fr': d.fr },
      {
        $set: {
          name: { fr: d.fr, ar: d.ar },
          description: { fr: d.descFr, ar: d.descAr },
          price: d.price,
          category: cats[d.slug],
          supplements,
          isBase: false,
          isAvailable: true,
          isActive: true,
        },
        $setOnInsert: { image: '' },
      },
      { upsert: true, returnDocument: 'after' }
    )
    console.log(`   ✓ ${d.fr.padEnd(32)} ${d.price.toFixed(2)} DT   [${d.slug}]`)
  }

  // ── 5. Plats disparus ─────────────────────────────────────────────────────
  const composableCatIds = [...COMPOSABLE].map((slug) => cats[slug])
  const gone = await Product.find({
    'name.fr': { $nin: DISHES.map((d) => d.fr) },
    category: { $nin: composableCatIds },
    isBase: { $ne: true },
    isActive: true,
  })
    .select('name')
    .lean()

  if (gone.length > 0) {
    await Product.updateMany(
      { _id: { $in: gone.map((g) => g._id) } },
      { $set: { isActive: false } }
    )
    console.log('\n🗄️  Plats retirés de la carte :')
    for (const g of gone) console.log(`   – ${(g.name as { fr: string }).fr}`)
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Carte à jour
   Catégories  : ${CATEGORIES.length}
   Tacos       : 11 / 16 / 19 DT   (M · XL · XXL)
   Burrito     : 12 / 16 / 19 DT   (M · XL · XXL)
   Viandes     : ${VIANDES.length}   Sauces : ${SAUCES.length}   Suppléments : ${EXTRAS.length}
   Plats       : ${DISHES.length} à la carte + ${BASES.length} à composer
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`)

  await mongoose.disconnect()
}

main().catch((err) => {
  console.error('❌ Migration échouée :', err)
  process.exit(1)
})
