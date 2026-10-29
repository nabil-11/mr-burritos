'use client'

import { TRACK_EVENT } from './Navbar'

/**
 * « Suivre une commande », depuis le pied de page. L'en-tête ne montre son
 * bouton que si une commande de cet appareil est en cours ; celui-ci reste
 * toujours là, pour qui a commandé d'un autre téléphone.
 */
export default function TrackOrderLink({ className = '' }: { className?: string }) {
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event(TRACK_EVENT))} className={className}>
      Suivre une commande
    </button>
  )
}
