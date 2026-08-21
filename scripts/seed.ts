/**
 * Mr. Burritos — Script de seed
 * Lance avec : npm run seed
 *
 * Crée le compte administrateur d'une installation neuve, puis rend la main.
 *
 * La carte — catégories, suppléments, tailles, viandes, plats — appartient
 * désormais à `npm run upgrade-menu`, seul endroit où les prix sont écrits.
 * Deux scripts qui déclarent la même carte finissent toujours par diverger, et
 * c'est l'ancien qui gagne le jour où quelqu'un relance le mauvais.
 */

import 'dotenv/config'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import { connectDB } from '../lib/mongodb'
import { User } from '../lib/models/User'

async function main() {
  await connectDB()

  console.log('👤 Compte administrateur...')
  await User.findOneAndUpdate(
    { email: 'admin@mrburritos.tn' },
    {
      $set: { name: 'Admin', role: 'admin', isActive: true },
      // Un mot de passe déjà changé en production ne doit pas être réinitialisé.
      $setOnInsert: { password: await bcrypt.hash('admin123', 12) },
    },
    { upsert: true, returnDocument: 'after' }
  )

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Seed terminé
   Login : admin@mrburritos.tn / admin123
   (mot de passe posé à la création uniquement)

   Étape suivante — installer la carte :
   npm run upgrade-menu
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`)

  await mongoose.disconnect()
}

main().catch((err) => {
  console.error('❌ Erreur seed :', err)
  process.exit(1)
})
