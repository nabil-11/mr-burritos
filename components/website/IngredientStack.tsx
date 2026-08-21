'use client'

import Image from 'next/image'
import { buildLayers, SHAPES, StackItem, StackShape } from '@/lib/foodLayers'

/**
 * A cross-section of the item being composed: every ingredient the customer
 * picks becomes a layer, so "XL double viande" is something you see rather
 * than read. Layer colours and order come from lib/foodLayers, shared with the
 * home page hero.
 *
 * Each ingredient falls back to a tinted bar. Drop a transparent PNG on the
 * supplement's `layerImage` field and it renders in place of the bar with no
 * layout change — the shapes are placeholders, the stack is not.
 */

export type { StackItem, StackShape }

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
  const layers = buildLayers(shape, { meats, sauces, extras })

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
                borderRadius: l.crown ? `999px 999px ${8 * scale}px ${8 * scale}px` : 999,
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
