'use client'

import { PREP_MINUTES } from '@/lib/hours'
import { useOpenState } from '@/hooks/useOpenState'

/**
 * Whether you can order right now. Resolved on the client after mount so the
 * server-rendered markup can't disagree with the visitor's clock, and so a page
 * left open through closing time corrects itself.
 *
 * `compact` est la version de l'en-tête : un point vert « Ouvert · jusqu'à
 * 23:00 » ou gris « Fermé · ouvre à 11:00 », sans pastille.
 */
export default function OpenStatus({
  compact = false,
  onDark = false,
}: {
  compact?: boolean
  /** Over a photo: light glass instead of theme colours, readable in both themes. */
  onDark?: boolean
}) {
  const state = useOpenState()

  // Nothing until the clock is known — a flash of the wrong status is worse
  // than a beat of nothing. La place est réservée, pour que rien ne bouge.
  if (!state) return <span className={`inline-block ${compact ? 'h-4 w-32' : 'h-6 w-40'}`} aria-hidden />

  const dot = (
    <span className="relative flex h-2 w-2 shrink-0">
      {state.open && (
        <span className="absolute inline-flex h-full w-full motion-safe:animate-ping rounded-full bg-emerald-400 opacity-75" />
      )}
      <span className={`relative inline-flex h-2 w-2 rounded-full ${state.open ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
    </span>
  )

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-bold whitespace-nowrap text-foreground">
        {dot}
        {state.open ? (
          <>
            Ouvert<span className="font-medium text-muted-foreground"> · jusqu&apos;à {state.at}</span>
          </>
        ) : (
          <>
            Fermé<span className="font-medium text-muted-foreground"> · ouvre à {state.at}</span>
          </>
        )}
      </span>
    )
  }

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full font-bold whitespace-nowrap text-xs px-3 py-1.5 ${
        onDark
          ? state.open
            ? 'bg-black/40 backdrop-blur-md text-emerald-300 border border-emerald-400/40'
            : 'bg-black/40 backdrop-blur-md text-white/80 border border-white/20'
          : state.open
            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
            : 'bg-muted text-muted-foreground border border-border'
      }`}
    >
      {dot}
      {state.open ? (
        <>
          Ouvert
          <span className="font-medium opacity-60">· ~{PREP_MINUTES} min · jusqu&apos;à {state.at}</span>
        </>
      ) : (
        <>
          Fermé
          <span className="font-medium opacity-60">· ouvre à {state.at}</span>
        </>
      )}
    </span>
  )
}
