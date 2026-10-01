'use client'

import { useEffect, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'

/**
 * Garde le tableau de bord à jour sans que personne n'y pense.
 *
 * Un rafraîchissement du serveur toutes les 30 secondes, et seulement quand
 * l'onglet est visible : un écran laissé ouvert dans un coin ne doit pas
 * marteler la base toute la nuit. En revenant sur l'onglet, la page se remet à
 * jour aussitôt — c'est le moment où l'on regarde.
 */

const EVERY_MS = 30_000

export default function LiveRefresh({ generatedAt }: { generatedAt: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  // Posé au montage par l'effet ci-dessous, puis à chaque nouvelle version de la page.
  const last = useRef(0)

  useEffect(() => {
    last.current = Date.now()
  }, [generatedAt])

  useEffect(() => {
    const refresh = () => {
      last.current = Date.now()
      startTransition(() => router.refresh())
    }
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') refresh()
    }, EVERY_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - last.current > 10_000) refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [router])

  const time = new Date(generatedAt).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Tunis',
  })

  return (
    <button
      onClick={() => startTransition(() => router.refresh())}
      className="inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      title="Actualisé automatiquement toutes les 30 secondes"
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-60 animate-ping" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
      </span>
      En direct · {time}
      <RefreshCw size={13} className={pending ? 'animate-spin' : ''} />
    </button>
  )
}
