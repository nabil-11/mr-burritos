'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, UtensilsCrossed, Tag, PlusCircle, ShoppingBag, CalendarDays, Users, Settings, LogOut } from 'lucide-react'
import { toast } from 'sonner'

const nav = [
  { href: '/dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { href: '/products', label: 'Produits', icon: UtensilsCrossed },
  { href: '/categories', label: 'Catégories', icon: Tag },
  { href: '/supplements', label: 'Suppléments', icon: PlusCircle },
  { href: '/orders', label: 'Commandes', icon: ShoppingBag },
  { href: '/reservations', label: 'Réservations', icon: CalendarDays },
  { href: '/users', label: 'Utilisateurs', icon: Users },
  { href: '/configuration', label: 'Configuration', icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    toast.success('Déconnecté')
    router.push('/login')
  }

  return (
    <aside className="w-60 bg-[#1A1A1A] text-white flex flex-col h-full">
      <div className="px-6 py-5 border-b border-white/10">
        <p className="text-[#F5A800] font-black text-xl">MR. BURRITOS</p>
        <p className="text-white/40 text-xs">Backoffice</p>
      </div>
      <nav className="flex-1 py-4 space-y-1 px-3 overflow-y-auto">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${active ? 'bg-[#F5A800] text-black font-semibold' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
            >
              <Icon size={16} />
              {label}
            </Link>
          )
        })}
      </nav>
      <div className="p-3 border-t border-white/10">
        <button onClick={logout} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 w-full transition-colors">
          <LogOut size={16} /> Déconnexion
        </button>
      </div>
    </aside>
  )
}
