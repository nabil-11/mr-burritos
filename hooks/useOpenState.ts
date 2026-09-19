'use client'

import { useEffect, useState } from 'react'
import { openStateAt, type OpenState } from '@/lib/hours'

/**
 * Whether the restaurant is taking orders right now, on its own clock.
 *
 * Null until mounted: the server cannot know the visitor's "now", and a flash
 * of the wrong answer is worse than a beat of none. Re-read every minute, so a
 * page left open through closing time corrects itself.
 */
export function useOpenState(): OpenState | null {
  const [state, setState] = useState<OpenState | null>(null)

  useEffect(() => {
    const read = () => setState(openStateAt(new Date()))
    read()
    const id = setInterval(read, 60_000)
    return () => clearInterval(id)
  }, [])

  return state
}
