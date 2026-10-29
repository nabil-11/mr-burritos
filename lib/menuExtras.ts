/**
 * Ce que le site propose en plus de ce que le client a choisi : les
 * suggestions du panier, l'étape « Faites-en un menu ? » du composeur, le
 * « Une canette avec ça ? » après un ajout, et les tacos signatures.
 *
 * Tout est retrouvé par nom dans la carte réelle (lib/commerce) — jamais par
 * un identifiant écrit en dur — et ce qui n'existe pas (plus) sur la carte
 * disparaît simplement de l'écran. Aucun import serveur : la page d'accueil
 * (serveur) et le panier (client) s'en servent.
 */

import type { BuilderCategory, BuilderProduct, BuilderSupplement } from '@/components/website/ProductBuilder'
import {
  AFTER_ADD_SUGGESTION,
  CART_SUGGESTIONS,
  DRINKS_CATEGORY_SLUG,
  MENU_UPSELL,
  SIGNATURE_CATEGORY_SLUG,
  SIGNATURE_TACOS,
  nameMatches,
  normalizeName,
  type SuggestionSpec,
} from './commerce'
import { groupSupplements } from './supplements'

/** Un produit de la carte, avec la catégorie qui le porte. */
export interface MenuProduct extends BuilderProduct {
  categorySlug: string
}

/** Une suggestion prête à ajouter : son libellé, ses produits, son prix total. */
export interface ResolvedSuggestion {
  label: string
  products: MenuProduct[]
  price: number
  /** Une boisson : le panier qui en a déjà une ne la repropose pas sous ce titre. */
  drink: boolean
}

export interface MenuExtras {
  cart: ResolvedSuggestion[]
  upsell: ResolvedSuggestion[]
  afterAdd: ResolvedSuggestion | null
  /** Identifiants des boissons de la carte, pour savoir si le panier en contient une. */
  drinkIds: string[]
}

/** Toutes les assiettes commandables par leur nom (les bases des wraps n'en sont pas). */
export const menuProducts = (categories: BuilderCategory[]): MenuProduct[] =>
  categories.flatMap((c) => c.products.map((p) => ({ ...p, categorySlug: c.slug })))

const findProduct = (products: MenuProduct[], key: string) =>
  // Le nom le plus court qui correspond : « Eau » ne doit pas trouver une « Eau gazeuse 1 L » avant l'« Eau (0.5 L) ».
  products
    .filter((p) => nameMatches(p.name.fr, key))
    .sort((a, b) => normalizeName(a.name.fr).length - normalizeName(b.name.fr).length)[0] ?? null

function resolve(spec: SuggestionSpec, products: MenuProduct[]): ResolvedSuggestion | null {
  const found = spec.products.map((key) => findProduct(products, key))
  if (found.some((p) => !p)) return null
  const list = found as MenuProduct[]
  return {
    label: spec.label,
    products: list,
    price: Math.round(list.reduce((s, p) => s + p.price, 0) * 100) / 100,
    drink: list.every((p) => p.categorySlug === DRINKS_CATEGORY_SLUG),
  }
}

export function resolveExtras(categories: BuilderCategory[]): MenuExtras {
  const products = menuProducts(categories)
  const pick = (specs: SuggestionSpec[]) =>
    specs.map((s) => resolve(s, products)).filter((s): s is ResolvedSuggestion => s !== null)
  const after = findProduct(products, AFTER_ADD_SUGGESTION)
  return {
    cart: pick(CART_SUGGESTIONS),
    upsell: pick(MENU_UPSELL),
    afterAdd: after
      ? { label: after.name.fr, products: [after], price: after.price, drink: after.categorySlug === DRINKS_CATEGORY_SLUG }
      : null,
    drinkIds: products.filter((p) => p.categorySlug === DRINKS_CATEGORY_SLUG).map((p) => p._id),
  }
}

/* ── Tacos signatures ──────────────────────────────────────────────────── */

export interface Signature {
  name: string
  /** « XL · Crispy + Spicy Chicken · Spicy Sauce » */
  summary: string
  size: BuilderSupplement
  /** Une entrée par portion : « double Crispy » = deux fois Crispy. */
  meats: BuilderSupplement[]
  sauces: BuilderSupplement[]
  /** Base + taille + viandes + sauces, au prix de la carte du jour. */
  price: number
}

const shortSizeName = (fr: string) => fr.replace(/^Taille\s+/i, '').replace(/\s*\([^)]*\)\s*$/, '').trim()

/**
 * Les signatures que le tacos du jour peut réellement servir. Une signature
 * dont la taille, une viande ou une sauce n'est pas (plus) proposée n'est pas
 * montrée — mieux vaut deux signatures justes que trois dont une échoue.
 */
export function resolveSignatures(categories: BuilderCategory[]): Signature[] {
  const base = categories.find((c) => c.slug === SIGNATURE_CATEGORY_SLUG)?.base
  if (!base) return []
  const g = groupSupplements(base.supplements)
  const same = (a: string, b: string) => normalizeName(a) === normalizeName(b)
  const out: Signature[] = []
  for (const spec of SIGNATURE_TACOS) {
    const size = g.sizes.find((s) => same(shortSizeName(s.name.fr), spec.size))
    const meats = spec.meats.map((m) => g.viandes.find((v) => same(v.name.fr, m)))
    const sauces = spec.sauces.map((m) => g.sauces.find((v) => same(v.name.fr, m)))
    if (!size || meats.some((m) => !m) || sauces.some((s) => !s)) continue
    // Pas plus de viandes que la taille n'en donne : la composition serait refusée au composeur.
    if (meats.length !== (size.meatCount ?? 1)) continue
    const chosen = [size, ...(meats as BuilderSupplement[]), ...(sauces as BuilderSupplement[])]
    out.push({
      name: spec.name,
      summary: `${shortSizeName(size.name.fr)} · ${spec.meats.join(' + ')} · ${spec.sauces.join(', ')}`,
      size,
      meats: meats as BuilderSupplement[],
      sauces: sauces as BuilderSupplement[],
      price: Math.round((base.price + chosen.reduce((s, x) => s + x.price, 0)) * 100) / 100,
    })
  }
  return out
}
