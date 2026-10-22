import { useId, type ReactNode } from 'react'
import { strip } from '@/lib/foodLayers'

/**
 * Drawn portraits of the viandes, for the builder's meat cards. Every viande
 * had been given the same placeholder shot (the logo over a tacos), which made
 * the cards impossible to tell apart; a drawing per meat, all in one style,
 * reads at a glance and sits consistently in the grid.
 *
 * Top-down, like a menu flat-lay: a plate on a tinted table, the meat on it,
 * a ramekin of sauce cut by the frame. The breading is a turbulence filter —
 * bumps lit from the top-left, edges roughened — so the shapes stay simple and
 * the texture does the work. Shapes are seeded, so the server and the client
 * draw the very same path.
 *
 * Matched by name (accents and case ignored). A viande with no drawing here
 * falls back to its uploaded photo.
 */

type P = [number, number]

const f = (n: number) => String(Math.round(n * 10) / 10)

/** Small seeded PRNG (mulberry32): same seed, same shape, on both sides. */
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A closed Catmull-Rom curve through the points, as cubic Béziers. */
function closed(pts: P[]): string {
  const n = pts.length
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n]
    const p1 = pts[i]
    const p2 = pts[(i + 1) % n]
    const p3 = pts[(i + 2) % n]
    d +=
      `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ` +
      `${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`
  }
  return d + 'Z'
}

interface BlobSpec {
  x: number
  y: number
  rx: number
  ry?: number
  /** Degrees. */
  rot?: number
  seed: number
  /** How far the outline strays from the ellipse, as a fraction of it. */
  wobble?: number
  /** Arches a long piece: a tender is never ruler-straight. */
  bend?: number
  points?: number
}

/** An irregular ellipse — a nugget, a tender, a crumble. */
function blob({ x, y, rx, ry = rx, rot = 0, seed, wobble = 0.1, bend = 0, points = 12 }: BlobSpec): string {
  const r = rng(seed)
  const a = (rot * Math.PI) / 180
  const cos = Math.cos(a)
  const sin = Math.sin(a)
  const pts: P[] = []
  for (let i = 0; i < points; i++) {
    const t = (i / points) * Math.PI * 2
    const k = 1 + (r() * 2 - 1) * wobble
    const px = rx * k * Math.cos(t)
    const py = ry * k * Math.sin(t) + bend * (px / rx) ** 2
    pts.push([x + px * cos - py * sin, y + px * sin + py * cos])
  }
  return closed(pts)
}

// ── Scene geometry ──────────────────────────────────────────────────────────

const PLATE: P = [112, 96]
const RAMEKIN: P = [208, 34]

type Coat = 'golden' | 'light' | 'spicy' | 'meat' | 'meatLight' | 'meatDark'

interface Piece {
  d: string
  coat: Coat
}

const tender = (x: number, y: number, rot: number, seed: number, rx = 36, ry = 12): Piece => ({
  d: blob({ x, y, rx, ry, rot, seed, wobble: 0.11, bend: seed % 2 ? 3 : -3, points: 16 }),
  coat: 'golden',
})

const TENDERS: Piece[] = [tender(90, 80, -30, 1), tender(130, 92, 14, 2, 38, 12.5), tender(102, 116, -6, 3, 34, 11.5)]

const SPICY: Piece[] = [
  tender(96, 76, -14, 21, 37),
  tender(128, 100, 30, 22, 35),
  tender(92, 112, 8, 23, 33, 11.5),
].map((p) => ({ ...p, coat: 'spicy' as const }))

const POPCORN: Piece[] = (
  [
    [70, 88, 9.5], [92, 76, 12], [117, 70, 11], [140, 82, 12], [154, 102, 9.5],
    [84, 102, 11.5], [109, 96, 13], [134, 106, 11.5], [96, 122, 11.5], [121, 126, 12], [146, 124, 9.5],
  ] as const
)
  .map(([x, y, r], i) => ({ d: blob({ x, y, rx: r, ry: r * 0.9, rot: i * 37, seed: 40 + i, wobble: 0.16, points: 11 }), coat: 'light' as Coat, y }))
  .sort((a, b) => a.y - b.y)

const BALLS: Piece[] = (
  [
    [84, 82, 17], [119, 72, 16], [96, 116, 17.5], [70, 108, 14],
  ] as const
).map(([x, y, r], i) => ({ d: blob({ x, y, rx: r, ry: r * 0.95, seed: 60 + i, wobble: 0.06 }), coat: 'golden' as Coat }))

/** A heap of seasoned mince: darker underneath, catching the light on top. */
const MINCE: Piece[] = (() => {
  const r = rng(77)
  // The bed the crumbles sit on, so the plate never shows through the heap.
  const out: (Piece & { k: number })[] = [
    { d: blob({ x: PLATE[0], y: PLATE[1], rx: 42, ry: 36, seed: 99, wobble: 0.1, points: 14 }), coat: 'meatDark', k: -1 },
  ]
  for (let i = 0; i < 150; i++) {
    const a = r() * Math.PI * 2
    const dist = Math.sqrt(r())
    const x = PLATE[0] + Math.cos(a) * dist * 44
    const y = PLATE[1] + Math.sin(a) * dist * 38
    const size = 3 + r() * 3.4
    const k = 1 - dist + r() * 0.35
    out.push({
      d: blob({ x, y, rx: size, ry: size * (0.7 + r() * 0.3), rot: r() * 180, seed: 100 + i, wobble: 0.25, points: 7 }),
      coat: k > 0.85 ? 'meatLight' : k < 0.35 ? 'meatDark' : 'meat',
      k,
    })
  }
  return out.sort((a, b) => a.k - b.k)
})()

const CORDON_WHOLE = blob({ x: 90, y: 84, rx: 42, ry: 23, rot: -22, seed: 11, wobble: 0.06, points: 16 })
// The cut cordon bleu, outside in: crust, chicken, a ham wrap, the cheese.
const CORDON_FACE = blob({ x: 0, y: 0, rx: 27, ry: 23, seed: 12, wobble: 0.05, points: 14 })
const CORDON_MEAT = blob({ x: 0, y: 0, rx: 22, ry: 18.5, seed: 15, wobble: 0.04, points: 14 })
const CORDON_HAM = blob({ x: -1, y: 0, rx: 14.5, ry: 11.5, seed: 16, wobble: 0.07, points: 12 })
const CORDON_HAM_IN = blob({ x: -1, y: 0, rx: 12.6, ry: 9.8, seed: 17, wobble: 0.07, points: 12 })
const CORDON_CHEESE = blob({ x: -1, y: 0, rx: 9.5, ry: 7, seed: 18, wobble: 0.08, points: 10 })
const BALL_HALF = blob({ x: 0, y: 0, rx: 19, ry: 18, seed: 13, wobble: 0.05, points: 12 })
const BALL_CORE = blob({ x: 0, y: 0, rx: 15, ry: 14.2, seed: 19, wobble: 0.05, points: 12 })

/** Toasted crumbs fallen around the breaded pieces. */
const CRUMBS: P[] = (() => {
  const r = rng(5)
  return Array.from({ length: 16 }, () => {
    const a = r() * Math.PI * 2
    const d = 46 + r() * 10
    return [PLATE[0] + Math.cos(a) * d, PLATE[1] + Math.sin(a) * d * 0.95] as P
  })
})()

/** Chopped parsley strewn over the top. */
const flecks = (seed: number, n: number, spread: number): P[] => {
  const r = rng(seed)
  return Array.from({ length: n }, () => {
    const a = r() * Math.PI * 2
    const d = Math.sqrt(r()) * spread
    return [PLATE[0] + Math.cos(a) * d, PLATE[1] + Math.sin(a) * d * 0.9] as P
  })
}

// ── Scenes ─────────────────────────────────────────────────────────────────

interface Scene {
  /** Table tint: centre, edge. */
  table: [string, string]
  /** Ramekin sauce: highlight, depth. */
  sauce: [string, string]
  /** Fine-grained texture for mince instead of breadcrumbs. */
  grain?: boolean
  pieces: Piece[]
  /** Drawn over the pieces: cut faces, chillies, herbs. */
  over?: (u: (k: string) => string) => ReactNode
  /** Drawn on the table, beside the plate. */
  beside?: (u: (k: string) => string) => ReactNode
  /** Herb leaves on the table. */
  leaves?: boolean
  crumbs?: boolean
}

const Parsley = ({ pts, u }: { pts: P[]; u: (k: string) => string }) => (
  <g fill={`url(#${u('herb')})`}>
    {pts.map(([x, y], i) => (
      <path key={i} d={blob({ x, y, rx: 1.9, ry: 1.3, rot: i * 47, seed: 300 + i, wobble: 0.3, points: 6 })} />
    ))}
  </g>
)

/** A whole red chilli lying on the table. */
const Chilli = ({ x, y, rot, u }: { x: number; y: number; rot: number; u: (k: string) => string }) => (
  <g transform={`translate(${x} ${y}) rotate(${rot})`} filter={`url(#${u('shadow')})`}>
    <path d="M-18-2C-10-7 6-6 16-1C20 1 22 4 21 6C14 3 2 4-10 5C-16 5-20 2-18-2Z" fill={`url(#${u('chilli')})`} />
    <path d="M-18-1C-22-3-24-6-23-10" stroke="#3F7A22" strokeWidth="2.4" strokeLinecap="round" fill="none" />
    <ellipse cx="-18" cy="0" rx="3" ry="4.4" fill="#4E8F2B" />
    <path d="M-10-3.6C-2-5 6-4.5 13-1.6" stroke="#fff" strokeOpacity=".5" strokeWidth="1.3" strokeLinecap="round" fill="none" />
  </g>
)

/** Molten cheese escaping a cut, with the light catching it. */
const Ooze = ({ d, u, melt = 'cheese' }: { d: string; u: (k: string) => string; melt?: 'cheese' | 'mozza' }) => (
  <>
    <path d={d} fill={`url(#${u(melt)})`} />
    <path d={d} fill="none" stroke="#D99A1E" strokeOpacity=".35" strokeWidth=".8" />
  </>
)

const SCENES: Record<string, Scene> = {
  'chicken crispy': {
    table: ['#FFF3DC', '#F2B95E'],
    sauce: ['#FFFDF4', '#E9DCB8'],
    pieces: TENDERS,
    crumbs: true,
    leaves: true,
    over: (u) => <Parsley pts={flecks(9, 12, 34)} u={u} />,
  },
  'spicy chicken': {
    table: ['#FFE7DA', '#E5683F'],
    sauce: ['#E8503A', '#8E170D'],
    pieces: SPICY,
    crumbs: true,
    over: (u) => (
      <>
        <g fill="#9E1B10">
          {flecks(31, 26, 40).map(([x, y], i) => (
            <rect key={i} x={x} y={y} width="2.6" height="1.5" rx=".5" transform={`rotate(${i * 53} ${x} ${y})`} />
          ))}
        </g>
        <Parsley pts={flecks(33, 8, 30)} u={u} />
      </>
    ),
    beside: (u) => (
      <>
        <Chilli x={30} y={152} rot={-28} u={u} />
        <Chilli x={214} y={156} rot={200} u={u} />
      </>
    ),
  },
  'cordon bleu': {
    table: ['#FFF8E1', '#EBC560'],
    sauce: ['#EF5440', '#A11F12'],
    pieces: [{ d: CORDON_WHOLE, coat: 'golden' }],
    crumbs: true,
    leaves: true,
    over: (u) => (
      <g transform="translate(140 112) rotate(-8)">
        <g filter={`url(#${u('shadow')})`}>
          <path d={CORDON_FACE} fill={`url(#${u('golden')})`} filter={`url(#${u('crumb')})`} />
        </g>
        <path d={CORDON_MEAT} fill={`url(#${u('chicken')})`} />
        <path d={CORDON_HAM} fill="#E28781" />
        <path d={CORDON_HAM_IN} fill="#F3AFA7" />
        <Ooze d={`${CORDON_CHEESE}M-3 4C3 7 9 8 13 11C17 14 22 14 26 17C31 20 31 26 27 27C25 28 24 31 20 31C15 31 14 28 11 27C6 25 2 17-3 4Z`} u={u} />
        <ellipse cx="-3" cy="-2.4" rx="3.6" ry="1.6" fill="#fff" opacity=".65" transform="rotate(-20 -3 -2.4)" />
        <ellipse cx="17" cy="24" rx="2.6" ry="1.3" fill="#fff" opacity=".6" transform="rotate(35 17 24)" />
      </g>
    ),
  },
  crispy: {
    table: ['#FFF5D3', '#F0AE2E'],
    sauce: ['#9A4E25', '#4A1B08'],
    pieces: POPCORN,
    crumbs: true,
    leaves: true,
    over: (u) => <Parsley pts={flecks(51, 10, 40)} u={u} />,
  },
  'viande hachee': {
    table: ['#FCE8DC', '#D0784D'],
    sauce: ['#FFFDF6', '#E8DEC7'],
    grain: true,
    pieces: MINCE,
    leaves: true,
    over: (u) => (
      <>
        <g fill="#F3E6EE" opacity=".95">
          {flecks(71, 9, 30).map(([x, y], i) => (
            <path key={i} d={blob({ x, y, rx: 3, ry: 1.2, rot: i * 61, seed: 400 + i, wobble: 0.2, points: 6 })} />
          ))}
        </g>
        <Parsley pts={flecks(73, 22, 36)} u={u} />
      </>
    ),
  },
  'boulette de fromage': {
    table: ['#F3F6E4', '#AFC27E'],
    sauce: ['#EF5440', '#A11F12'],
    pieces: BALLS,
    crumbs: true,
    leaves: true,
    over: (u) => (
      <g transform="translate(140 110)">
        <g filter={`url(#${u('shadow')})`}>
          <path d={BALL_HALF} fill={`url(#${u('golden')})`} filter={`url(#${u('crumb')})`} />
        </g>
        <Ooze d={`${BALL_CORE}M2 10C8 10 13 12 17 15C21 17 26 17 29 21C32 25 29 29 25 29C23 31 19 32 16 30C11 28 5 20 2 10Z`} u={u} melt="mozza" />
        <g fill="#FFF6CF" opacity=".8">
          <circle cx="-5" cy="3" r="1.6" />
          <circle cx="3" cy="-6" r="1.2" />
          <circle cx="5" cy="4" r="1" />
        </g>
        <ellipse cx="-4" cy="-5" rx="5" ry="2.2" fill="#fff" opacity=".6" transform="rotate(-30 -4 -5)" />
        <ellipse cx="20" cy="24" rx="2.4" ry="1.2" fill="#fff" opacity=".6" transform="rotate(30 20 24)" />
      </g>
    ),
  },
}

// Older menu names drawn with their closest match.
SCENES['escalope panee'] = SCENES['chicken crispy']
SCENES['nuggets'] = SCENES['crispy']

export const hasMeatArt = (name: string) => strip(name) in SCENES

const COATS: Record<Coat, [string, string, string]> = {
  golden: ['#FADB92', '#E5A445', '#B0641C'],
  light: ['#FDE7A8', '#EDB552', '#C07524'],
  spicy: ['#F7A25A', '#D85A28', '#8C2A12'],
  meat: ['#A8653F', '#84482C', '#5C2E1B'],
  meatLight: ['#C98A5E', '#A15F3B', '#723C23'],
  meatDark: ['#7A4027', '#5E2E1B', '#421D10'],
}

const LEAVES: [number, number, number][] = [
  [22, 150, 35], [42, 166, -25], [14, 128, 70], [222, 160, -40], [204, 170, 15],
]

const Leaf = ({ x, y, rot, u }: { x: number; y: number; rot: number; u: (k: string) => string }) => (
  <g transform={`translate(${x} ${y}) rotate(${rot})`}>
    <path d="M0-9C6-6 7 3 0 9C-7 3-6-6 0-9Z" fill={`url(#${u('leaf')})`} />
    <path d="M0-7V7" stroke="#3E7A23" strokeWidth=".8" strokeLinecap="round" />
  </g>
)

export default function MeatArt({ name, className = '' }: { name: string; className?: string }) {
  const scene = SCENES[strip(name)]
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  if (!scene) return null
  const u = (k: string) => `ma${uid}-${k}`
  const url = (k: string) => `url(#${u(k)})`

  return (
    <svg viewBox="22 14 196 147" preserveAspectRatio="xMidYMid slice" className={className} role="img" aria-label={name}>
      <defs>
        <radialGradient id={u('table')} cx="35%" cy="30%" r="85%">
          <stop offset="0" stopColor={scene.table[0]} />
          <stop offset="1" stopColor={scene.table[1]} />
        </radialGradient>
        <radialGradient id={u('rim')} cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#ECE4D6" />
        </radialGradient>
        <radialGradient id={u('well')} cx="45%" cy="40%" r="60%">
          <stop offset="0" stopColor="#FFFEFB" />
          <stop offset=".8" stopColor="#F7F2EA" />
          <stop offset="1" stopColor="#E6DCCB" />
        </radialGradient>
        <radialGradient id={u('sauce')} cx="38%" cy="32%" r="75%">
          <stop offset="0" stopColor={scene.sauce[0]} />
          <stop offset="1" stopColor={scene.sauce[1]} />
        </radialGradient>
        {/* Melted cheese: an even sheen, so the core and the run read as one pour. */}
        <linearGradient id={u('cheese')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFEC96" />
          <stop offset="1" stopColor="#F4C238" />
        </linearGradient>
        <linearGradient id={u('mozza')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFFCEB" />
          <stop offset="1" stopColor="#F4D98A" />
        </linearGradient>
        <radialGradient id={u('chicken')} cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor="#FFF9F0" />
          <stop offset="1" stopColor="#EAD5BA" />
        </radialGradient>
        <linearGradient id={u('chilli')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F0412C" />
          <stop offset="1" stopColor="#A3150C" />
        </linearGradient>
        <linearGradient id={u('leaf')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8CC157" />
          <stop offset="1" stopColor="#4C8A2C" />
        </linearGradient>
        <linearGradient id={u('herb')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6FAE3C" />
          <stop offset="1" stopColor="#3D7A22" />
        </linearGradient>
        {(Object.keys(COATS) as Coat[]).map((c) => (
          <radialGradient key={c} id={u(c)} cx="38%" cy="32%" r="72%">
            <stop offset="0" stopColor={COATS[c][0]} />
            <stop offset=".55" stopColor={COATS[c][1]} />
            <stop offset="1" stopColor={COATS[c][2]} />
          </radialGradient>
        ))}

        {/* Breading: noise used as a bump map, lit from the top-left, multiplied in.
            Arithmetic k1 multiplies premultiplied colours, so the edges stay clean. */}
        <filter id={u('crumb')} x="-15%" y="-15%" width="130%" height="130%">
          <feTurbulence type="fractalNoise" baseFrequency=".07" numOctaves="2" seed="4" result="lump" />
          <feDisplacementMap in="SourceGraphic" in2="lump" scale="5" xChannelSelector="R" yChannelSelector="G" result="d" />
          <feTurbulence type="fractalNoise" baseFrequency=".6" numOctaves="2" seed="7" result="n" />
          <feDiffuseLighting in="n" surfaceScale="1.5" diffuseConstant="1.22" lightingColor="#FFFFFF" result="l">
            <feDistantLight azimuth="225" elevation="58" />
          </feDiffuseLighting>
          <feComposite in="d" in2="l" operator="arithmetic" k1="1" k2="0" k3="0" k4="0" />
        </filter>
        <filter id={u('grain')} x="-30%" y="-30%" width="160%" height="160%">
          <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="3" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="1.6" xChannelSelector="R" yChannelSelector="G" result="d" />
          <feDiffuseLighting in="n" surfaceScale="1.4" diffuseConstant="1.1" lightingColor="#FFFFFF" result="l">
            <feDistantLight azimuth="225" elevation="55" />
          </feDiffuseLighting>
          <feComposite in="d" in2="l" operator="arithmetic" k1="1" k2="0" k3="0" k4="0" />
        </filter>
        <filter id={u('shadow')} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="1.5" dy="3" stdDeviation="2.4" floodColor="#3A1D08" floodOpacity=".38" />
        </filter>
        <filter id={u('soft')} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
        {/* Table grain, barely there. */}
        <filter id={u('linen')}>
          <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="2" />
          <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .09 0" />
        </filter>
      </defs>

      {/* Table */}
      <rect width="240" height="180" fill={url('table')} />
      <rect width="240" height="180" filter={url('linen')} />
      {scene.leaves && LEAVES.map(([x, y, rot], i) => <Leaf key={i} x={x} y={y} rot={rot} u={u} />)}

      {/* Plate */}
      <circle cx={PLATE[0] + 4} cy={PLATE[1] + 7} r="76" fill="#2B1405" opacity=".28" filter={url('soft')} />
      <circle cx={PLATE[0]} cy={PLATE[1]} r="76" fill={url('rim')} />
      <circle cx={PLATE[0]} cy={PLATE[1]} r="59" fill={url('well')} />
      <circle cx={PLATE[0]} cy={PLATE[1]} r="59" fill="none" stroke="#000" strokeOpacity=".05" />

      {/* Ramekin */}
      <circle cx={RAMEKIN[0] + 3} cy={RAMEKIN[1] + 5} r="28" fill="#2B1405" opacity=".25" filter={url('soft')} />
      <circle cx={RAMEKIN[0]} cy={RAMEKIN[1]} r="28" fill={url('rim')} />
      <circle cx={RAMEKIN[0]} cy={RAMEKIN[1]} r="21" fill={url('sauce')} />
      <circle cx={RAMEKIN[0]} cy={RAMEKIN[1]} r="21" fill="none" stroke="#000" strokeOpacity=".08" strokeWidth="1.5" />
      <ellipse cx={RAMEKIN[0] - 7} cy={RAMEKIN[1] - 7} rx="7" ry="3.6" fill="#fff" opacity=".55" transform={`rotate(-35 ${RAMEKIN[0] - 7} ${RAMEKIN[1] - 7})`} />

      {scene.beside?.(u)}

      {/* Served generously: the food spills a little past the well. */}
      <g transform={`translate(${PLATE[0]} ${PLATE[1]}) scale(1.28) translate(${-PLATE[0]} ${-PLATE[1]})`}>
        {scene.crumbs && (
          <g fill={url('golden')}>
            {CRUMBS.map(([x, y], i) => (
              <path key={i} d={blob({ x, y, rx: 1.1 + (i % 3) * 0.4, seed: 200 + i, wobble: 0.3, points: 6 })} />
            ))}
          </g>
        )}

        {/* Mince is one heap; breaded pieces each cast their own shadow. */}
        {scene.grain ? (
          <g filter={url('shadow')}>
            <g filter={url('grain')}>
              {scene.pieces.map((p, i) => (
                <path key={i} d={p.d} fill={url(p.coat)} />
              ))}
            </g>
          </g>
        ) : (
          scene.pieces.map((p, i) => (
            <g key={i} filter={url('shadow')}>
              <path d={p.d} fill={url(p.coat)} filter={url('crumb')} />
            </g>
          ))
        )}

        {scene.over?.(u)}
      </g>
    </svg>
  )
}
