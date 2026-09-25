'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, UtensilsCrossed, Tag, PlusCircle, ShoppingBag,
  CalendarDays, Users, Settings, LogOut, ClipboardPlus, Menu, X, Bike, BarChart3,
  BookOpen, MessageSquare, Wallet, HandCoins,
} from 'lucide-react'
import { toast } from 'sonner'
import ThemeToggle from '@/components/ThemeToggle'
import RecetteControl from '@/components/backoffice/RecetteControl'

const nav = [
  { href: '/dashboard',    label: 'Tableau de bord', icon: LayoutDashboard },
  { href: '/orders/new',   label: 'Nouvelle commande', icon: ClipboardPlus, highlight: true },
  { href: '/orders',       label: 'Commandes',        icon: ShoppingBag },
  { href: '/recettes',     label: 'Recettes (caisse)', icon: Wallet },
  { href: '/reports',      label: 'Rapports',         icon: BarChart3 },
  { href: '/products',     label: 'Produits',         icon: UtensilsCrossed },
  { href: '/categories',   label: 'Catégories',       icon: Tag },
  { href: '/supplements',  label: 'Suppléments',      icon: PlusCircle },
  { href: '/delivery-companies', label: 'Sociétés livraison', icon: Bike },
  { href: '/platform-payouts', label: 'Règlements plateformes', icon: HandCoins },
  { href: '/posts',        label: 'Blog',             icon: BookOpen },
  { href: '/reviews',      label: 'Avis clients',     icon: MessageSquare },
  { href: '/reservations', label: 'Réservations',     icon: CalendarDays },
  { href: '/users',        label: 'Utilisateurs',     icon: Users },
  { href: '/configuration',label: 'Configuration',    icon: Settings },
]

/**
 * The panel itself, at module level rather than nested in `Sidebar`: a
 * component redefined on every render is a different component to React, which
 * remounts its whole subtree — and the till widget below keeps state (its open
 * dialog, its running total) that must survive a route change.
 */
function SidebarPanel({
  pathname,
  onClose,
  onLogout,
}: {
  pathname: string
  onClose: () => void
  onLogout: () => void
}) {
  return (
    <aside className="w-60 bg-[#1A1A1A] text-white flex flex-col h-full">
      <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between">
        <div>
          <p className="text-[#F5A800] font-black text-xl">MR. BURRITOS</p>
          <p className="text-white/40 text-xs">Backoffice</p>
        </div>
        {/* Close button — mobile only */}
        <button onClick={onClose} className="lg:hidden p-1 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors">
          <X size={18} />
        </button>
      </div>

      {/* État de la caisse — visible depuis n'importe quelle page */}
      <div className="pt-3">
        <RecetteControl onNavigate={onClose} />
      </div>

      <nav className="flex-1 py-4 space-y-1 px-3 overflow-y-auto">
        {nav.map(({ href, label, icon: Icon, highlight }) => {
          const active = pathname === href
          if (highlight) {
            return (
              <Link key={href} href={href} onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${active ? 'bg-[#F5A800] text-black' : 'bg-[#F5A800]/15 text-[#F5A800] hover:bg-[#F5A800]/25'}`}>
                <Icon size={16} />
                {label}
              </Link>
            )
          }
          return (
            <Link key={href} href={href} onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${active ? 'bg-[#F5A800] text-black font-semibold' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}>
              <Icon size={16} />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="p-3 border-t border-white/10 flex items-center gap-2">
        <button onClick={onLogout} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 flex-1 transition-colors">
          <LogOut size={16} /> Déconnexion
        </button>
        {/* The sidebar is dark in both themes, so the toggle gets a
            light-on-dark skin rather than the token-based default. */}
        <ThemeToggle className="border-white/15 text-white/60 hover:text-[#F5A800] shrink-0" />
      </div>
    </aside>
  )
}

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

  return (
    <>
      {/* ── Mobile top bar ──────────────────────────────────── */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-30 h-14 bg-[#1A1A1A] flex items-center justify-between px-4 shadow-md">
        <p className="text-[#F5A800] font-black text-lg tracking-widest">MR. BURRITOS</p>
        <div className="flex items-center gap-2">
          <ThemeToggle className="border-white/15 text-white/60 hover:text-[#F5A800]" />
          <button
            onClick={() => setOpen(true)}
            className="p-2 rounded-lg hover:bg-white/10 text-white transition-colors"
            aria-label="Ouvrir le menu"
          >
            <Menu size={22} />
          </button>
        </div>
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
        <SidebarPanel pathname={pathname} onClose={close} onLogout={logout} />
      </div>

      {/* ── Desktop sidebar (always visible) ────────────────── */}
      <div className="hidden lg:block h-full shrink-0">
        <SidebarPanel pathname={pathname} onClose={close} onLogout={logout} />
      </div>
    </>
  )
}
