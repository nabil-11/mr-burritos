# Mr. Burritos

Site de commande en ligne, borne et back-office du restaurant Mr. Burritos (Ariana, Tunis).
Next.js 16 (App Router) · MongoDB (Mongoose) · Tailwind CSS 4.

## Espaces

| Route | Pour qui | Contenu |
| --- | --- | --- |
| `/` | Clients | Menu à composer, panier, −15 % en ligne, suivi de commande en direct |
| `/avis`, `/blog` | Clients | Avis vérifiés, articles |
| `/commander` | Borne | Commande sur place |
| `/login` | Équipe | Connexion au back-office, téléchargement de l'app caisse |
| `/dashboard`, `/orders`, `/recettes`… | Équipe | Back-office |
| `/api/*` | Apps | API utilisée par le site, la caisse et les apps mobiles |

## Démarrer

```bash
npm install
npm run dev        # http://localhost:3000
```

Variables d'environnement (`.env`) :

| Variable | Rôle |
| --- | --- |
| `MONGO_URL` | Base MongoDB (obligatoire) |
| `JWT_SECRET` | Signature des sessions (obligatoire) |
| `NEXT_PUBLIC_SITE_URL` | URL publique — aperçus de liens, sitemap, données Google |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | Ligne WhatsApp affichée sur le site (optionnel) |
| `NEXT_PUBLIC_CAISSE_URL` | Installateur de la caisse hébergé ailleurs (optionnel) |
| `CLOUDINARY_URL` | Upload des images du back-office |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Notifications push vers l'équipe (vide = désactivé) |

## Scripts

| Commande | Rôle |
| --- | --- |
| `npm run seed` | Données de départ |
| `npm run upgrade-menu` | Met le menu à jour (catégories, produits, suppléments) |
| `npm run backfill-order-source` | Renseigne la source des anciennes commandes |
| `npm run promo-card` / `npm run flyers` | Génèrent les visuels d'`affiches/` |

## Où changer quoi

- Coordonnées du restaurant : `lib/site.ts`
- Horaires et temps de préparation : `lib/hours.ts`
- Remise en ligne : `lib/promo.ts`
- Installateur de la caisse : déposer le `.exe` dans `public/downloads/` (le plus récent est proposé sur `/login`)
