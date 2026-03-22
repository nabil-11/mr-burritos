'use client'

import { CartProvider } from '@/contexts/CartContext'
import WebNavbar from '@/components/website/Navbar'
import Footer from '@/components/website/Footer'

export default function WebsiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <div className="flex flex-col min-h-screen">
        <WebNavbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </div>
    </CartProvider>
  )
}
