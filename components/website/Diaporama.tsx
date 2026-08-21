'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'

/**
 * Crossfading slideshow. The builder never names a dish, so the pictures carry
 * the appetite on their own — one per plat of the category, cycling.
 */
export default function Diaporama({
  images,
  alt,
  interval = 3600,
  sizes = '100vw',
  className = '',
  preload = false,
  showDots = false,
}: {
  images: string[]
  alt: string
  interval?: number
  sizes?: string
  className?: string
  preload?: boolean
  showDots?: boolean
}) {
  const shots = images.filter(Boolean)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (shots.length < 2) return
    const id = setInterval(() => setIndex((i) => (i + 1) % shots.length), interval)
    return () => clearInterval(id)
  }, [shots.length, interval])

  if (shots.length === 0) {
    return <div className={`bg-linear-to-br from-gray-800 to-gray-900 ${className}`} />
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {shots.map((src, i) => (
        <Image
          key={src}
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          preload={preload && i === 0}
          className={`object-cover transition-opacity duration-1000 ease-in-out ${
            i === index ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ))}
      {showDots && shots.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
          {shots.map((src, i) => (
            <span
              key={src}
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
