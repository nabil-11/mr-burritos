'use client'

import type { ReactNode } from 'react'
import { Dialog } from '@base-ui/react/dialog'

/**
 * Desktop window sizes. The composer needs height for its steps; a dish sits
 * beside a square photo, so its window is as tall as the photo is wide.
 */
const SIZES = {
  tall: 'sm:w-[min(56rem,calc(100vw-3rem))] sm:h-[min(46rem,calc(100dvh-3rem))]',
  photo: 'sm:w-[min(60rem,calc(100vw-3rem))] sm:h-[min(34rem,calc(100dvh-3rem))]',
}

/**
 * The panel a dish or a composer opens in, over the menu rather than in place
 * of it: closing it leaves the customer exactly where they were scrolling.
 * A sheet rising from the bottom on a phone, a centred window on a desktop.
 */
export default function MenuSheet({
  open,
  onClose,
  title,
  size = 'tall',
  children,
}: {
  open: boolean
  onClose: () => void
  /** For screen readers; the sheet draws its own visible heading. */
  title: string
  size?: keyof typeof SIZES
  children: ReactNode
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[60] bg-black/55 backdrop-blur-[2px] transition-opacity duration-200 data-starting-style:opacity-0 data-ending-style:opacity-0" />
        <Dialog.Popup
          className={`fixed z-[60] inset-x-0 bottom-0 top-[max(env(safe-area-inset-top),1rem)] rounded-t-[1.75rem] sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[1.75rem] ${SIZES[size]} overflow-hidden bg-card text-foreground shadow-2xl shadow-black/40 outline-none transition-[opacity,translate,scale] duration-300 ease-out data-starting-style:opacity-0 data-ending-style:opacity-0 max-sm:data-starting-style:translate-y-12 max-sm:data-ending-style:translate-y-12 sm:data-starting-style:scale-95 sm:data-ending-style:scale-95`}
        >
          <Dialog.Title className="sr-only">{title}</Dialog.Title>
          {children}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
