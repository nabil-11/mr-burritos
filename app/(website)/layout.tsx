import CartShell from './CartShell'
import WebNavbar from '@/components/website/Navbar'
import Footer from '@/components/website/Footer'
import AmbientBackground from '@/components/website/AmbientBackground'
import CartBar from '@/components/website/CartBar'

/**
 * La mise en page du site. Composant serveur : le panier est isolé dans
 * `CartShell`, qui l'est, lui, côté client — sans quoi tout ce qui est importé
 * ici le deviendrait aussi, y compris le pied de page qui lit sur le disque.
 */
export default function WebsiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartShell>
      <div className="flex flex-col min-h-screen">
        <AmbientBackground />
        <WebNavbar />
        <main className="flex-1">{children}</main>
        <Footer />
        <CartBar />
      </div>
    </CartShell>
  )
}
