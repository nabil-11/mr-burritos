'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'

/**
 * Dark/light switch.
 *
 * Both icons are always rendered and swapped by the `dark:` variant rather than
 * by React state — the server has no idea which theme the visitor picked, so
 * anything state-driven here either flashes the wrong icon or needs a mounted
 * guard. CSS knows the answer as soon as next-themes sets the class.
 */
export default function ThemeToggle() {
  const { setTheme } = useTheme()

  const toggle = () => {
    // Read the live class at click time; `theme` is undefined on first render.
    const isDark = document.documentElement.classList.contains('dark')
    setTheme(isDark ? 'light' : 'dark')
  }

  return (
    <button
      onClick={toggle}
      aria-label="Changer de thème"
      title="Changer de thème"
      className="relative grid place-items-center w-9 h-9 rounded-full border border-border text-muted-foreground hover:text-[#F5A800] hover:border-[#F5A800]/40 transition-colors"
    >
      <Sun size={15} className="hidden dark:block" />
      <Moon size={15} className="block dark:hidden" />
    </button>
  )
}
