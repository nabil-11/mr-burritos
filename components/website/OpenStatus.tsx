'use client'

import { PREP_MINUTES } from '@/lib/hours'
import { useOpenState } from '@/hooks/useOpenState'

/**
 * Whether you can order right now. Resolved on the client after mount so the
 * server-rendered markup can't disagree with the visitor's clock, and so a page
 * left open through closing time corrects itself.
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
  // than a beat of nothing.
  if (!state) return <span className="h-6" aria-hidden />

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full font-bold whitespace-nowrap ${
        compact ? 'text-[11px] px-2.5 py-1' : 'text-xs px-3 py-1.5'
      } ${
        onDark
          ? state.open
            ? 'bg-black/40 backdrop-blur-md text-emerald-300 border border-emerald-400/40'
            : 'bg-black/40 backdrop-blur-md text-white/80 border border-white/20'
          : state.open
            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
            : 'bg-muted text-muted-foreground border border-border'
      }`}
    >
      <span className="relative flex h-1.5 w-1.5">
        {state.open && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        )}
        <span
          className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
            state.open ? 'bg-emerald-500' : 'bg-muted-foreground/40'
          }`}
        />
      </span>
      {state.open ? (
        <>
          Ouvert
          <span className="font-medium opacity-60">
            · ~{PREP_MINUTES} min{compact ? '' : ` · jusqu'à ${state.at}`}
          </span>
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
