import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { connectDB } from '@/lib/mongodb'
import { User } from '@/lib/models/User'

/**
 * Amorce une installation neuve : le compte administrateur, rien de plus.
 *
 * La carte n'est plus écrite ici. Elle vit dans `scripts/upgrade-menu.ts`
 * (`npm run upgrade-menu`), qui en est la seule source : un endpoint HTTP qui
 * réécrit des prix est un pistolet chargé posé sur la table.
 */
export async function POST() {
  await connectDB()

  const admin = await User.findOne({ email: 'admin@mrburritos.tn' })
  if (!admin) {
    await User.create({
      name: 'Admin',
      email: 'admin@mrburritos.tn',
      password: await bcrypt.hash('admin123', 12),
      role: 'admin',
    })
  }

  return NextResponse.json({
    success: true,
    message: admin
      ? 'Administrateur déjà présent. Carte : npm run upgrade-menu'
      : 'Administrateur créé. Carte : npm run upgrade-menu',
  })
}
