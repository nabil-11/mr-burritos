'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import Autoplay from 'embla-carousel-autoplay'
import { BadgePercent } from 'lucide-react'
import { WEB_PROMO } from '@/lib/promo'
import {
  Carousel,
  CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel'

/**
 * The brand banners. The artwork already carries the name and the taglines, so
 * nothing is laid over it.
 *
 * The slides are different shapes — 1.778, 1.898 and 1.500 — and the images put
 * text hard against an edge ("THE TASTE YOU CAN'T FORGET" top-right on one, the
 * "HIGH PROTEIN · FRESH & NATURAL" bar along the bottom of the other). Cropping
 * to a common frame would eat one or the other, so everything is fitted whole
 * and the frame is padded instead.
 */

type Banner =
  | { kind: 'video'; src: string; alt: string; poster: string }
  | { kind: 'image'; src: string; alt: string }

const BANNERS: Banner[] = [
  {
    kind: 'video',
    src: '/french_tacos_marketing.mp4',
    alt: 'Mr. Burritos — le french tacos en préparation',
    // Stands in before the first frame arrives, and for anyone the video never
    // plays for (reduced motion, Data Saver).
    poster: '/hero-banner.jpg',
  },
  {
    kind: 'image',
    src: '/hero-banner.jpg',
    alt: 'Mr. Burritos — burritos, tacos, burgers, nachos, bowls et frites',
  },
  {
    kind: 'image',
    src: '/hero-banner-2.png',
    alt: 'Mr. Burritos — Good Food, Good Vibes : burritos et bowls aux ingrédients frais',
  },
]

/** A film needs longer on screen than a poster does. */
const DWELL = { video: 14000, image: 6000 }

export default function BannerCarousel() {
  const [api, setApi] = useState<CarouselApi>()
  const [current, setCurrent] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (!api) return
    const onSelect = () => setCurrent(api.selectedScrollSnap())
    onSelect()
    api.on('select', onSelect)
    return () => {
      api.off('select', onSelect)
    }
  }, [api])

  // Play only while the film is the slide on screen. A video still decoding
  // behind two other slides is pure battery drain.
  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    // React does not reliably reflect `muted` onto the property, and an
    // unmuted play() without a user gesture is refused outright on iOS.
    el.muted = true

    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const saveData =
      (navigator as { connection?: { saveData?: boolean } }).connection?.saveData === true

    if (BANNERS[current]?.kind === 'video' && !calm && !saveData) {
      el.play().catch(() => {
        // Refused (iOS Low Power Mode, for one) — the poster stands in.
      })
    } else {
      el.pause()
    }
  }, [current])

  return (
    <div className="relative group">
      {/* Sits outside the Carousel, which clips its own overflow — as a child
          it would be cut off by the rounded corner. */}
      <div className="absolute top-3 right-3 z-20 pointer-events-none">
        <div className="flex items-center gap-2 rounded-full bg-red-600 text-white pl-3 pr-4 py-2 shadow-lg shadow-red-900/30 ring-2 ring-white/20">
          <span className="grid place-items-center w-8 h-8 rounded-full bg-white/15 shrink-0">
            <BadgePercent size={17} />
          </span>
          <span className="leading-none">
            <span className="block font-black text-base tracking-tight">{WEB_PROMO.badge}</span>
            <span className="block text-[10px] font-bold uppercase tracking-wider opacity-90 mt-0.5">
              Commande en ligne
            </span>
          </span>
        </div>
      </div>

      <Carousel
        setApi={setApi}
        opts={{ loop: true }}
        plugins={[
          Autoplay({
            stopOnInteraction: true,
            delay: (snaps) => snaps.map((_, i) => DWELL[BANNERS[i]?.kind ?? 'image']),
          }),
        ]}
        className="rounded-3xl overflow-hidden border border-border shadow-xl shadow-black/10 dark:shadow-black/50 bg-muted"
      >
        <CarouselContent className="ml-0">
          {BANNERS.map((b, i) => (
            <CarouselItem key={b.src} className="pl-0">
              <div className="relative aspect-16/10">
                {b.kind === 'video' ? (
                  <video
                    ref={videoRef}
                    src={b.src}
                    poster={b.poster}
                    muted
                    loop
                    playsInline
                    preload="none"
                    aria-label={b.alt}
                    tabIndex={-1}
                    className="absolute inset-0 w-full h-full object-contain"
                  />
                ) : (
                  <Image
                    src={b.src}
                    alt={b.alt}
                    fill
                    sizes="(max-width: 896px) 100vw, 896px"
                    preload={i === 1}
                    className="object-contain"
                  />
                )}
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>

        <CarouselPrevious className="left-3 bg-black/55 border-white/20 text-white hover:bg-black/75 hover:text-[#F5A800] opacity-0 group-hover:opacity-100 transition-opacity" />
        <CarouselNext className="right-3 bg-black/55 border-white/20 text-white hover:bg-black/75 hover:text-[#F5A800] opacity-0 group-hover:opacity-100 transition-opacity" />
      </Carousel>

      <div className="flex items-center justify-center gap-2 mt-4">
        {BANNERS.map((b, i) => (
          <button
            key={b.src}
            onClick={() => api?.scrollTo(i)}
            aria-label={`Voir la bannière ${i + 1}`}
            className={`h-1.5 rounded-full transition-all duration-400 ${
              i === current
                ? 'w-7 bg-[#F5A800]'
                : 'w-1.5 bg-muted-foreground/40 hover:bg-muted-foreground/60'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
