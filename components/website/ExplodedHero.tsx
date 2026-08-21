'use client'

import { useEffect, useRef, useState } from 'react'
import { buildLayers, StackShape, SHAPES } from '@/lib/foodLayers'

/**
 * The hero centrepiece: a wrap that opens part by part, takes a pour of sauce,
 * closes again, then moves to the next recipe — tilting toward the cursor
 * throughout.
 *
 * Everything here is CSS 3D over the shared layer data. There are no 3D models
 * in this project; when real GLBs exist, this component is the thing to
 * replace, not the data underneath it.
 */

interface Recipe {
  shape: StackShape
  name: string
  size: string
  meats: string[]
  sauces: string[]
  extras: string[]
  /** Colour of the sauce that pours during the open phase. */
  pour: string
  pourLabel: string
}

const RECIPES: Recipe[] = [
  {
    shape: 'tacos', name: 'Tacos', size: 'XXL · triple viande',
    // Names chosen to exist both before and after scripts/upgrade-menu.ts, and
    // the repeated Cordon Bleu doubles as a demo of "same viande twice".
    meats: ['Cordon Bleu', 'Viande hachée', 'Cordon Bleu'],
    sauces: ['BBQ'], extras: ['Fromage Raclette'],
    pour: '#7B3F1D', pourLabel: 'Sauce BBQ',
  },
  {
    shape: 'burrito', name: 'Burrito', size: 'XL · double viande',
    meats: ['Cordon Bleu', 'Viande hachée'],
    sauces: ['Mayonnaise'], extras: ['Fromage Gruyère'],
    pour: '#F5EFD6', pourLabel: 'Mayonnaise',
  },
  {
    shape: 'burger', name: 'Burger', size: 'Double steak',
    meats: ['Steak', 'Steak'],
    sauces: ['Ketchup'], extras: ['Bacon'],
    pour: '#C0392B', pourLabel: 'Ketchup',
  },
]

type Phase = 'closed' | 'open' | 'pour' | 'close'

/** The loop, in order. Each entry holds for its duration then advances. */
const SCRIPT: { phase: Phase; ms: number }[] = [
  { phase: 'closed', ms: 1400 },
  { phase: 'open',   ms: 2600 },
  { phase: 'pour',   ms: 2000 },
  { phase: 'close',  ms: 1600 },
]

const asItems = (names: string[], p: string) =>
  names.map((n, i) => ({ _id: `${p}-${i}`, name: { fr: n } }))

export default function ExplodedHero({ width = 260 }: { width?: number }) {
  const [{ r, s }, setStep] = useState({ r: 0, s: 0 })
  const stageRef = useRef<HTMLDivElement>(null)

  // ── The loop ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const id = setTimeout(() => {
      setStep(({ r, s }) =>
        s + 1 >= SCRIPT.length
          ? { r: (r + 1) % RECIPES.length, s: 0 }
          : { r, s: s + 1 }
      )
    }, SCRIPT[s].ms)
    return () => clearTimeout(id)
  }, [r, s])

  // ── Cursor tilt, lerped, written straight to the node ─────────────────────
  useEffect(() => {
    const target = { x: 0, y: 0 }
    const current = { x: 0, y: 0 }
    let raf = 0

    const onMove = (e: MouseEvent) => {
      target.x = e.clientX / window.innerWidth - 0.5
      target.y = e.clientY / window.innerHeight - 0.5
    }

    const tick = () => {
      current.x += (target.x - current.x) * 0.06
      current.y += (target.y - current.y) * 0.06
      if (stageRef.current) {
        stageRef.current.style.transform =
          `rotateX(${-current.y * 14}deg) rotateY(${current.x * 22}deg)`
      }
      raf = requestAnimationFrame(tick)
    }

    window.addEventListener('mousemove', onMove)
    raf = requestAnimationFrame(tick)
    return () => {
      window.removeEventListener('mousemove', onMove)
      cancelAnimationFrame(raf)
    }
  }, [])

  const rec = RECIPES[r]
  const phase = SCRIPT[s].phase
  const isApart = phase === 'open' || phase === 'pour'

  const layers = buildLayers(rec.shape, {
    meats: asItems(rec.meats, 'm'),
    sauces: asItems(rec.sauces, 's'),
    extras: asItems(rec.extras, 'e'),
  })

  const scale = width / 128
  const isWrap = SHAPES[rec.shape].shell === 'wrap'
  const gap = 26 * scale

  // Stack from the bottom up, so index 0 sits lowest.
  const stackHeight =
    layers.reduce((h, l) => h + l.look.height * scale + 3 * scale, 0) + (isWrap ? 24 * scale : 0)

  return (
    <div
      className="relative flex flex-col items-center select-none"
      style={{ perspective: 1100 }}
    >
      {/* Warm glow so the food reads against the darkened photo behind it */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#F5A800] blur-[100px] opacity-25 pointer-events-none"
        style={{ width: width * 1.6, height: width * 1.6 }}
      />

      {/* The tilting stage */}
      <div
        ref={stageRef}
        className="relative z-10"
        style={{
          transformStyle: 'preserve-3d',
          width,
          height: stackHeight + layers.length * gap,
        }}
      >
        <div
          className="absolute left-0 right-0 bottom-0 flex flex-col-reverse items-center transition-all duration-700"
          style={{
            gap: 3 * scale,
            padding: isWrap ? `${12 * scale}px ${10 * scale}px` : 0,
            borderRadius: SHAPES[rec.shape].radius === 'pill' ? 999 : 28 * scale,
            transformStyle: 'preserve-3d',
            background: isWrap && !isApart
              ? 'linear-gradient(160deg, #F3E2BF 0%, #E4CDA0 45%, #D4B98A 100%)'
              : 'transparent',
            boxShadow: !isApart
              ? '0 20px 40px -12px rgba(0,0,0,.6)'
              : 'none',
            transform: phase === 'close' ? 'scaleY(0.94)' : 'scaleY(1)',
          }}
        >
          {layers.map((l, i) => {
            const lift = isApart ? (i + 1) * gap : 0
            const depth = isApart ? 26 : 0
            const tilt = isApart ? (i % 2 ? 4 : -4) : 0
            const inset = (i % 3) * 5 * scale

            return (
              <div
                key={l.key}
                className="relative"
                style={{
                  height: l.look.height * scale,
                  width: `calc(100% - ${inset}px)`,
                  borderRadius: l.crown
                    ? `999px 999px ${8 * scale}px ${8 * scale}px`
                    : 999,
                  background: l.look.color,
                  transformStyle: 'preserve-3d',
                  transform: `translate3d(0, ${-lift}px, ${depth}px) rotateZ(${tilt}deg)`,
                  // Staggered from the top down, so the wrap peels open.
                  transition: `transform 700ms cubic-bezier(.34,1.4,.5,1) ${
                    (isApart ? layers.length - 1 - i : i) * 55
                  }ms, box-shadow 500ms ease`,
                  boxShadow: isApart
                    ? '0 8px 18px -6px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.4)'
                    : 'inset 0 -1px 2px rgba(0,0,0,.18), inset 0 1px 0 rgba(255,255,255,.35)',
                }}
              >
                {/* Label, only while the item is open */}
                <span
                  className="absolute left-full top-1/2 -translate-y-1/2 whitespace-nowrap text-[10px] font-bold tracking-wide text-white/70 transition-all duration-500"
                  style={{
                    marginLeft: 14,
                    opacity: phase === 'open' ? 1 : 0,
                    transform: `translateY(-50%) translateX(${phase === 'open' ? 0 : -8}px)`,
                    transitionDelay: `${(layers.length - 1 - i) * 55 + 200}ms`,
                  }}
                >
                  <span
                    className="inline-block align-middle mr-2"
                    style={{ width: 12, height: 1, background: 'rgba(255,255,255,.35)' }}
                  />
                  {l.label}
                </span>
              </div>
            )
          })}

          {/* The pour: a stream that falls through the opened stack */}
          <div
            className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
            style={{
              bottom: '100%',
              width: 10 * scale,
              height: phase === 'pour' ? stackHeight + layers.length * gap : 0,
              background: `linear-gradient(to bottom, ${rec.pour}, ${rec.pour}dd)`,
              borderRadius: 999,
              opacity: phase === 'pour' ? 1 : 0,
              transition: phase === 'pour'
                ? 'height 900ms cubic-bezier(.4,0,.6,1), opacity 200ms ease'
                : 'height 300ms ease, opacity 400ms ease',
              transformOrigin: 'top',
              zIndex: 40,
            }}
          />
        </div>
      </div>

      {/* Caption */}
      <div className="relative z-10 mt-8 text-center">
        <p className="text-white font-black text-2xl leading-none">{rec.name}</p>
        <p className="text-[#F5A800] text-xs font-bold uppercase tracking-widest mt-2">
          {rec.size}
        </p>
        <p
          className="text-white/40 text-[11px] font-semibold mt-3 h-4 transition-opacity duration-300"
          style={{ opacity: phase === 'pour' ? 1 : 0 }}
        >
          + {rec.pourLabel}
        </p>
        <div className="flex items-center justify-center gap-1.5 mt-3">
          {RECIPES.map((x, i) => (
            <span
              key={x.shape}
              className={`h-1.5 rounded-full transition-all duration-500 ${
                i === r ? 'w-6 bg-[#F5A800]' : 'w-1.5 bg-white/30'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
