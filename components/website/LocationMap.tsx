'use client'

import dynamic from 'next/dynamic'
import { Navigation } from 'lucide-react'

// Dynamically import the map component with SSR disabled to prevent "window is not defined" error
const LocationMapContent = dynamic(() => import('./LocationMapContent'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-64 bg-gray-200 rounded-2xl animate-pulse flex items-center justify-center">
      <span className="text-gray-400">Chargement de la carte...</span>
    </div>
  ),
})

// Direction button component
export function DirectionButton({ lat, lng }: { lat: number; lng: number }) {
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
  
  return (
    <a
      href={googleMapsUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 bg-[#F5A800] hover:bg-[#FF6B00] text-black font-bold px-6 py-3 rounded-full transition-all hover:scale-105 shadow-lg text-sm"
    >
      <Navigation size={18} />
      Itinéraire sur Google Maps
    </a>
  )
}

export default function LocationMapWrapper({ lat, lng, popupText }: { lat: number; lng: number; popupText?: string }) {
  return <LocationMapContent lat={lat} lng={lng} popupText={popupText} />
}