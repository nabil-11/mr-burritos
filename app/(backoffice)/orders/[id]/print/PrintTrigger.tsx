'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function PrintTrigger() {
  const router = useRouter()

  useEffect(() => {
    // Small delay to let the page fully render before printing
    const timer = setTimeout(() => {
      window.print()
      // After print dialog closes, go back to orders list
      window.onafterprint = () => router.push('/orders')
    }, 400)
    return () => clearTimeout(timer)
  }, [router])

  return (
    <div className="no-print fixed bottom-4 right-4 flex gap-2 z-50">
      <button
        onClick={() => window.print()}
        className="bg-[#1A1A1A] hover:bg-[#F5A800] text-white hover:text-black font-bold px-4 py-2 rounded-xl text-sm transition-all shadow-lg"
      >
        🖨️ Imprimer
      </button>
      <button
        onClick={() => router.push('/orders')}
        className="bg-white border border-gray-200 hover:border-gray-400 text-gray-700 font-bold px-4 py-2 rounded-xl text-sm transition-all shadow-lg"
      >
        ✕ Fermer
      </button>
    </div>
  )
}
