'use client'

import Image from 'next/image'

/**
 * A cross-section of a composed item: every ingredient becomes a layer, so
 * "XL double viande" is something you see rather than read.
 *
 * Shapes differ in how they are held together — a tacos and a burrito sit
 * inside a tortilla shell, a burger stacks between two buns — and in the
 * layers that are always there regardless of what the customer picks.
 *
 * Each ingredient falls back to a tinted bar. Drop a transparent PNG on the
 * supplement's `layerImage` field and it renders in place of the bar with no
 * layout change — the shapes are placeholders, the stack is not.
 */

export interface StackItem {
  _id: string
  name: { fr: string }
  layerImage?: string
}

export type StackShape = 'tacos' | 'burrito' | 'burger'

interface Look {
  color: string
  /** Layer thickness in px at the default width — meats are chunky, sauces are drizzles. */
  height: number
}

const strip = (s: string) =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()

const LOOKS: Record<string, Look> = {
  // Viandes
  'escalope panee':   { color: '#CE9350', height: 14 },
  'escalope grillee': { color: '#A96B3C', height: 14 },
  'cordon bleu':      { color: '#D9A863', height: 15 },
  'nuggets':          { color: '#E2A93F', height: 13 },
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
  // Extras
  'oeuf':             { color: '#F8E9A6', height: 8 },
  'fromage slice':    { color: '#F3C44F', height: 6 },
  'mozzarella':       { color: '#F7F2E4', height: 8 },
  'fromage gruyere':  { color: '#E9CA7C', height: 7 },
  'fromage raclette': { color: '#F1D88E', height: 7 },
  'bacon':            { color: '#A0522D', height: 7 },
  'cheddar':          { color: '#F0A93C', height: 6 },
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

const lookFor = (name: string) => LOOKS[strip(name)] ?? FALLBACK

interface ShapeDef {
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

const SHAPES: Record<StackShape, ShapeDef> = {
  tacos:   { shell: 'wrap', radius: 28,     base: ['Frites'],       mid: ['Sauce fromagère', 'Garniture'], crown: [] },
  burrito: { shell: 'wrap', radius: 'pill', base: ['Riz', 'Maïs'],  mid: ['Sauce burrito', 'Poivron', 'Frites'], crown: [] },
  burger:  { shell: 'bun',  radius: 10,     base: ['Pain bas'],     mid: ['Cheddar', 'Salade', 'Tomate', 'Oignon'], crown: ['Pain haut'] },
}

interface Layer {
  key: string
  label: string
  look: Look
  image?: string
  crown?: boolean
}

const fixed = (names: string[], prefix: string): Layer[] =>
  names.map((n) => ({ key: `${prefix}-${strip(n)}`, label: n, look: lookFor(n) }))

export default function IngredientStack({
  shape = 'tacos',
  meats,
  sauces,
  extras,
  compact = false,
  width: widthProp,
  className = '',
}: {
  shape?: StackShape
  meats: StackItem[]
  sauces: StackItem[]
  extras: StackItem[]
  compact?: boolean
  /** Overrides the default width; layer thickness scales with it. */
  width?: number
  className?: string
}) {
  const def = SHAPES[shape]

  // Bottom of the stack first — the container reverses to build upward.
  const layers: Layer[] = [
    ...fixed(def.base, 'base'),
    ...meats.map((m, i) => ({
      key: `meat-${m._id}-${i}`,
      label: m.name.fr,
      look: lookFor(m.name.fr),
      image: m.layerImage,
    })),
    ...fixed(def.mid, 'mid'),
    ...sauces.map((s) => ({
      key: `sauce-${s._id}`,
      label: s.name.fr,
      look: lookFor(s.name.fr),
      image: s.layerImage,
    })),
    ...extras.map((e) => ({
      key: `extra-${e._id}`,
      label: e.name.fr,
      look: lookFor(e.name.fr),
      image: e.layerImage,
    })),
    ...fixed(def.crown, 'crown').map((l) => ({ ...l, crown: true })),
  ]

  const width = widthProp ?? (compact ? 88 : 128)
  // Thickness tracks width so a hero-sized stack doesn't look like wafers.
  const scale = width / 128
  const isWrap = def.shell === 'wrap'

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div
        className="relative flex flex-col-reverse items-center transition-all duration-500"
        style={{
          width,
          gap: 3 * scale,
          padding: isWrap ? `${12 * scale}px ${10 * scale}px` : 0,
          borderRadius: def.radius === 'pill' ? 999 : def.radius * scale,
          // A wrap is a warm tortilla with a lit top edge; a bun stack is bare.
          background: isWrap
            ? 'linear-gradient(160deg, #F3E2BF 0%, #E4CDA0 45%, #D4B98A 100%)'
            : undefined,
          boxShadow: isWrap
            ? 'inset 0 1px 0 rgba(255,255,255,.6), 0 10px 25px -8px rgba(0,0,0,.45)'
            : '0 10px 25px -8px rgba(0,0,0,.45)',
        }}
      >
        {layers.map((l, i) => {
          // Deterministic width jitter keeps it organic without re-render churn.
          const inset = (i % 3) * 5 * scale
          return (
            <div
              key={l.key}
              title={l.label}
              className="relative animate-in fade-in slide-in-from-bottom-1 duration-300 overflow-hidden"
              style={{
                height: l.look.height * scale,
                width: `calc(100% - ${inset}px)`,
                // The top bun domes; everything else is a rounded slice.
                borderRadius: l.crown ? `${999}px ${999}px ${8 * scale}px ${8 * scale}px` : 999,
                background: l.image ? undefined : l.look.color,
                boxShadow: 'inset 0 -1px 2px rgba(0,0,0,.18), inset 0 1px 0 rgba(255,255,255,.35)',
              }}
            >
              {l.image && (
                <Image src={l.image} alt={l.label} fill sizes="200px" className="object-cover" />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
