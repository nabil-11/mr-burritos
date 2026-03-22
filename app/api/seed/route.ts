import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { connectDB } from '@/lib/mongodb'
import { User } from '@/lib/models/User'
import { Category } from '@/lib/models/Category'
import { Supplement } from '@/lib/models/Supplement'
import { Product } from '@/lib/models/Product'

export async function POST() {
  await connectDB()

  // Admin user
  const existingAdmin = await User.findOne({ email: 'admin@mrburritos.tn' })
  if (!existingAdmin) {
    await User.create({
      name: 'Admin',
      email: 'admin@mrburritos.tn',
      password: await bcrypt.hash('admin123', 12),
      role: 'admin',
    })
  }

  // Categories
  const tacos = await Category.findOneAndUpdate(
    { slug: 'tacos' },
    { name: { ar: 'تاكوس', fr: 'Tacos' }, slug: 'tacos', order: 1 },
    { upsert: true, new: true }
  )
  const burritos = await Category.findOneAndUpdate(
    { slug: 'burritos' },
    { name: { ar: 'بوريتوس', fr: 'Burritos' }, slug: 'burritos', order: 2 },
    { upsert: true, new: true }
  )
  const snacks = await Category.findOneAndUpdate(
    { slug: 'snacks' },
    { name: { ar: 'سناكس', fr: 'Snacks' }, slug: 'snacks', order: 3 },
    { upsert: true, new: true }
  )
  const boissons = await Category.findOneAndUpdate(
    { slug: 'boissons' },
    { name: { ar: 'مشروبات', fr: 'Boissons' }, slug: 'boissons', order: 4 },
    { upsert: true, new: true }
  )

  // Supplements
  const supplements: Record<string, unknown>[] = [
    { name: { ar: 'زيتون', fr: 'Olive' }, price: 0, type: 'sauce' },
    { name: { ar: 'جزائرية', fr: 'Algérienne' }, price: 0, type: 'sauce' },
    { name: { ar: 'مايونيز', fr: 'Mayonnaise' }, price: 0, type: 'sauce' },
    { name: { ar: 'ثوم', fr: 'Ail' }, price: 0, type: 'sauce' },
    { name: { ar: 'BBQ', fr: 'BBQ' }, price: 0, type: 'sauce' },
    { name: { ar: 'كاتشب', fr: 'Ketchup' }, price: 0, type: 'sauce' },
    { name: { ar: 'هريسة', fr: 'Harissa' }, price: 0, type: 'sauce' },
    { name: { ar: 'حجم XL', fr: 'Taille XL' }, price: 4.5, type: 'size' },
    { name: { ar: 'بيض', fr: 'Oeuf' }, price: 1, type: 'extra' },
    { name: { ar: 'جبنة شريحة', fr: 'Fromage Slice' }, price: 1, type: 'extra' },
    { name: { ar: 'موزاريلا', fr: 'Mozzarella' }, price: 2.5, type: 'extra' },
    { name: { ar: 'جبنة غرويير', fr: 'Fromage Gruyère' }, price: 2.5, type: 'extra' },
    { name: { ar: 'جبنة راكليت', fr: 'Fromage Raclette' }, price: 2.5, type: 'extra' },
    { name: { ar: 'بيكون', fr: 'Bacon' }, price: 3.5, type: 'extra' },
  ]
  const supDocs = await Promise.all(
    supplements.map((s) =>
      Supplement.findOneAndUpdate(
        { 'name.fr': (s.name as { ar: string; fr: string }).fr },
        s,
        { upsert: true, new: true }
      )
    )
  )
  const sauces = supDocs.filter((s) => s.type === 'sauce').map((s) => s._id)
  const extras = supDocs.filter((s) => s.type !== 'sauce').map((s) => s._id)
  const allSupps = supDocs.map((s) => s._id)

  // Products — Tacos
  const tacosProducts = [
    { name: { ar: 'تاكوس كريسبي', fr: 'Tacos Crispy' }, description: { ar: 'صوص فروماجير، حشوة، إسكالوب مقلي، بطاطس', fr: 'Sauce fromagère, garniture, escalope panée, frites' }, price: 10.9, category: tacos._id, supplements: allSupps },
    { name: { ar: 'تاكوس سبايسي تشيكن', fr: 'Tacos Spicy Chicken' }, description: { ar: 'صوص فروماجير، حشوة، إسكالوب مشوية، بطاطس', fr: 'Sauce fromagère, garniture, escalope grillée, frites' }, price: 10.9, category: tacos._id, supplements: allSupps },
    { name: { ar: 'تاكوس كوردون بلو', fr: 'Tacos Cordon Bleu' }, description: { ar: 'صوص فروماجير، حشوة، كوردون بلو، بطاطس', fr: 'Sauce fromagère, garniture, cordon bleu, frites' }, price: 11.9, category: tacos._id, supplements: allSupps },
    { name: { ar: 'تاكوس نوجيتس', fr: 'Tacos Nuggettes' }, description: { ar: 'صوص فروماجير، حشوة، نوجيتس، بطاطس', fr: 'Sauce fromagère, garniture, nuggettes, frites' }, price: 11.9, category: tacos._id, supplements: allSupps },
    { name: { ar: 'تاكوس بيف', fr: 'Tacos Beef' }, description: { ar: 'صوص فروماجير، حشوة، لحم مفروم، بطاطس', fr: 'Sauce fromagère, garniture, viande hachée, frites' }, price: 13.9, category: tacos._id, supplements: allSupps },
  ]

  // Products — Burritos
  const burritosProducts = [
    { name: { ar: 'بوريتو كريسبي', fr: 'Burrito Crispy' }, description: { ar: 'إسكالوب مقلي، أرز، ذرة، صوص بوريتو، فلفل، بطاطس، صوص فروماجير، صوص اختياري', fr: 'Escalope panée, riz, maïs, sauce burrito, poivron, frites, Sauce fromagère, sauce au choix' }, price: 11.9, category: burritos._id, supplements: [...sauces, ...extras] },
    { name: { ar: 'بوريتو سبايسي تشيكن', fr: 'Burrito Spicy Chicken' }, description: { ar: 'إسكالوب مشوية، أرز، ذرة، صوص بوريتو، فلفل، بطاطس، صوص فروماجير، صوص اختياري', fr: 'Escalope grillée, riz, maïs, sauce burrito, poivron, frites, Sauce fromagère, sauce au choix' }, price: 11.9, category: burritos._id, supplements: [...sauces, ...extras] },
    { name: { ar: 'بوريتو كوردون بلو', fr: 'Burrito Cordon Bleu' }, description: { ar: 'كوردون بلو، أرز، ذرة، صوص بوريتو، فلفل، بطاطس، صوص فروماجير، صوص اختياري', fr: 'Cordon bleu, riz, maïs, sauce burrito, poivron, frites, Sauce fromagère, sauce au choix' }, price: 11.9, category: burritos._id, supplements: [...sauces, ...extras] },
    { name: { ar: 'بوريتو نوجيتس', fr: 'Burrito Nuggettes' }, description: { ar: 'نوجيتس، أرز، ذرة، صوص بوريتو، فلفل، بطاطس، صوص فروماجير، صوص اختياري', fr: 'Nuggettes, riz, maïs, sauce burrito, poivron, frites, Sauce fromagère, sauce au choix' }, price: 11.9, category: burritos._id, supplements: [...sauces, ...extras] },
    { name: { ar: 'بوريتو بيف', fr: 'Burrito Beef' }, description: { ar: 'لحم مفروم، أرز، ذرة، صوص بوريتو، فلفل، بطاطس، صوص فروماجير، صوص اختياري', fr: 'Viande hachée, riz, maïs, sauce burrito, poivron, frites, Sauce fromagère, sauce au choix' }, price: 13.9, category: burritos._id, supplements: [...sauces, ...extras] },
  ]

  // Products — Snacks
  const snacksProducts = [
    { name: { ar: 'ميكس بوكس', fr: 'Mix Box' }, description: { ar: '6 بوبرز، 6 نوجيتس، 6 فينجرز', fr: '6 Poppers, 6 Nuggets, 6 Fingers' }, price: 16.5, category: snacks._id, supplements: extras },
    { name: { ar: 'بوبرز بوكس', fr: 'Poppers Box' }, description: { ar: '6 قطع بولية جبنة', fr: '6 Pièces de boulette fromage' }, price: 5.9, category: snacks._id, supplements: extras },
    { name: { ar: 'نوجيتس بوكس', fr: 'Nuggets Box' }, description: { ar: '6 أو 10 قطع', fr: '6 ou 10 Pièces' }, price: 5.9, category: snacks._id, supplements: extras },
    { name: { ar: 'تشيكن فينجرز بوكس', fr: 'Chicken Fingers Box' }, description: { ar: '8 أو 12 قطعة', fr: '8 ou 12 Pièces' }, price: 5.9, category: snacks._id, supplements: extras },
  ]

  // Products — Boissons
  const boissonsProducts = [
    { name: { ar: 'علبة (24 كل)', fr: 'Canette (24 cl)' }, description: { ar: '', fr: '' }, price: 2.5, category: boissons._id, supplements: [] },
    { name: { ar: 'ماء (0.5 ل)', fr: 'Eau (0.5 L)' }, description: { ar: '', fr: '' }, price: 1, category: boissons._id, supplements: [] },
  ]

  for (const p of [...tacosProducts, ...burritosProducts, ...snacksProducts, ...boissonsProducts]) {
    await Product.findOneAndUpdate({ 'name.fr': p.name.fr }, p, { upsert: true, new: true })
  }

  return NextResponse.json({ success: true, message: 'Seed terminé avec succès' })
}
