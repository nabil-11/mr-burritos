'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import Autoplay from 'embla-carousel-autoplay'
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
 * The two images are different shapes — 1.898 and 1.500 — and both put text
 * hard against an edge ("THE TASTE YOU CAN'T FORGET" top-right on one, the
 * "HIGH PROTEIN · FRESH & NATURAL" bar along the bottom of the other. Cropping
 * to a common frame would eat one or the other, so they are fitted whole and
 * the frame is padded instead.
 */

const BANNERS = [
  {
    src: '/hero-banner.jpg',
    alt: 'Mr. Burritos — burritos, tacos, burgers, nachos, bowls et frites',
  },
  {
    src: '/hero-banner-2.png',
    alt: 'Mr. Burritos — Good Food, Good Vibes : burritos et bowls aux ingrédients frais',
  },
]

export default function BannerCarousel() {
  const [api, setApi] = useState<CarouselApi>()
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    if (!api) return
    const onSelect = () => setCurrent(api.selectedScrollSnap())
    onSelect()
    api.on('select', onSelect)
    return () => {
      api.off('select', onSelect)
    }
  }, [api])

  return (
    <div className="relative group">
      <Carousel
        setApi={setApi}
        opts={{ loop: true }}
        plugins={[Autoplay({ delay: 6000, stopOnInteraction: true })]}
        className="rounded-3xl overflow-hidden border border-border shadow-xl shadow-black/10 dark:shadow-black/50 bg-muted"
      >
        <CarouselContent className="ml-0">
          {BANNERS.map((b) => (
            <CarouselItem key={b.src} className="pl-0">
              <div className="relative aspect-16/10">
                <Image
                  src={b.src}
                  alt={b.alt}
                  fill
                  sizes="(max-width: 896px) 100vw, 896px"
                  preload={b.src === BANNERS[0].src}
                  className="object-contain"
                />
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
              i === current ? 'w-7 bg-[#F5A800]' : 'w-1.5 bg-muted-foreground/40 hover:bg-muted-foreground/60'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
