'use client'

import Image from 'next/image'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import ImageUpload from '@/components/backoffice/ImageUpload'
import { ImageIcon } from 'lucide-react'
import { toast } from 'sonner'

/**
 * The category's own photo, used first in the home page diaporama. Without it a
 * category falls back to its dishes' photos — which leaves families whose
 * dishes have none (burgers, bowls) with a blank card.
 */
export default function CategoryImage({
  id,
  name,
  image,
}: {
  id: string
  name: string
  image: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState(image)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: url }),
      })
      if (!res.ok) throw new Error()
      toast.success('Image mise à jour')
      setOpen(false)
      router.refresh()
    } catch {
      toast.error('Erreur lors de la mise à jour')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button className="relative w-14 h-10 rounded-lg overflow-hidden border bg-gray-50 hover:border-[#F5A800] transition-colors grid place-items-center">
            {image ? (
              <Image src={image} alt={name} fill sizes="56px" className="object-cover" />
            ) : (
              <ImageIcon size={14} className="text-gray-300" />
            )}
          </button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Image — {name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <ImageUpload value={url} onChange={setUrl} />
          <Button
            onClick={save}
            disabled={saving}
            className="w-full bg-[#F5A800] hover:bg-[#FF6B00] text-black font-bold"
          >
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
