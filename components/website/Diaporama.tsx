'use client'

import { useEffect, useRef, useState } from 'react'
import Photo from './Photo'

/**
 * Crossfading slideshow. The builder never names a dish, so the pictures carry
 * the appetite on their own — one per plat of the category, cycling.
 *
 * Only the shot on screen and the next one are mounted: a card with six
 * pictures used to download all six on arrival. It also holds still while it
 * is off screen, and for visitors who asked for reduced motion.
 */
export default function Diaporama({
  images,
  alt,
  interval = 4500,
  sizes = '100vw',
  className = '',
  imageClassName = 'object-cover',
  preload = false,
  showDots = false,
}: {
  images: string[]
  alt: string
  interval?: number
  sizes?: string
  className?: string
  imageClassName?: string
  preload?: boolean
  showDots?: boolean
}) {
  const shots = images.filter(Boolean)
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = rootRef.current
    if (!el || shots.length < 2) return
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.25 })
    io.observe(el)
    return () => io.disconnect()
  }, [shots.length])

  useEffect(() => {
    if (shots.length < 2 || !visible) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = setInterval(() => setIndex((i) => (i + 1) % shots.length), interval)
    return () => clearInterval(id)
  }, [shots.length, interval, visible])

  if (shots.length === 0) {
    return <div className={`bg-linear-to-br from-gray-800 to-gray-900 ${className}`} />
  }

  // The previous shot stays mounted while it fades out; the next one is
  // already loading so it never fades in blank.
  const mounted = new Set([index, (index + 1) % shots.length, (index - 1 + shots.length) % shots.length])

  // No `relative` on the root: Tailwind emits `.relative` after `.absolute`, so
  // it would beat the `absolute inset-0` callers pass in and collapse this box
  // to zero height — every child is absolutely positioned. Positioning is the
  // caller's job.
  return (
    <div ref={rootRef} className={`overflow-hidden ${className}`}>
      {shots.map((src, i) =>
        mounted.has(i) ? (
          <Photo
            key={`${src}-${i}`}
            src={src}
            alt={i === index ? alt : ''}
            fill
            sizes={sizes}
            preload={preload && i === 0}
            className={`${imageClassName} transition-opacity duration-1000 ease-in-out ${
              i === index ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ) : null
      )}
      {showDots && shots.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
          {shots.map((src, i) => (
            <span
              key={`${src}-${i}`}
              className={`h-1.5 rounded-full transition-all duration-500 ${
                i === index ? 'w-5 bg-[#F5A800]' : 'w-1.5 bg-white/50'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
