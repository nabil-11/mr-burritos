'use client'

import Image from 'next/image'
import { useEffect, useRef } from 'react'

/**
 * The hero's picture: the cheese-pull tacos film, over a still of its best
 * frame.
 *
 * The still is what everyone sees first — it is a normal optimised image, so
 * the hero is never a black box while 9 MB of video arrive. The film only
 * starts where it costs nothing to refuse: not for Data Saver, not for anyone
 * who asked for less motion, and it pauses whenever the hero is scrolled away.
 */
export default function HeroMedia() {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // React does not reliably reflect `muted` onto the property, and an
    // unmuted play() without a user gesture is refused outright on iOS.
    el.muted = true
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const saveData = (navigator as { connection?: { saveData?: boolean } }).connection?.saveData === true
    if (calm || saveData) return

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.play().catch(() => {
            // Refused (iOS Low Power Mode, for one): the still stays.
          })
        } else {
          el.pause()
        }
      },
      { threshold: 0.2 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div className="absolute inset-0" aria-hidden>
      <Image
        src="/hero-tacos.jpg"
        alt=""
        fill
        priority
        sizes="(max-width: 1024px) 100vw, 720px"
        className="object-cover object-[58%_center]"
      />
      <video
        ref={ref}
        src="/french_tacos_marketing.mp4"
        muted
        loop
        playsInline
        preload="none"
        tabIndex={-1}
        className="absolute inset-0 w-full h-full object-cover object-[58%_center]"
      />
    </div>
  )
}
