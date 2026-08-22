'use client'

import { useState } from 'react'
import { Share2, Check } from 'lucide-react'
import { toast } from 'sonner'

/**
 * Share a dish: its name, its description and its photo.
 *
 * Three tiers, best first.
 *  1. Native share with the photo attached as a file — what WhatsApp and
 *     Instagram need to show the picture rather than a bare link.
 *  2. Native share with text + link, when the browser refuses files (or the
 *     image is cross-origin and blocked).
 *  3. Clipboard, on desktop browsers with no share sheet at all.
 */
export default function ShareButton({
  title,
  description,
  image,
  url,
  className = '',
  label,
}: {
  title: string
  description?: string
  image?: string
  /** Defaults to the current page. */
  url?: string
  className?: string
  label?: string
}) {
  const [done, setDone] = useState(false)

  const flash = () => {
    setDone(true)
    setTimeout(() => setDone(false), 1600)
  }

  const asFile = async (src: string): Promise<File | null> => {
    try {
      const res = await fetch(src)
      if (!res.ok) return null
      const blob = await res.blob()
      if (!blob.type.startsWith('image/')) return null
      const ext = blob.type.split('/')[1]?.split('+')[0] ?? 'jpg'
      return new File([blob], `${title.replace(/[^\w-]+/g, '-').toLowerCase()}.${ext}`, {
        type: blob.type,
      })
    } catch {
      // Cross-origin images without permissive CORS land here; not an error
      // worth surfacing, we simply share without the file.
      return null
    }
  }

  const share = async () => {
    const link = url ?? (typeof window !== 'undefined' ? window.location.href : '')
    const text = description ? `${description}\n\n${link}` : link

    if (typeof navigator !== 'undefined' && navigator.share) {
      if (image) {
        const file = await asFile(image)
        if (file && navigator.canShare?.({ files: [file] })) {
          try {
            await navigator.share({ files: [file], title, text })
            flash()
            return
          } catch (e) {
            // A cancelled share sheet is not a failure.
            if ((e as Error)?.name === 'AbortError') return
          }
        }
      }
      try {
        await navigator.share({ title, text: description, url: link })
        flash()
        return
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') return
      }
    }

    try {
      await navigator.clipboard.writeText(`${title}\n${text}`)
      toast.success('Lien copié dans le presse-papier')
      flash()
    } catch {
      toast.error('Impossible de partager')
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      aria-label={`Partager ${title}`}
      title={`Partager ${title}`}
      className={`inline-flex items-center gap-1.5 transition-colors ${className}`}
    >
      {done ? <Check size={14} /> : <Share2 size={14} />}
      {label && <span>{label}</span>}
    </button>
  )
}
