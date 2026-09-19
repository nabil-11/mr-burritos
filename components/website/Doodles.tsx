/**
 * The hand-drawn marks from the banners — stars, hearts, squiggles, a curved
 * arrow — as inline strokes in currentColor, so they take the theme's colour
 * and weigh nothing. Decoration only: hidden from screen readers.
 */

type P = { className?: string }

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.4,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

export const DoodleStar = ({ className }: P) => (
  <svg viewBox="0 0 32 32" className={className} {...base}>
    <path d="M16 3.5l3.4 8.1 8.6.6-6.6 5.5 2.1 8.4L16 21.4l-7.5 4.7 2.1-8.4L4 12.2l8.6-.6z" />
  </svg>
)

export const DoodleHeart = ({ className }: P) => (
  <svg viewBox="0 0 32 32" className={className} {...base}>
    <path d="M16 27s-10.5-6.2-11.8-13.1C3.3 9.3 6.2 5.6 10 5.8c2.8.1 4.8 2.2 6 4.6 1.2-2.4 3.4-4.6 6.2-4.6 3.8 0 6.4 3.8 5.4 8.2C26 20.9 16 27 16 27z" />
  </svg>
)

export const DoodleSparkle = ({ className }: P) => (
  <svg viewBox="0 0 32 32" className={className} {...base}>
    <path d="M16 4v7M16 21v7M4 16h7M21 16h7M8 8l3.5 3.5M20.5 20.5L24 24M24 8l-3.5 3.5M11.5 20.5L8 24" />
  </svg>
)

export const DoodleArrow = ({ className }: P) => (
  <svg viewBox="0 0 64 40" className={className} {...base}>
    <path d="M4 8c10 22 30 28 50 20" />
    <path d="M46 20l9 7.5-11 3.5" />
  </svg>
)

export const DoodleSquiggle = ({ className }: P) => (
  <svg viewBox="0 0 120 16" className={className} {...base} preserveAspectRatio="none">
    <path d="M2 10c8-8 14 6 22-2s14 6 22-2 14 6 22-2 14 6 22-2 14 6 22-2" />
  </svg>
)
