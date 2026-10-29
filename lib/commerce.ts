/**
 * Les décisions commerciales du site, en un seul endroit : zones et frais de
 * livraison, seuil de livraison offerte, tacos signatures, suggestions,
 * seuils d'affichage des avis, liens externes.
 *
 * Chaque valeur marquée « À VALIDER PAR LE GÉRANT » est une proposition par
 * défaut : le gérant la confirme ou la corrige ici, et le site entier suit —
 * le panier, la page d'accueil et le calcul de la commande côté serveur lisent
 * tous ce fichier.
 *
 * Aucun import serveur : le panier (client) affiche exactement le frais que la
 * route de commande (serveur) appliquera, avec la même fonction.
 */

const round2 = (n: number) => Math.round(n * 100) / 100

/* ── Livraison ─────────────────────────────────────────────────────────── */

export interface DeliveryZone {
  /** Identifiant stable, envoyé avec la commande. */
  id: string
  /** Ce que le client lit dans la liste. */
  label: string
  /** Frais fixes, en dinars. */
  fee: number
  /** Frais annoncés « jusqu'à » et confirmés par téléphone, jamais facturés d'office. */
  confirmByPhone?: boolean
}

// À VALIDER PAR LE GÉRANT — quartiers desservis et frais fixes.
export const DELIVERY_ZONES: DeliveryZone[] = [
  { id: 'ennasr', label: 'Ennasr 1 & 2', fee: 2 },
  { id: 'ariana-ville', label: 'Ariana Ville', fee: 3 },
  { id: 'menzah', label: 'El Menzah 5 à 9', fee: 3 },
  { id: 'riadh-andalous', label: 'Riadh Andalous', fee: 3 },
  { id: 'ghazela', label: 'Ghazela', fee: 5 },
  { id: 'borj-louzir', label: 'Borj Louzir', fee: 5 },
  { id: 'chotrana', label: 'Chotrana', fee: 5 },
  { id: 'raoued', label: 'Raoued', fee: 5 },
  // À VALIDER PAR LE GÉRANT — plafond annoncé pour un quartier hors liste.
  { id: 'autre', label: 'Autre quartier', fee: 7, confirmByPhone: true },
]

// À VALIDER PAR LE GÉRANT — livraison offerte à partir de ce montant de
// nourriture, remises déduites (après les −15 % et le code promo). null : jamais.
export const FREE_DELIVERY_FROM: number | null = 35

export const deliveryZoneById = (id: unknown): DeliveryZone | null =>
  DELIVERY_ZONES.find((z) => z.id === id) ?? null

export interface DeliveryQuote {
  zone: DeliveryZone | null
  /** Ce qui est facturé avec la commande. 0 quand c'est offert ou à confirmer par téléphone. */
  fee: number
  /** Offerte grâce au seuil. */
  free: boolean
  /** « Autre quartier » : le restaurant rappelle pour fixer le frais. */
  confirmByPhone: boolean
  /** Ce qu'il manque pour la livraison offerte ; null quand le seuil ne s'applique pas. */
  missingForFree: number | null
}

/**
 * Le frais d'une livraison, à partir du quartier choisi et du montant de la
 * nourriture une fois les remises déduites. La même fonction tourne dans le
 * panier et dans lib/orderPricing : le client ne peut pas choisir son frais.
 */
export function deliveryQuote(zoneId: unknown, foodTotal: number): DeliveryQuote {
  const zone = deliveryZoneById(zoneId)
  const threshold = FREE_DELIVERY_FROM
  const missingForFree = threshold !== null ? round2(Math.max(0, threshold - foodTotal)) : null
  if (!zone) return { zone: null, fee: 0, free: false, confirmByPhone: false, missingForFree }
  if (zone.confirmByPhone) return { zone, fee: 0, free: false, confirmByPhone: true, missingForFree: null }
  const free = threshold !== null && foodTotal >= threshold
  return { zone, fee: free ? 0 : zone.fee, free, confirmByPhone: false, missingForFree }
}

/* ── Preuve sociale ────────────────────────────────────────────────────── */

// À VALIDER PAR LE GÉRANT — sous ce nombre d'avis approuvés, aucune note n'est
// affichée (ni dans le hero, ni pour Google) : « 5,0 (1 avis) » dessert plus
// qu'il ne rassure.
export const REVIEWS_MIN_DISPLAY = 10

/** Le bloc « Ils en parlent » attend au moins ce nombre d'avis commentés. */
export const REVIEWS_BLOCK_MIN = 3

/** 1 012 → « +1 000 » ; rien sous la centaine, trop peu pour rassurer. */
export function roundedOrders(n: number): number | null {
  if (!Number.isFinite(n) || n < 100) return null
  return Math.floor(n / 100) * 100
}

/* ── Horaires ──────────────────────────────────────────────────────────── */

/** Le bandeau « On ferme à 23:00 — commandez maintenant » s'affiche ce nombre de minutes avant. */
export const CLOSING_SOON_MINUTES = 30

/* ── Menu et suggestions ───────────────────────────────────────────────── */

/**
 * Noms comparés sans casse, accents ni ponctuation : « Eau (0.5 L) » et
 * « eau 0,5 l » se reconnaissent. Les produits sont retrouvés par leur nom,
 * jamais par un identifiant écrit en dur.
 */
export const normalizeName = (s: string) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/** Vrai quand chaque mot de `key` est un mot du nom : « nuggets » ⊂ « Nuggets (6 pièces) ». */
export function nameMatches(name: string, key: string): boolean {
  const words = new Set(normalizeName(name).split(' '))
  return normalizeName(key)
    .split(' ')
    .every((w) => words.has(w))
}

/** Une suggestion : un libellé court et les produits du menu qu'elle ajoute. */
export interface SuggestionSpec {
  label: string
  /** Noms des produits du menu, retrouvés par `nameMatches`. */
  products: string[]
}

// À VALIDER PAR LE GÉRANT — l'étape « Faites-en un menu ? » du composeur.
// Prix normal des produits tant que MENU_BUNDLE_PRICE est vide.
export const MENU_UPSELL: SuggestionSpec[] = [
  { label: 'Soda canette', products: ['soda canette'] },
  { label: 'Canette + Nuggets (6)', products: ['soda canette', 'nuggets'] },
]

// À VALIDER PAR LE GÉRANT — prix d'un menu (tacos + canette + frites…). Vide :
// pas de prix « menu », les produits sont ajoutés à leur prix normal.
export const MENU_BUNDLE_PRICE: number | null = null

// À VALIDER PAR LE GÉRANT — les suggestions du panier, dans cet ordre. Celles
// déjà dans le panier ne sont jamais proposées.
export const CART_SUGGESTIONS: SuggestionSpec[] = [
  { label: 'Soda canette', products: ['soda canette'] },
  { label: 'Eau 0,5 L', products: ['eau'] },
  { label: 'Nuggets (6)', products: ['nuggets'] },
  { label: 'Boulettes de fromage (6)', products: ['boulette de fromage'] },
]

/** La catégorie des boissons : le panier demande « Une boisson avec ça ? » tant qu'il n'en a pas. */
export const DRINKS_CATEGORY_SLUG = 'boissons'

/** Proposé dans le message « Ajouté ✓ » après un « + », et la question qui l'accompagne. */
export const AFTER_ADD_SUGGESTION = 'soda canette'
export const AFTER_ADD_PROMPT = 'Une canette avec ça ?'

/**
 * Les tacos signatures, sous la carte Tacos. Retrouvés par nom dans les
 * suppléments du tacos ; une signature dont une viande ou une sauce n'est pas
 * proposée n'est pas affichée. Le prix est calculé, jamais écrit ici.
 */
export interface SignatureSpec {
  name: string
  /** « M », « XL », « XXL ». */
  size: string
  meats: string[]
  sauces: string[]
}

// À VALIDER PAR LE GÉRANT — compositions et noms.
export const SIGNATURE_TACOS: SignatureSpec[] = [
  { name: 'Le Classique', size: 'M', meats: ['Cordon Bleu'], sauces: ['Algérienne'] },
  { name: 'Le Duo', size: 'XL', meats: ['Crispy', 'Spicy Chicken'], sauces: ['Spicy Sauce'] },
  { name: 'Le Monstre', size: 'XXL', meats: ['Cordon Bleu', 'Crispy', 'Viande hachée'], sauces: ['BBQ'] },
]

/** La catégorie qui reçoit les signatures. */
export const SIGNATURE_CATEGORY_SLUG = 'tacos'

// À VALIDER PAR LE GÉRANT — ce que comprend chaque wrap, en pastille sur sa carte.
export const COMPOSER_PILLS: Record<string, string> = {
  tacos: 'Frites + sauce fromagère incluses',
  burritos: 'Frites incluses',
}

// À VALIDER PAR LE GÉRANT — les prix barrés posés par `npm run compare-prices`
// (scripts/set-compare-prices.ts), par nom de produit. Ils se modifient
// ensuite produit par produit dans le back-office (« Prix barré »). Le script
// ne touche à rien d'autre que ce champ.
export const COMPARE_AT_PRICES: Record<string, number> = {
  'Mix Box': 19.5,
}

/** « Les plus commandés » : sur cette période, au moins ce nombre de ventes, ce nombre de produits. */
export const TOP_SELLERS = { days: 30, minSold: 5, count: 4 }

/* ── Liens externes ────────────────────────────────────────────────────── */

// À VALIDER PAR LE GÉRANT — le lien « Laisser un avis » de la fiche Google
// (Google Business Profile → « Demander des avis »). Vide : le bouton est caché.
export const GOOGLE_REVIEW_URL = ''

/* ── Attribution ───────────────────────────────────────────────────────── */

/** Combien de jours un « ?src=sac » reste attaché au navigateur. */
export const ATTRIBUTION_DAYS = 30

/** « Insta Story! » → « insta-story » : ce qu'une commande peut porter comme provenance. */
export const normalizeRef = (raw: unknown) =>
  String(raw ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
