'use client'

import { CartProvider } from '@/contexts/CartContext'

/**
 * Le panier, rendu disponible à tout ce que la mise en page contient.
 *
 * Il vit ici plutôt que dans `layout.tsx` pour une raison de frontière : un
 * layout marqué `'use client'` entraîne avec lui tout ce qu'il importe, et le
 * pied de page a besoin du serveur — il lit sur le disque quelles applications
 * sont réellement téléchargeables (voir lib/downloads).
 *
 * Le contexte passe malgré tout : React le fait descendre par la position dans
 * l'arbre, pas par les imports. Les enfants restent rendus sur le serveur et
 * retrouvent le panier à l'exécution.
 */
export default function CartShell({ children }: { children: React.ReactNode }) {
  return <CartProvider>{children}</CartProvider>
}
