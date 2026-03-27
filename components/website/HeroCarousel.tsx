'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel'
import Autoplay from 'embla-carousel-autoplay'
import { useRef, useState, useEffect } from 'react'
import TrackOrderBar from './TrackOrderBar'

const slides = [
  {
    id: 1,
    image: '/banner.png',
    title: 'Tacos Croustillants',
    subtitle: 'Découvrez nos tacos incontournabes',
    ctaPrimary: { label: 'Commander', href: '/menu?category=tacos' },
    ctaSecondary: { label: 'Voir le menu', href: '/menu' },
  },
  {
    id: 2,
    image: '/banner.png',
    title: 'Burritos Généreux',
    subtitle: 'Des ingrédients frais pour vous satisfaire',
    ctaPrimary: { label: 'Commander', href: '/menu?category=burritos' },
    ctaSecondary: { label: 'Découvrir', href: '/menu' },
  },
  {
    id: 3,
    image: '/banner.png',
    title: 'Snacks & Boissons',
    subtitle: 'Complétez votre commande parfaitement',
    ctaPrimary: { label: 'Commander', href: '/menu?category=snacks' },
    ctaSecondary: { label: 'Voir tout', href: '/menu' },
  },
]

export default function HeroCarousel() {
  const plugin = useRef(Autoplay({ delay: 5000, stopOnInteraction: true }))
  const [mounted, setMounted] = useState(false)
  const [currentSlide, setCurrentSlide] = useState(0)
  const [api, setApi] = useState<any>(null)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!api) return
    const onSelect = () => {
      setCurrentSlide(api.selectedScrollSnap())
    }
    api.on('select', onSelect)
    return () => { api.off('select', onSelect) }
  }, [api])

  if (!mounted) return (
    <div className="relative w-full pt-17.5">
      <div className="relative h-[70vh] min-h-100 w-full overflow-hidden bg-[#1A1A1A]">
        <Image src={slides[0].image} alt="Mr. Burritos" fill className="object-cover" priority />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
        
        {/* Minimal overlay content */}
        <div className="absolute inset-0 flex flex-col justify-center px-8 sm:px-16 lg:px-24">
          <div className="max-w-lg">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-white mb-4 drop-shadow-xl">
              {slides[0].title}
            </h1>
            <p className="text-white/80 text-lg mb-8">{slides[0].subtitle}</p>
            
            <div className="flex flex-wrap gap-4">
              <Link href={slides[0].ctaPrimary.href} className="bg-[#F5A800] hover:bg-[#FF6B00] text-black font-bold px-8 py-4 rounded-full transition-all hover:scale-105 shadow-lg text-sm">
                {slides[0].ctaPrimary.label} →
              </Link>
            </div>
          </div>
        </div>

        {/* Slide counter */}
        <div className="absolute top-8 right-8 text-white/80 text-sm font-medium tracking-wider">
          01 / {slides.length.toString().padStart(2, '0')}
        </div>
      </div>
    </div>
  )

  return (
    <div className="relative w-full pt-17.5">
      <Carousel
        plugins={[plugin.current]}
        opts={{ loop: true }}
        className="w-full"
        onMouseEnter={plugin.current.stop}
        onMouseLeave={plugin.current.reset}
        setApi={setApi}
      >
        <CarouselContent>
          {slides.map((slide, index) => (
            <CarouselItem key={slide.id}>
              <div className="relative h-[70vh] min-h-100 w-full overflow-hidden">
                {/* Full-bleed marketing image */}
                <Image src={slide.image} alt={slide.title} fill className="object-cover" priority />
                
                {/* Gradient overlay - lighter for marketing feel */}
                <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

                {/* Minimal text overlay - marketing style */}
                <div className="absolute inset-0 flex flex-col justify-center px-8 sm:px-16 lg:px-24">
                  <div className="max-w-lg">
                    <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-white mb-4 drop-shadow-xl leading-tight">
                      {slide.title}
                    </h1>
                    <p className="text-white/80 text-lg mb-8 max-w-md">
                      {slide.subtitle}
                    </p>
                    
                    {/* Clean CTA buttons */}
                    <div className="flex flex-wrap gap-4">
                      <Link 
                        href={slide.ctaPrimary.href}
                        className="bg-[#F5A800] hover:bg-[#FF6B00] text-black font-bold px-8 py-4 rounded-full transition-all hover:scale-105 shadow-lg text-sm"
                      >
                        {slide.ctaPrimary.label} →
                      </Link>
                      <Link 
                        href={slide.ctaSecondary.href}
                        className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white font-bold px-8 py-4 rounded-full transition-all hover:scale-105 text-sm border border-white/30"
                      >
                        {slide.ctaSecondary.label}
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Slide counter - top right */}
                <div className="absolute top-8 right-8 text-white/80 text-sm font-medium tracking-wider">
                  {(index + 1).toString().padStart(2, '0')} / {slides.length.toString().padStart(2, '0')}
                </div>

                {/* Dot tracking - bottom left */}
                <div className="absolute bottom-8 left-8 sm:left-16 flex gap-2">
                  {slides.map((s, i) => (
                    <div 
                      key={s.id} 
                      className={`h-1.5 rounded-full transition-all duration-300 ${i === currentSlide ? 'w-8 bg-[#F5A800]' : 'w-2 bg-white/50'}`}
                    />
                  ))}
                </div>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>

        {/* Subtle nav arrows */}
        <CarouselPrevious className="left-4 sm:left-8 bg-white/10 backdrop-blur-sm border-0 text-white/80 hover:bg-white/20 hover:text-white transition-all" />
        <CarouselNext className="right-4 sm:right-8 bg-white/10 backdrop-blur-sm border-0 text-white/80 hover:bg-white/20 hover:text-white transition-all" />
      </Carousel>

      {/* Track order bar - centered at bottom */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-20">
        <TrackOrderBar />
      </div>
    </div>
  )
}
