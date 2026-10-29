import CartShell from './CartShell'
import WebNavbar from '@/components/website/Navbar'
import Footer from '@/components/website/Footer'
import AmbientBackground from '@/components/website/AmbientBackground'
import CartBar from '@/components/website/CartBar'
import ClosedBar from '@/components/website/ClosedBar'
import RefCapture from '@/components/website/RefCapture'

/**
 * La mise en page du site. Composant serveur : le panier est isolé dans
 * `CartShell`, qui l'est, lui, côté client — sans quoi tout ce qui est importé
 * ici le deviendrait aussi, y compris le pied de page.
 *
 * Le bandeau « Fermé pour le moment » publie sa hauteur dans `--banner-h` ;
 * le contenu descend d'autant, pour que rien ne passe dessous.
 */
export default function WebsiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartShell>
      <div className="flex flex-col min-h-screen">
        <AmbientBackground />
        <WebNavbar />
        <ClosedBar />
        <RefCapture />
        <main className="flex-1 pt-[var(--banner-h,0px)]">{children}</main>
        <Footer />
        <CartBar />
      </div>
    </CartShell>
  )
}
