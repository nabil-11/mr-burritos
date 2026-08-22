'use client'

import { useEffect, useRef } from 'react'

/**
 * The burger loop, as the page background on every viewport.
 *
 * The file is 834×1112 — portrait — so on a wide screen it is upscaled past 2×
 * and cropped top and bottom. Behind the scrim at background opacity that reads
 * as texture rather than as soft video; re-encoding a landscape cut is what
 * would fix it properly.
 *
 * It ships with `preload="none"` and no `autoplay` attribute, so the 7.5 MB is
 * only fetched once `play()` is called — which never happens for Data Saver
 * users or anyone who asked for reduced motion.
 */
export default function VideoBackground({ src = '/burger_wallpaper.mp4' }: { src?: string }) {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // React does not reliably reflect the `muted` attribute onto the property,
    // and an unmuted play() without a user gesture is rejected outright on iOS.
    el.muted = true

    const calm = window.matchMedia('(prefers-reduced-motion: reduce)')

    const sync = () => {
      // Data Saver is an explicit "don't spend my bandwidth"; a decorative
      // 7.5 MB loop is exactly what it means.
      const saveData =
        (navigator as { connection?: { saveData?: boolean } }).connection?.saveData === true
      if (!calm.matches && !saveData) {
        // Nothing has been fetched until this point.
        el.play().catch(() => {
          // Autoplay refused (iOS Low Power Mode, for one). The ambient
          // gradient underneath is already carrying the background.
        })
      } else {
        el.pause()
      }
    }

    sync()
    calm.addEventListener('change', sync)
    return () => calm.removeEventListener('change', sync)
  }, [])

  // The scrim lives in here rather than in the parent so it disappears with
  // the video — otherwise it would dim the gradients on every desktop visit,
  // where there is no video to soften.
  return (
    <div className="bg-video absolute inset-0">
      <video
        ref={ref}
        src={src}
        muted
        loop
        playsInline
        preload="none"
        aria-hidden
        tabIndex={-1}
        className="absolute inset-0 w-full h-full object-cover"
      />
      {/*
        One scrim rather than a dimmed video behind a dimmed layer: stacking
        both washed the colour out twice and left roughly 11% of the footage
        visible. At 72% the video reads clearly and body copy still has the
        contrast it needs. Tune this single number to taste.
      */}
      <div className="absolute inset-0 bg-background/72" />
    </div>
  )
}
