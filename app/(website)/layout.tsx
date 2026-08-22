'use client'

import { CartProvider } from '@/contexts/CartContext'
import WebNavbar from '@/components/website/Navbar'
import Footer from '@/components/website/Footer'
import AmbientBackground from '@/components/website/AmbientBackground'

export default function WebsiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <div className="flex flex-col min-h-screen">
        <AmbientBackground />
        <WebNavbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </div>
    </CartProvider>
  )
}
