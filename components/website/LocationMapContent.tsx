'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// Custom restaurant marker icon
const restaurantIcon = L.divIcon({
  className: 'custom-restaurant-marker',
  html: `
    <div style="
      width: 48px;
      height: 48px;
      background: linear-gradient(135deg, #F5A800 0%, #FF6B00 100%);
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      border: 3px solid white;
    ">
      <span style="
        transform: rotate(45deg);
        font-size: 20px;
      ">🌮</span>
    </div>
  `,
  iconSize: [48, 48],
  iconAnchor: [24, 48],
  popupAnchor: [0, -48],
})

interface MapProps {
  lat: number
  lng: number
  popupText?: string
}

export default function LocationMapContent({ lat, lng, popupText = 'Mr. Burritos' }: MapProps) {
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) {
    return (
      <div className="w-full h-64 bg-gray-200 rounded-2xl animate-pulse flex items-center justify-center">
        <span className="text-gray-400">Chargement de la carte...</span>
      </div>
    )
  }

  return (
    <div className="w-full h-64 rounded-2xl overflow-hidden shadow-lg">
      <MapContainer
        center={[lat, lng]}
        zoom={15}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[lat, lng]} icon={restaurantIcon}>
          <Popup>{popupText}</Popup>
        </Marker>
      </MapContainer>
    </div>
  )
}