import VideoBackground from './VideoBackground'

/**
 * Slow drifting brand light behind the page.
 *
 * This exists instead of a video background: it weighs nothing (no asset, no
 * JavaScript — it is a server component), animates only `transform`, so the
 * compositor handles it without touching layout or paint, and it adapts to the
 * theme rather than fighting it.
 *
 * Blur is deliberately large: at this radius the shapes read as light rather
 * than as circles, which is what keeps it from looking like decoration.
 */

const BLOBS = [
  {
    // Warm brand yellow, top-left.
    className: 'ambient-blob animate-[ambient-a_34s_ease-in-out_infinite]',
    style: {
      top: '-10%',
      left: '-5%',
      width: '55vw',
      height: '55vw',
      background: 'radial-gradient(circle, #F5A800 0%, transparent 68%)',
    },
  },
  {
    // Deeper orange, mid-right, drifting on a different period so the two
    // never settle into a visible rhythm.
    className: 'ambient-blob animate-[ambient-b_46s_ease-in-out_infinite]',
    style: {
      top: '25%',
      right: '-15%',
      width: '50vw',
      height: '50vw',
      background: 'radial-gradient(circle, #FF6B00 0%, transparent 70%)',
    },
  },
  {
    className: 'ambient-blob animate-[ambient-c_58s_ease-in-out_infinite]',
    style: {
      bottom: '-15%',
      left: '20%',
      width: '45vw',
      height: '45vw',
      background: 'radial-gradient(circle, #F5A800 0%, transparent 72%)',
    },
  },
]

export default function AmbientBackground() {
  return (
    <div
      aria-hidden
      className="fixed inset-0 -z-10 overflow-hidden pointer-events-none"
    >
      {BLOBS.map((b, i) => (
        <div
          key={i}
          // Light needs more presence on a dark ground than on a white one,
          // where the same value reads as a smudge.
          className={`absolute rounded-full blur-[110px] opacity-[0.07] dark:opacity-[0.16] ${b.className}`}
          style={b.style}
        />
      ))}

      {/* Portrait phones only, and only once play() is called — see
          VideoBackground, which carries its own scrim. */}
      <VideoBackground />
    </div>
  )
}
