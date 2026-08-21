'use client'

import { useEffect, useState } from 'react'
import IngredientStack, { StackItem, StackShape } from './IngredientStack'

/**
 * The hero's centrepiece: a wrap that assembles itself layer by layer, then
 * swaps to the next recipe. It shows what the composer does before the visitor
 * has scrolled to it — and, because the stack grows with the meat count, it
 * sells M / XL / XXL without a word of explanation.
 */

interface Recipe {
  shape: StackShape
  name: string
  size: string
  meats: string[]
  sauces: string[]
  extras: string[]
}

const RECIPES: Recipe[] = [
  {
    shape: 'tacos',
    name: 'Tacos',
    size: 'XXL · triple viande',
    meats: ['Escalope panée', 'Cordon Bleu', 'Viande hachée'],
    sauces: ['Algérienne', 'Harissa'],
    extras: ['Fromage Raclette'],
  },
  {
    shape: 'burrito',
    name: 'Burrito',
    size: 'XL · double viande',
    meats: ['Escalope grillée', 'Nuggets'],
    sauces: ['BBQ'],
    extras: ['Mozzarella'],
  },
  {
    shape: 'burger',
    name: 'Burger',
    size: 'Double steak',
    meats: ['Steak', 'Steak'],
    sauces: ['Ketchup'],
    extras: ['Bacon'],
  },
]

/** Beats spent on the finished wrap before moving to the next recipe. */
const HOLD = 3

const asItems = (names: string[], prefix: string): StackItem[] =>
  names.map((n, i) => ({ _id: `${prefix}-${i}`, name: { fr: n } }))

export default function HeroLayers({ width = 240 }: { width?: number }) {
  const [{ r, t }, setBeat] = useState({ r: 0, t: 0 })

  useEffect(() => {
    const id = setInterval(() => {
      setBeat(({ r, t }) => {
        const rec = RECIPES[r]
        const total = rec.meats.length + rec.sauces.length + rec.extras.length
        if (t >= total + HOLD) return { r: (r + 1) % RECIPES.length, t: 0 }
        return { r, t: t + 1 }
      })
    }, 750)
    return () => clearInterval(id)
  }, [])

  const rec = RECIPES[r]
  const clamp = (n: number, max: number) => Math.max(0, Math.min(n, max))

  // Reveal meats first, then sauces, then extras — the composer's own order.
  const shownMeats = clamp(t, rec.meats.length)
  const shownSauces = clamp(t - rec.meats.length, rec.sauces.length)
  const shownExtras = clamp(t - rec.meats.length - rec.sauces.length, rec.extras.length)
  const built = shownMeats + shownSauces + shownExtras
  const totalLayers = rec.meats.length + rec.sauces.length + rec.extras.length

  return (
    <div className="relative flex flex-col items-center">
      {/* Warm glow so the stack reads against the darkened photo behind it */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#F5A800] blur-[90px] opacity-25 pointer-events-none"
        style={{ width: width * 1.4, height: width * 1.4 }}
      />

      <IngredientStack
        key={rec.shape}
        shape={rec.shape}
        width={width}
        meats={asItems(rec.meats.slice(0, shownMeats), `${r}-m`)}
        sauces={asItems(rec.sauces.slice(0, shownSauces), `${r}-s`)}
        extras={asItems(rec.extras.slice(0, shownExtras), `${r}-e`)}
        className="relative z-10"
      />

      {/* Caption */}
      <div className="relative z-10 mt-6 text-center">
        <p className="text-white font-black text-xl leading-none">{rec.name}</p>
        <p className="text-[#F5A800] text-xs font-bold uppercase tracking-widest mt-1.5">
          {rec.size}
        </p>
        <div className="flex items-center justify-center gap-1.5 mt-4">
          {RECIPES.map((x, i) => (
            <span
              key={x.shape}
              className={`h-1.5 rounded-full transition-all duration-500 ${
                i === r ? 'w-6 bg-[#F5A800]' : 'w-1.5 bg-white/30'
              }`}
            />
          ))}
        </div>
        <p className="text-white/30 text-[10px] font-bold tracking-widest mt-3 tabular-nums">
          {built} / {totalLayers} couches
        </p>
      </div>
    </div>
  )
}
