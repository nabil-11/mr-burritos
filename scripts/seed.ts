/**
 * Mr. Burritos — Script de seed
 * Lance avec : npm run seed
 *
 * Crée :
 *  - 1 utilisateur admin
 *  - 4 catégories  (Tacos, Burritos, Snacks, Boissons)
 *  - 14 suppléments (7 sauces gratuites, 1 taille XL, 6 extras payants)
 *  - 16 produits   (5 Tacos + 5 Burritos + 6 Snacks + 2 Boissons)
 */

import 'dotenv/config'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

// ─── Connexion ───────────────────────────────────────────────────────────────
const MONGO_URL = process.env.MONGO_URL!
if (!MONGO_URL) throw new Error('MONGO_URL manquant dans .env')

await mongoose.connect(MONGO_URL)
console.log('✅ Connecté à MongoDB')

// ─── Schemas (inline pour le script) ────────────────────────────────────────
const CategorySchema = new mongoose.Schema({
  name: { ar: String, fr: String },
  slug: { type: String, unique: true },
  order: { type: Number, default: 0 },
  image: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
}, { timestamps: true })

const SupplementSchema = new mongoose.Schema({
  name: { ar: String, fr: String },
  price: Number,
  type: { type: String, enum: ['sauce', 'size', 'extra'] },
  isActive: { type: Boolean, default: true },
}, { timestamps: true })

const ProductSchema = new mongoose.Schema({
  name: { ar: String, fr: String },
  description: { ar: String, fr: String },
  price: Number,
  image: { type: String, default: '' },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  supplements: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Supplement' }],
  isAvailable: { type: Boolean, default: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: true })

const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  role: { type: String, enum: ['admin', 'manager', 'staff'], default: 'staff' },
  isActive: { type: Boolean, default: true },
}, { timestamps: true })

const Category = mongoose.models.Category || mongoose.model('Category', CategorySchema)
const Supplement = mongoose.models.Supplement || mongoose.model('Supplement', SupplementSchema)
const Product = mongoose.models.Product || mongoose.model('Product', ProductSchema)
const User = mongoose.models.User || mongoose.model('User', UserSchema)

// ─── Helper ──────────────────────────────────────────────────────────────────
async function upsert<T>(
  Model: mongoose.Model<T>,
  filter: object,
  data: object
): Promise<mongoose.Document & T> {
  return Model.findOneAndUpdate(filter, { $set: data }, { upsert: true, new: true }) as Promise<mongoose.Document & T>
}

// ─── 1. Admin ────────────────────────────────────────────────────────────────
console.log('\n👤 Création admin...')
await upsert(User, { email: 'admin@mrburritos.tn' }, {
  name: 'Admin',
  email: 'admin@mrburritos.tn',
  password: await bcrypt.hash('admin123', 12),
  role: 'admin',
  isActive: true,
})
console.log('   admin@mrburritos.tn / admin123')

// ─── 2. Catégories ───────────────────────────────────────────────────────────
console.log('\n📂 Catégories...')
const catData = [
  { slug: 'tacos',    name: { fr: 'Tacos',     ar: 'تاكوس'   }, order: 1 },
  { slug: 'burritos', name: { fr: 'Burritos',  ar: 'بوريتوس' }, order: 2 },
  { slug: 'snacks',   name: { fr: 'Snacks',    ar: 'سناكس'   }, order: 3 },
  { slug: 'boissons', name: { fr: 'Boissons',  ar: 'مشروبات' }, order: 4 },
]
const cats: Record<string, mongoose.Types.ObjectId> = {}
for (const c of catData) {
  const doc = await upsert(Category, { slug: c.slug }, c)
  cats[c.slug] = doc._id as mongoose.Types.ObjectId
  console.log(`   ✓ ${c.name.fr}`)
}

// ─── 3. Suppléments ──────────────────────────────────────────────────────────
console.log('\n➕ Suppléments...')

const supplementData = [
  // --- SAUCES (gratuites, type: sauce) ---
  { nameFr: 'Olive',            nameAr: 'زيتون',         price: 0,   type: 'sauce' },
  { nameFr: 'Algérienne',       nameAr: 'جزائرية',       price: 0,   type: 'sauce' },
  { nameFr: 'Mayonnaise',       nameAr: 'مايونيز',       price: 0,   type: 'sauce' },
  { nameFr: 'Ail',              nameAr: 'ثوم',           price: 0,   type: 'sauce' },
  { nameFr: 'BBQ',              nameAr: 'BBQ',           price: 0,   type: 'sauce' },
  { nameFr: 'Ketchup',          nameAr: 'كاتشب',         price: 0,   type: 'sauce' },
  { nameFr: 'Harissa',          nameAr: 'هريسة',         price: 0,   type: 'sauce' },
  // --- TAILLE (type: size) ---
  { nameFr: 'Taille XL',        nameAr: 'حجم XL',        price: 4.5, type: 'size'  },
  // --- EXTRAS payants (type: extra) ---
  { nameFr: 'Oeuf',             nameAr: 'بيض',           price: 1,   type: 'extra' },
  { nameFr: 'Fromage Slice',    nameAr: 'جبنة شريحة',    price: 1,   type: 'extra' },
  { nameFr: 'Mozzarella',       nameAr: 'موزاريلا',      price: 2.5, type: 'extra' },
  { nameFr: 'Fromage Gruyère',  nameAr: 'جبنة غرويير',   price: 2.5, type: 'extra' },
  { nameFr: 'Fromage Raclette', nameAr: 'جبنة راكليت',   price: 2.5, type: 'extra' },
  { nameFr: 'Bacon',            nameAr: 'بيكون',          price: 3.5, type: 'extra' },
]

const supIds: Record<string, mongoose.Types.ObjectId> = {}
for (const s of supplementData) {
  const doc = await upsert(Supplement, { 'name.fr': s.nameFr }, {
    name: { fr: s.nameFr, ar: s.nameAr },
    price: s.price,
    type: s.type,
    isActive: true,
  })
  supIds[s.nameFr] = doc._id as mongoose.Types.ObjectId
  console.log(`   ✓ ${s.nameFr} (${s.price > 0 ? '+' + s.price + ' DT' : 'gratuit'}) [${s.type}]`)
}

// Groupes de suppléments réutilisables
const SAUCES = ['Olive','Algérienne','Mayonnaise','Ail','BBQ','Ketchup','Harissa'].map(n => supIds[n])
const EXTRAS = ['Oeuf','Fromage Slice','Mozzarella','Fromage Gruyère','Fromage Raclette','Bacon'].map(n => supIds[n])
const XL     = [supIds['Taille XL']]
const ALL    = [...SAUCES, ...XL, ...EXTRAS]          // Tacos : sauces + XL + extras
const BURR   = [...SAUCES, ...EXTRAS]                 // Burritos : sauces + extras (pas XL)
const SNACK  = [...EXTRAS]                            // Snacks : extras seulement

// ─── 4. Produits ─────────────────────────────────────────────────────────────
console.log('\n🌯 Produits...')

const products = [
  // ======================== TACOS ========================
  {
    name:        { fr: 'Tacos Crispy',         ar: 'تاكوس كريسبي'       },
    description: { fr: 'Sauce fromagère, garniture, escalope panée, frites',
                   ar: 'صوص فروماجير، حشوة، إسكالوب مقلي، بطاطس' },
    price: 10.9,
    category: cats.tacos,
    supplements: ALL,
  },
  {
    name:        { fr: 'Tacos Spicy Chicken',  ar: 'تاكوس سبايسي تشيكن' },
    description: { fr: 'Sauce fromagère, garniture, escalope grillée, frites',
                   ar: 'صوص فروماجير، حشوة، إسكالوب مشوية، بطاطس' },
    price: 10.9,
    category: cats.tacos,
    supplements: ALL,
  },
  {
    name:        { fr: 'Tacos Cordon Bleu',    ar: 'تاكوس كوردون بلو'   },
    description: { fr: 'Sauce fromagère, garniture, cordon bleu, frites',
                   ar: 'صوص فروماجير، حشوة، كوردون بلو، بطاطس' },
    price: 11.9,
    category: cats.tacos,
    supplements: ALL,
  },
  {
    name:        { fr: 'Tacos Nuggettes',      ar: 'تاكوس نوجيتس'       },
    description: { fr: 'Sauce fromagère, garniture, nuggettes, frites',
                   ar: 'صوص فروماجير، حشوة، نوجيتس، بطاطس' },
    price: 11.9,
    category: cats.tacos,
    supplements: ALL,
  },
  {
    name:        { fr: 'Tacos Beef',           ar: 'تاكوس بيف'          },
    description: { fr: 'Sauce fromagère, garniture, viande hachée, frites',
                   ar: 'صوص فروماجير، حشوة، لحم مفروم، بطاطس' },
    price: 13.9,
    category: cats.tacos,
    supplements: ALL,
  },

  // ======================== BURRITOS ========================
  {
    name:        { fr: 'Burrito Crispy',       ar: 'بوريتو كريسبي'      },
    description: { fr: 'Escalope panée, riz, maïs, sauce burrito, poivron, frites, Sauce fromagère, sauce au choix',
                   ar: 'إسكالوب مقلي، أرز، ذرة، صوص بوريتو، فلفل، بطاطس، صوص فروماجير، صوص اختياري' },
    price: 11.9,
    category: cats.burritos,
    supplements: BURR,
  },
  {
    name:        { fr: 'Burrito Spicy Chicken', ar: 'بوريتو سبايسي تشيكن' },
    description: { fr: 'Escalope grillée, riz, maïs, sauce burrito, poivron, frites, Sauce fromagère, sauce au choix',
                   ar: 'إسكالوب مشوية، أرز، ذرة، صوص بوريتو، فلفل، بطاطس، صوص فروماجير، صوص اختياري' },
    price: 11.9,
    category: cats.burritos,
    supplements: BURR,
  },
  {
    name:        { fr: 'Burrito Cordon Bleu',  ar: 'بوريتو كوردون بلو'  },
    description: { fr: 'Cordon bleu, riz, maïs, sauce burrito, poivron, frites, Sauce fromagère, sauce au choix',
                   ar: 'كوردون بلو، أرز، ذرة، صوص بوريتو، فلفل، بطاطس، صوص فروماجير، صوص اختياري' },
    price: 11.9,
    category: cats.burritos,
    supplements: BURR,
  },
  {
    name:        { fr: 'Burrito Nuggettes',    ar: 'بوريتو نوجيتس'      },
    description: { fr: 'Nuggettes, riz, maïs, sauce burrito, poivron, frites, Sauce fromagère, sauce au choix',
                   ar: 'نوجيتس، أرز، ذرة، صوص بوريتو، فلفل، بطاطس، صوص فروماجير، صوص اختياري' },
    price: 11.9,
    category: cats.burritos,
    supplements: BURR,
  },
  {
    name:        { fr: 'Burrito Beef',         ar: 'بوريتو بيف'         },
    description: { fr: 'Viande hachée, riz, maïs, sauce burrito, poivron, frites, Sauce fromagère, sauce au choix',
                   ar: 'لحم مفروم، أرز، ذرة، صوص بوريتو، فلفل، بطاطس، صوص فروماجير، صوص اختياري' },
    price: 13.9,
    category: cats.burritos,
    supplements: BURR,
  },

  // ======================== SNACKS ========================
  {
    name:        { fr: 'Mix Box',              ar: 'ميكس بوكس'          },
    description: { fr: '6 Poppers, 6 Nuggets, 6 Fingers',
                   ar: '6 بوبرز، 6 نوجيتس، 6 فينجرز' },
    price: 16.5,
    category: cats.snacks,
    supplements: SNACK,
  },
  {
    name:        { fr: 'Poppers Box',          ar: 'بوبرز بوكس'         },
    description: { fr: '6 Pièces de boulette fromage',
                   ar: '6 قطع بولية جبنة' },
    price: 5.9,
    category: cats.snacks,
    supplements: SNACK,
  },
  {
    name:        { fr: 'Nuggets Box 6 pièces', ar: 'نوجيتس بوكس 6 قطع' },
    description: { fr: 'Nuggets — 6 Pièces',
                   ar: 'نوجيتس — 6 قطع' },
    price: 5.9,
    category: cats.snacks,
    supplements: SNACK,
  },
  {
    name:        { fr: 'Nuggets Box 10 pièces', ar: 'نوجيتس بوكس 10 قطع' },
    description: { fr: 'Nuggets — 10 Pièces',
                   ar: 'نوجيتس — 10 قطع' },
    price: 9.9,
    category: cats.snacks,
    supplements: SNACK,
  },
  {
    name:        { fr: 'Chicken Fingers Box 8 pièces', ar: 'تشيكن فينجرز بوكس 8 قطع' },
    description: { fr: 'Chicken Fingers — 8 Pièces',
                   ar: 'تشيكن فينجرز — 8 قطع' },
    price: 5.9,
    category: cats.snacks,
    supplements: SNACK,
  },
  {
    name:        { fr: 'Chicken Fingers Box 12 pièces', ar: 'تشيكن فينجرز بوكس 12 قطع' },
    description: { fr: 'Chicken Fingers — 12 Pièces',
                   ar: 'تشيكن فينجرز — 12 قطع' },
    price: 8.9,
    category: cats.snacks,
    supplements: SNACK,
  },

  // ======================== BOISSONS ========================
  {
    name:        { fr: 'Canette (24 cl)',      ar: 'علبة (24 كل)'       },
    description: { fr: 'Boisson canette 24 cl', ar: 'مشروب علبة 24 كل' },
    price: 2.5,
    category: cats.boissons,
    supplements: [],
  },
  {
    name:        { fr: 'Eau (0.5 L)',          ar: 'ماء (0.5 ل)'        },
    description: { fr: 'Eau minérale 0.5 L',   ar: 'ماء معدني 0.5 لتر' },
    price: 1,
    category: cats.boissons,
    supplements: [],
  },
]

for (const p of products) {
  await upsert(Product, { 'name.fr': p.name.fr }, { ...p, isAvailable: true, isActive: true })
  console.log(`   ✓ ${p.name.fr} — ${p.price} DT`)
}

// ─── Résumé ──────────────────────────────────────────────────────────────────
console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Seed terminé !
   Catégories  : ${catData.length}
   Suppléments : ${supplementData.length}
   Produits    : ${products.length}
   Admin       : admin@mrburritos.tn / admin123
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`)

await mongoose.disconnect()
process.exit(0)
