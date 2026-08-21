'use client'

import Image from 'next/image'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Check, Plus, Minus, ArrowLeft, ShoppingBag, Sparkles } from 'lucide-react'
import { useCart, CartSupplement } from '@/contexts/CartContext'
import { groupSupplements, meatQuotaFor, configuredPrice } from '@/lib/supplements'
import Diaporama from './Diaporama'

export interface BuilderSupplement extends CartSupplement {
  type: string
  image?: string
  meatCount?: number
}

export interface BuilderCategory {
  _id: string
  slug: string
  name: { fr: string }
  emoji: string
  gallery: string[]
  base: {
    _id: string
    name: { ar: string; fr: string }
    description: { fr: string }
    price: number
    image: string
    supplements: BuilderSupplement[]
  }
}

type StepKey = 'size' | 'viande' | 'sauce' | 'extra' | 'recap'

const STEP_LABELS: Record<StepKey, string> = {
  size: 'Taille',
  viande: 'Viandes',
  sauce: 'Sauces',
  extra: 'Extras',
  recap: 'Panier',
}

/** "Taille XL" reads as clutter once it sits under a "Taille" heading. */
const shortSize = (fr: string) => fr.replace(/^Taille\s+/i, '')

const meatLabel = (n: number) =>
  n === 1 ? '1 viande' : n === 2 ? '2 viandes · double' : `${n} viandes · triple`

export default function ProductBuilder({ categories }: { categories: BuilderCategory[] }) {
  const { addItem } = useCart()

  const [category, setCategory] = useState<BuilderCategory | null>(null)
  const [stepIndex, setStepIndex] = useState(0)
  const [size, setSize] = useState<BuilderSupplement | null>(null)
  const [meats, setMeats] = useState<Record<string, number>>({})
  const [sauces, setSauces] = useState<BuilderSupplement[]>([])
  const [extras, setExtras] = useState<BuilderSupplement[]>([])
  const [quantity, setQuantity] = useState(1)

  const groups = useMemo(
    () => groupSupplements(category?.base.supplements ?? []),
    [category]
  )

  // Only the layers this category actually offers become steps.
  const steps = useMemo<StepKey[]>(() => {
    if (!category) return []
    const s: StepKey[] = []
    if (groups.sizes.length) s.push('size')
    if (groups.viandes.length) s.push('viande')
    if (groups.sauces.length) s.push('sauce')
    if (groups.extras.length) s.push('extra')
    s.push('recap')
    return s
  }, [category, groups])

  const step = steps[stepIndex]
  const quota = meatQuotaFor(size ?? undefined)
  const meatTotal = Object.values(meats).reduce((a, b) => a + b, 0)

  const chosenMeats = useMemo(
    () => groups.viandes.flatMap((v) => Array.from({ length: meats[v._id] ?? 0 }, () => v)),
    [groups.viandes, meats]
  )

  const selected = useMemo<BuilderSupplement[]>(
    () => [...(size ? [size] : []), ...chosenMeats, ...sauces, ...extras],
    [size, chosenMeats, sauces, extras]
  )

  const unitPrice = category ? configuredPrice(category.base.price, selected) : 0
  const total = unitPrice * quantity

  const reset = () => {
    setStepIndex(0)
    setSize(null)
    setMeats({})
    setSauces([])
    setExtras([])
    setQuantity(1)
  }

  const openCategory = (cat: BuilderCategory) => {
    reset()
    setCategory(cat)
    const firstSize = groupSupplements(cat.base.supplements).sizes[0]
    if (firstSize) setSize(firstSize)
  }

  const pickSize = (s: BuilderSupplement) => {
    setSize(s)
    // Shrinking the size must not leave more viandes selected than allowed.
    const nextQuota = meatQuotaFor(s)
    setMeats((prev) => {
      let budget = nextQuota
      const next: Record<string, number> = {}
      for (const [id, n] of Object.entries(prev)) {
        const keep = Math.min(n, budget)
        if (keep > 0) next[id] = keep
        budget -= keep
      }
      return next
    })
  }

  const bumpMeat = (id: string, delta: number) =>
    setMeats((prev) => {
      const current = prev[id] ?? 0
      const next = current + delta
      if (next < 0) return prev
      const used = Object.values(prev).reduce((a, b) => a + b, 0)
      if (delta > 0 && used >= quota) return prev
      const copy = { ...prev }
      if (next === 0) delete copy[id]
      else copy[id] = next
      return copy
    })

  /** With a single viande to give, tapping swaps the choice rather than counting. */
  const pickSingleMeat = (id: string) => setMeats({ [id]: 1 })

  const toggleIn = (
    list: BuilderSupplement[],
    setList: (v: BuilderSupplement[]) => void,
    sup: BuilderSupplement
  ) =>
    setList(
      list.find((s) => s._id === sup._id)
        ? list.filter((s) => s._id !== sup._id)
        : [...list, sup]
    )

  const canContinue = step !== 'viande' || meatTotal === quota

  const confirm = () => {
    if (!category) return
    for (let i = 0; i < quantity; i++) {
      addItem({
        productId: category.base._id,
        name: category.base.name,
        price: category.base.price,
        image: category.base.image,
        quantity: 1,
        selectedSupplements: selected as CartSupplement[],
        notes: '',
      })
    }
    toast.success(
      `${quantity}× ${category.name.fr} ${size ? shortSize(size.name.fr) : ''} ajouté au panier !`
    )
    setCategory(null)
    reset()
  }

  // ── Layer 0 — pick a category ─────────────────────────────────────────────
  if (!category) {
    return (
      <div className="grid sm:grid-cols-2 gap-5">
        {categories.map((cat) => (
          <button
            key={cat._id}
            onClick={() => openCategory(cat)}
            className="group relative h-64 sm:h-80 rounded-3xl overflow-hidden text-left shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-1"
          >
            <Diaporama
              images={cat.gallery}
              alt={cat.name.fr}
              sizes="(max-width: 640px) 100vw, 50vw"
              className="absolute inset-0"
              preload
            />
            <div className="absolute inset-0 bg-linear-to-t from-black via-black/50 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6">
              <span className="inline-flex items-center gap-1.5 bg-[#F5A800] text-black text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest mb-3">
                <Sparkles size={11} /> À composer
              </span>
              <h3 className="text-white font-black text-3xl leading-none flex items-center gap-2">
                <span>{cat.emoji}</span> {cat.name.fr}
              </h3>
              <p className="text-white/60 text-sm mt-2">{cat.base.description.fr}</p>
              <p className="text-[#F5A800] font-black mt-3 text-sm">
                Dès {cat.base.price.toFixed(2)} DT
                <span className="text-white/40 font-semibold"> · M, XL ou XXL</span>
              </p>
            </div>
          </button>
        ))}
      </div>
    )
  }

  // ── Layers 1..n — configure ───────────────────────────────────────────────
  return (
    <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">

      {/* Header: the category, still shown as pictures rather than dish names */}
      <div className="relative h-40 sm:h-48">
        <Diaporama
          images={category.gallery}
          alt={category.name.fr}
          sizes="(max-width: 1024px) 100vw, 900px"
          className="absolute inset-0"
        />
        <div className="absolute inset-0 bg-linear-to-r from-black/90 via-black/60 to-black/20" />
        <div className="relative h-full flex items-center gap-4 px-5 sm:px-8">
          <button
            onClick={() => { setCategory(null); reset() }}
            className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition-colors shrink-0"
            aria-label="Changer de catégorie"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0">
            <h3 className="text-white font-black text-2xl sm:text-3xl leading-none flex items-center gap-2">
              <span>{category.emoji}</span> {category.name.fr}
            </h3>
            <p className="text-white/50 text-xs sm:text-sm mt-1.5 truncate">
              {size ? `${shortSize(size.name.fr)} · ${meatLabel(quota)}` : category.base.description.fr}
            </p>
          </div>
        </div>
      </div>

      {/* Step rail — a completed layer stays clickable so nothing is a dead end */}
      <div className="flex items-center gap-1 px-5 sm:px-8 py-4 border-b overflow-x-auto">
        {steps.map((key, i) => {
          const done = i < stepIndex
          const current = i === stepIndex
          return (
            <button
              key={key}
              onClick={() => i <= stepIndex && setStepIndex(i)}
              disabled={i > stepIndex}
              className={`flex items-center gap-1.5 shrink-0 transition-colors ${
                i <= stepIndex ? 'cursor-pointer' : 'cursor-default'
              }`}
            >
              <span
                className={`w-6 h-6 rounded-full grid place-items-center text-[10px] font-black transition-all ${
                  current ? 'bg-[#F5A800] text-black scale-110'
                  : done ? 'bg-[#1A1A1A] text-white'
                  : 'bg-gray-100 text-gray-400'
                }`}
              >
                {done ? <Check size={11} /> : i + 1}
              </span>
              <span className={`text-xs font-bold ${current ? 'text-[#1A1A1A]' : 'text-gray-400'}`}>
                {STEP_LABELS[key]}
              </span>
              {i < steps.length - 1 && <span className="w-4 sm:w-8 h-px bg-gray-200 mx-1" />}
            </button>
          )
        })}
      </div>

      {/* Layer body */}
      <div className="p-5 sm:p-8 min-h-72">

        {step === 'size' && (
          <div className="grid grid-cols-3 gap-3">
            {groups.sizes.map((s) => {
              const active = size?._id === s._id
              return (
                <button
                  key={s._id}
                  onClick={() => pickSize(s)}
                  className={`p-4 sm:p-5 rounded-2xl border-2 transition-all duration-200 text-center ${
                    active
                      ? 'border-[#F5A800] bg-[#F5A800]/10 shadow-md scale-[1.02]'
                      : 'border-gray-200 hover:border-[#F5A800]/50 bg-white'
                  }`}
                >
                  <p className={`font-black text-2xl sm:text-3xl ${active ? 'text-[#F5A800]' : 'text-[#1A1A1A]'}`}>
                    {shortSize(s.name.fr)}
                  </p>
                  <p className="text-[11px] font-bold text-gray-500 mt-1.5">
                    {meatLabel(s.meatCount ?? 1)}
                  </p>
                  <p className={`text-sm font-black mt-2 ${active ? 'text-[#1A1A1A]' : 'text-gray-400'}`}>
                    {configuredPrice(category.base.price, [s]).toFixed(2)} DT
                  </p>
                </button>
              )
            })}
          </div>
        )}

        {step === 'viande' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-bold text-[#1A1A1A]">
                Choisissez {quota === 1 ? 'votre viande' : `vos ${quota} viandes`}
              </p>
              <span className={`text-xs font-black px-3 py-1 rounded-full ${
                meatTotal === quota ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {meatTotal} / {quota}
              </span>
            </div>
            {quota > 1 && (
              <p className="text-xs text-gray-400 mb-4">
                Vous pouvez prendre deux fois la même — un {shortSize(size?.name.fr ?? '')} double escalope, par exemple.
              </p>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {groups.viandes.map((v) => {
                const count = meats[v._id] ?? 0
                const active = count > 0
                return (
                  <div
                    key={v._id}
                    className={`rounded-2xl border-2 overflow-hidden transition-all ${
                      active ? 'border-[#F5A800] shadow-md' : 'border-gray-200'
                    }`}
                  >
                    <button
                      onClick={() => (quota === 1 ? pickSingleMeat(v._id) : bumpMeat(v._id, 1))}
                      disabled={quota > 1 && meatTotal >= quota && count === 0}
                      className="relative block w-full h-24 sm:h-28 bg-gray-100 disabled:opacity-40 transition-opacity"
                    >
                      {v.image ? (
                        <Image src={v.image} alt={v.name.fr} fill sizes="(max-width: 640px) 50vw, 220px" className="object-cover" />
                      ) : (
                        <span className="absolute inset-0 grid place-items-center text-4xl">🥩</span>
                      )}
                      {count > 0 && (
                        <span className="absolute top-2 right-2 bg-[#F5A800] text-black text-xs font-black w-7 h-7 rounded-full grid place-items-center shadow-md">
                          {quota === 1 ? <Check size={13} /> : `×${count}`}
                        </span>
                      )}
                    </button>
                    <div className="p-2.5 flex items-center justify-between gap-2">
                      <p className="text-xs font-bold text-[#1A1A1A] leading-tight">{v.name.fr}</p>
                      {quota > 1 && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => bumpMeat(v._id, -1)}
                            disabled={count === 0}
                            className="w-6 h-6 rounded-md bg-gray-100 hover:bg-gray-200 disabled:opacity-30 grid place-items-center transition-colors"
                            aria-label={`Retirer ${v.name.fr}`}
                          >
                            <Minus size={11} />
                          </button>
                          <button
                            onClick={() => bumpMeat(v._id, 1)}
                            disabled={meatTotal >= quota}
                            className="w-6 h-6 rounded-md bg-[#1A1A1A] text-white hover:bg-[#F5A800] hover:text-black disabled:opacity-30 grid place-items-center transition-colors"
                            aria-label={`Ajouter ${v.name.fr}`}
                          >
                            <Plus size={11} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {step === 'sauce' && (
          <div>
            <p className="text-sm font-bold text-[#1A1A1A] mb-1">Vos sauces</p>
            <p className="text-xs text-gray-400 mb-4">Offertes — prenez-en autant que vous voulez.</p>
            <div className="flex flex-wrap gap-2">
              {groups.sauces.map((s) => {
                const active = !!sauces.find((x) => x._id === s._id)
                return (
                  <button
                    key={s._id}
                    onClick={() => toggleIn(sauces, setSauces, s)}
                    className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full border-2 text-sm font-semibold transition-all ${
                      active
                        ? 'bg-[#F5A800] border-[#F5A800] text-black shadow-md'
                        : 'border-gray-200 text-gray-600 hover:border-[#F5A800]/60 bg-white'
                    }`}
                  >
                    {active && <Check size={13} />} {s.name.fr}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {step === 'extra' && (
          <div>
            <p className="text-sm font-bold text-[#1A1A1A] mb-1">Un petit extra ?</p>
            <p className="text-xs text-gray-400 mb-4">Optionnel — ajouté au prix.</p>
            <div className="flex flex-wrap gap-2">
              {groups.extras.map((s) => {
                const active = !!extras.find((x) => x._id === s._id)
                return (
                  <button
                    key={s._id}
                    onClick={() => toggleIn(extras, setExtras, s)}
                    className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full border-2 text-sm font-semibold transition-all ${
                      active
                        ? 'bg-[#F5A800] border-[#F5A800] text-black shadow-md'
                        : 'border-gray-200 text-gray-600 hover:border-[#F5A800]/60 bg-white'
                    }`}
                  >
                    {active && <Check size={13} />} {s.name.fr}
                    <span className={`font-black text-xs ${active ? 'text-black/60' : 'text-[#F5A800]'}`}>
                      +{s.price} DT
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {step === 'recap' && (
          <div className="space-y-4">
            <p className="text-sm font-bold text-[#1A1A1A]">Votre {category.name.fr}</p>
            <dl className="text-sm divide-y rounded-2xl border overflow-hidden">
              <div className="flex justify-between gap-4 px-4 py-3 bg-gray-50">
                <dt className="text-gray-500 font-semibold">Base</dt>
                <dd className="font-bold text-[#1A1A1A]">{category.base.price.toFixed(2)} DT</dd>
              </div>
              {size && (
                <div className="flex justify-between gap-4 px-4 py-3">
                  <dt className="text-gray-500 font-semibold">Taille</dt>
                  <dd className="font-bold text-[#1A1A1A]">
                    {shortSize(size.name.fr)}
                    {size.price > 0 && <span className="text-[#F5A800]"> +{size.price} DT</span>}
                  </dd>
                </div>
              )}
              {chosenMeats.length > 0 && (
                <div className="flex justify-between gap-4 px-4 py-3">
                  <dt className="text-gray-500 font-semibold">Viandes</dt>
                  <dd className="font-bold text-[#1A1A1A] text-right">
                    {groups.viandes
                      .filter((v) => meats[v._id])
                      .map((v) => (meats[v._id] > 1 ? `${meats[v._id]}× ${v.name.fr}` : v.name.fr))
                      .join(', ')}
                  </dd>
                </div>
              )}
              {sauces.length > 0 && (
                <div className="flex justify-between gap-4 px-4 py-3">
                  <dt className="text-gray-500 font-semibold">Sauces</dt>
                  <dd className="font-bold text-[#1A1A1A] text-right">{sauces.map((s) => s.name.fr).join(', ')}</dd>
                </div>
              )}
              {extras.length > 0 && (
                <div className="flex justify-between gap-4 px-4 py-3">
                  <dt className="text-gray-500 font-semibold">Extras</dt>
                  <dd className="font-bold text-[#1A1A1A] text-right">
                    {extras.map((s) => s.name.fr).join(', ')}
                    <span className="text-[#F5A800]"> +{extras.reduce((t, s) => t + s.price, 0)} DT</span>
                  </dd>
                </div>
              )}
            </dl>

            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-bold text-gray-500">Quantité</span>
              <div className="flex items-center gap-1 bg-gray-50 border rounded-xl p-1">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="p-2 rounded-lg hover:bg-white transition-colors"
                  aria-label="Réduire la quantité"
                >
                  <Minus size={14} />
                </button>
                <span className="w-8 text-center font-black text-[#1A1A1A]">{quantity}</span>
                <button
                  onClick={() => setQuantity((q) => q + 1)}
                  className="p-2 rounded-lg hover:bg-white transition-colors"
                  aria-label="Augmenter la quantité"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sticky footer: running total + navigation */}
      <div className="flex items-center gap-3 border-t px-5 sm:px-8 py-4 bg-gray-50/60">
        {stepIndex > 0 && (
          <button
            onClick={() => setStepIndex((i) => i - 1)}
            className="p-3 rounded-xl border bg-white hover:bg-gray-100 transition-colors shrink-0"
            aria-label="Étape précédente"
          >
            <ArrowLeft size={16} />
          </button>
        )}
        <div className="leading-none mr-auto">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total</p>
          <p className="font-black text-[#F5A800] text-xl mt-1">{total.toFixed(2)} DT</p>
        </div>
        {step === 'recap' ? (
          <button
            onClick={confirm}
            className="flex items-center gap-2 bg-[#F5A800] hover:bg-[#FF6B00] text-black font-black px-7 py-3.5 rounded-xl transition-all text-sm hover:scale-[1.02] active:scale-[0.98]"
          >
            <ShoppingBag size={16} /> Ajouter au panier
          </button>
        ) : (
          <button
            onClick={() => setStepIndex((i) => i + 1)}
            disabled={!canContinue}
            className="flex items-center gap-2 bg-[#1A1A1A] hover:bg-[#F5A800] text-white hover:text-black disabled:opacity-40 disabled:hover:bg-[#1A1A1A] disabled:hover:text-white font-black px-7 py-3.5 rounded-xl transition-all text-sm"
          >
            {canContinue ? 'Continuer' : `Encore ${quota - meatTotal}`}
          </button>
        )}
      </div>
    </div>
  )
}
