'use client'

import { useEffect } from 'react'
import { captureRef } from '@/lib/webMemory'

/**
 * Lit « ?src= » à l'arrivée (QR code du sac, lien de la bio Instagram…) et le
 * garde trente jours sur l'appareil : la commande passée plus tard dira d'où
 * venait le client. Ne rend rien.
 */
export default function RefCapture() {
  useEffect(() => {
    captureRef(window.location.search)
  }, [])
  return null
}
