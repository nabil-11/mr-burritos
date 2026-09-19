import type { Metadata } from 'next'

// The basket is personal and changes with every visitor: not a page to index.
export const metadata: Metadata = {
  title: 'Ma commande — Mr. Burritos',
  robots: { index: false, follow: false },
}

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return children
}
