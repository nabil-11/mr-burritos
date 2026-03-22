'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, UtensilsCrossed, Tag, PlusCircle, ShoppingBag,
  CalendarDays, Users, Settings, LogOut, ClipboardPlus, Menu, X, Bike, BarChart3,
  BookOpen, MessageSquare,
} from 'lucide-react'
import { toast } from 'sonner'

const nav = [
  { href: '/dashboard',    label: 'Tableau de bord', icon: LayoutDashboard },
  { href: '/orders/new',   label: 'Nouvelle commande', icon: ClipboardPlus, highlight: true },
  { href: '/orders',       label: 'Commandes',        icon: ShoppingBag },
  { href: '/reports',      label: 'Rapports',         icon: BarChart3 },
  { href: '/products',     label: 'Produits',         icon: UtensilsCrossed },
  { href: '/categories',   label: 'Catégories',       icon: Tag },
  { href: '/supplements',  label: 'Suppléments',      icon: PlusCircle },
  { href: '/delivery-companies', label: 'Sociétés livraison', icon: Bike },
  { href: '/posts',        label: 'Blog',             icon: BookOpen },
  { href: '/reviews',      label: 'Avis clients',     icon: MessageSquare },
  { href: '/reservations', label: 'Réservations',     icon: CalendarDays },
  { href: '/users',        label: 'Utilisateurs',     icon: Users },
  { href: '/configuration',label: 'Configuration',    icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    toast.success('Déconnecté')
    router.push('/login')
  }

  const close = () => setOpen(false)

  const SidebarContent = () => (
    <aside className="w-60 bg-[#1A1A1A] text-white flex flex-col h-full">
      <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between">
        <div>
          <p className="text-[#F5A800] font-black text-xl">MR. BURRITOS</p>
          <p className="text-white/40 text-xs">Backoffice</p>
        </div>
        {/* Close button — mobile only */}
        <button onClick={close} className="lg:hidden p-1 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors">
          <X size={18} />
        </button>
      </div>

      <nav className="flex-1 py-4 space-y-1 px-3 overflow-y-auto">
        {nav.map(({ href, label, icon: Icon, highlight }) => {
          const active = pathname === href
          if (highlight) {
            return (
              <Link key={href} href={href} onClick={close}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${active ? 'bg-[#F5A800] text-black' : 'bg-[#F5A800]/15 text-[#F5A800] hover:bg-[#F5A800]/25'}`}>
                <Icon size={16} />
                {label}
              </Link>
            )
          }
          return (
            <Link key={href} href={href} onClick={close}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${active ? 'bg-[#F5A800] text-black font-semibold' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}>
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

  return (
    <>
      {/* ── Mobile top bar ──────────────────────────────────── */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-30 h-14 bg-[#1A1A1A] flex items-center justify-between px-4 shadow-md">
        <p className="text-[#F5A800] font-black text-lg tracking-widest">MR. BURRITOS</p>
        <button
          onClick={() => setOpen(true)}
          className="p-2 rounded-lg hover:bg-white/10 text-white transition-colors"
          aria-label="Ouvrir le menu"
        >
          <Menu size={22} />
        </button>
      </div>

      {/* ── Mobile backdrop ─────────────────────────────────── */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
          onClick={close}
        />
      )}

      {/* ── Mobile drawer ───────────────────────────────────── */}
      <div className={`
        lg:hidden fixed inset-y-0 left-0 z-50 transition-transform duration-300 ease-in-out
        ${open ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <SidebarContent />
      </div>

      {/* ── Desktop sidebar (always visible) ────────────────── */}
      <div className="hidden lg:block h-full shrink-0">
        <SidebarContent />
      </div>
    </>
  )
}
