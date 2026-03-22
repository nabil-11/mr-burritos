'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel'
import Autoplay from 'embla-carousel-autoplay'
import { useRef } from 'react'

const slides = [
  {
    id: 1,
    image: '/banner.png',
    badge: 'Nouveau',
    title: 'CRUNCH\nMAKES\nEVERYTHING\nBETTER',
    subtitle: 'Tacos · Burritos · Snacks',
    cta: { label: 'Commander maintenant', href: '/menu' },
    cta2: { label: 'Voir le menu', href: '/menu' },
    overlay: 'from-black/80 via-black/50 to-transparent',
  },
  {
    id: 2,
    image: '/banner.png',
    badge: 'Best-seller',
    title: 'TACOS\nCRISPY\n10.9 DT',
    subtitle: 'Sauce fromagère · Garniture · Frites',
    cta: { label: 'Commander un Tacos', href: '/menu?category=tacos' },
    cta2: { label: 'Voir tous les Tacos', href: '/menu?category=tacos' },
    overlay: 'from-[#1A1A1A]/90 via-black/40 to-transparent',
  },
  {
    id: 3,
    image: '/banner.png',
    badge: 'Populaire',
    title: 'BURRITO\nBEEF\n13.9 DT',
    subtitle: 'Viande hachée · Riz · Maïs · Sauce burrito',
    cta: { label: 'Commander un Burrito', href: '/menu?category=burritos' },
    cta2: { label: 'Voir les Burritos', href: '/menu?category=burritos' },
    overlay: 'from-black/85 via-black/45 to-transparent',
  },
]

export default function HeroCarousel() {
  const plugin = useRef(Autoplay({ delay: 5000, stopOnInteraction: true }))

  return (
    <div className="relative w-full pt-20">
      <Carousel
        plugins={[plugin.current]}
        opts={{ loop: true }}
        className="w-full"
        onMouseEnter={plugin.current.stop}
        onMouseLeave={plugin.current.reset}
      >
        <CarouselContent>
          {slides.map((slide) => (
            <CarouselItem key={slide.id}>
              <div className="relative h-[90vh] min-h-[560px] w-full overflow-hidden">
                {/* Background image */}
                <Image
                  src={slide.image}
                  alt="Mr. Burritos"
                  fill
                  className="object-cover object-center"
                  priority
                />

                {/* Gradient overlay */}
                <div className={`absolute inset-0 bg-gradient-to-r ${slide.overlay}`} />

                {/* Content */}
                <div className="absolute inset-0 flex items-center">
                  <div className="max-w-7xl mx-auto px-6 sm:px-10 w-full">
                    <div className="max-w-xl">
                      {/* Badge */}
                      <span className="inline-block bg-[#F5A800] text-black text-xs font-black px-3 py-1 rounded-full uppercase tracking-widest mb-5">
                        {slide.badge}
                      </span>

                      {/* Title */}
                      <h1 className="text-5xl sm:text-6xl md:text-7xl font-black text-white leading-none mb-4 whitespace-pre-line">
                        {slide.title}
                      </h1>

                      {/* Subtitle */}
                      <p className="text-white/70 text-lg mb-8">{slide.subtitle}</p>

                      {/* CTAs */}
                      <div className="flex flex-wrap gap-3">
                        <Link href={slide.cta.href}
                          className="bg-[#F5A800] hover:bg-[#FF6B00] text-black font-black px-6 py-3.5 rounded-full transition-all hover:scale-105 shadow-lg text-sm">
                          {slide.cta.label}
                        </Link>
                        <Link href={slide.cta2.href}
                          className="border-2 border-white/40 hover:border-[#F5A800] text-white hover:text-[#F5A800] font-bold px-6 py-3.5 rounded-full transition-all text-sm backdrop-blur-sm">
                          {slide.cta2.label}
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Slide indicator dots */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
                  {slides.map((s) => (
                    <div key={s.id}
                      className={`h-1.5 rounded-full transition-all ${s.id === slide.id ? 'w-8 bg-[#F5A800]' : 'w-1.5 bg-white/40'}`}
                    />
                  ))}
                </div>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>

        {/* Navigation arrows */}
        <CarouselPrevious className="left-4 bg-black/30 border-white/20 text-white hover:bg-[#F5A800] hover:text-black hover:border-[#F5A800] transition-all" />
        <CarouselNext className="right-4 bg-black/30 border-white/20 text-white hover:bg-[#F5A800] hover:text-black hover:border-[#F5A800] transition-all" />
      </Carousel>
    </div>
  )
}
