/**
 * How a composed item is drawn, layer by layer — shared by the builder's
 * cross-section and the home page's exploded hero so both describe the same
 * food with the same colours and the same order.
 */

export interface StackItem {
  _id: string
  name: { fr: string }
  layerImage?: string
}

export type StackShape = 'tacos' | 'burrito' | 'burger'

export interface Look {
  color: string
  /** Layer thickness in px at the reference width (128). */
  height: number
}

export const strip = (s: string) =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()

export const LOOKS: Record<string, Look> = {
  // Viandes — anciens noms
  'escalope panee':   { color: '#CE9350', height: 14 },
  'escalope grillee': { color: '#A96B3C', height: 14 },
  'nuggets':          { color: '#E2A93F', height: 13 },
  // Viandes — carte 2026
  'chicken crispy':      { color: '#CE9350', height: 14 },
  'spicy chicken':       { color: '#A96B3C', height: 14 },
  'crispy':              { color: '#E2A93F', height: 13 },
  'boulette de fromage': { color: '#EBBE63', height: 13 },
  // Communes
  'cordon bleu':      { color: '#D9A863', height: 15 },
  'viande hachee':    { color: '#8A4A33', height: 14 },
  'steak':            { color: '#6B3F2A', height: 16 },
  // Sauces
  'olive':            { color: '#6E8B3D', height: 5 },
  'algerienne':       { color: '#D2691E', height: 5 },
  'mayonnaise':       { color: '#F5EFD6', height: 5 },
  'ail':              { color: '#EFE4CE', height: 5 },
  'bbq':              { color: '#7B3F1D', height: 5 },
  'ketchup':          { color: '#C0392B', height: 5 },
  'harissa':          { color: '#B22222', height: 5 },
  'spicy sauce':      { color: '#B22222', height: 5 },
  // Extras
  'oeuf':             { color: '#F8E9A6', height: 8 },
  'fromage slice':    { color: '#F3C44F', height: 6 },
  'mozzarella':       { color: '#F7F2E4', height: 8 },
  'fromage gruyere':  { color: '#E9CA7C', height: 7 },
  'fromage raclette': { color: '#F1D88E', height: 7 },
  'bacon':            { color: '#A0522D', height: 7 },
  'cheddar':          { color: '#F0A93C', height: 6 },
  'mozzarella fondu': { color: '#F7F2E4', height: 8 },
  'nachos':           { color: '#E5B24C', height: 8 },
  'guacamole':        { color: '#8FA85B', height: 7 },
  'portion viande au choix': { color: '#8A4A33', height: 14 },
  'haricots':         { color: '#8B5E3C', height: 6 },
  // Garnitures fixes
  'frites':           { color: '#E8B54D', height: 10 },
  'sauce fromagere':  { color: '#F0B44A', height: 6 },
  'garniture':        { color: '#7FA65C', height: 6 },
  'salade':           { color: '#7FA65C', height: 6 },
  'tomate':           { color: '#C0392B', height: 7 },
  'oignon':           { color: '#EBD9E4', height: 5 },
  'cornichon':        { color: '#8FAF4A', height: 4 },
  'riz':              { color: '#F2EDE0', height: 10 },
  'mais':             { color: '#F2C744', height: 6 },
  'sauce burrito':    { color: '#C4633A', height: 5 },
  'poivron':          { color: '#4E9A4E', height: 5 },
  // Pains
  'pain bas':         { color: '#D9A05B', height: 14 },
  'pain haut':        { color: '#E0AC66', height: 24 },
}

const FALLBACK: Look = { color: '#D8C9A8', height: 8 }

export const lookFor = (name: string) => LOOKS[strip(name)] ?? FALLBACK

export interface ShapeDef {
  /** A wrap encloses the stack; a bun is part of it. */
  shell: 'wrap' | 'bun'
  radius: number | 'pill'
  /** Always present, below the meats. */
  base: string[]
  /** Always present, between the meats and the chosen sauces. */
  mid: string[]
  /** Always present, crowning the stack (the top bun). */
  crown: string[]
}

export const SHAPES: Record<StackShape, ShapeDef> = {
  tacos:   { shell: 'wrap', radius: 28,     base: ['Frites'],      mid: ['Sauce fromagère', 'Garniture'], crown: [] },
  burrito: { shell: 'wrap', radius: 'pill', base: ['Riz', 'Maïs'], mid: ['Sauce burrito', 'Poivron', 'Frites'], crown: [] },
  burger:  { shell: 'bun',  radius: 10,     base: ['Pain bas'],    mid: ['Cheddar', 'Salade', 'Tomate', 'Oignon'], crown: ['Pain haut'] },
}

export interface Layer {
  key: string
  label: string
  look: Look
  image?: string
  /** The top bun — domed rather than a flat slice. */
  crown?: boolean
}

const fixed = (names: string[], prefix: string): Layer[] =>
  names.map((n) => ({ key: `${prefix}-${strip(n)}`, label: n, look: lookFor(n) }))

const fromItems = (items: StackItem[], prefix: string): Layer[] =>
  items.map((it, i) => ({
    key: `${prefix}-${it._id}-${i}`,
    label: it.name.fr,
    look: lookFor(it.name.fr),
    image: it.layerImage,
  }))

/** Bottom-of-the-stack first. */
export function buildLayers(
  shape: StackShape,
  { meats = [], sauces = [], extras = [] }: { meats?: StackItem[]; sauces?: StackItem[]; extras?: StackItem[] }
): Layer[] {
  const def = SHAPES[shape]
  return [
    ...fixed(def.base, 'base'),
    ...fromItems(meats, 'meat'),
    ...fixed(def.mid, 'mid'),
    ...fromItems(sauces, 'sauce'),
    ...fromItems(extras, 'extra'),
    ...fixed(def.crown, 'crown').map((l) => ({ ...l, crown: true })),
  ]
}
