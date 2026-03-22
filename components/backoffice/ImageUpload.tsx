'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { Upload, X, ImageIcon, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  value: string
  onChange: (url: string) => void
}

export default function ImageUpload({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)

  const upload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Fichier non supporté — images uniquement')
      return
    }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      if (!res.ok) throw new Error()
      const { url } = await res.json()
      onChange(url)
      toast.success('Image téléchargée')
    } catch {
      toast.error("Erreur lors de l'upload")
    } finally {
      setUploading(false)
    }
  }

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) upload(file)
    e.target.value = ''
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) upload(file)
  }

  return (
    <div className="space-y-2">
      {/* Preview */}
      {value ? (
        <div className="relative w-full h-48 rounded-xl overflow-hidden border border-gray-200 bg-gray-50 group">
          <Image
            src={value}
            alt="Product image"
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover"
          />
          {/* Overlay actions */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex items-center gap-1.5 bg-white text-[#1A1A1A] font-bold text-xs px-3 py-2 rounded-lg shadow hover:bg-[#F5A800] transition-colors"
            >
              <Upload size={13} /> Changer
            </button>
            <button
              type="button"
              onClick={() => onChange('')}
              className="flex items-center gap-1.5 bg-white text-red-500 font-bold text-xs px-3 py-2 rounded-lg shadow hover:bg-red-50 transition-colors"
            >
              <X size={13} /> Supprimer
            </button>
          </div>
        </div>
      ) : (
        /* Drop zone */
        <div
          onClick={() => !uploading && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`
            w-full h-48 rounded-xl border-2 border-dashed transition-all cursor-pointer
            flex flex-col items-center justify-center gap-3
            ${dragging
              ? 'border-[#F5A800] bg-[#F5A800]/5 scale-[1.01]'
              : 'border-gray-300 bg-gray-50 hover:border-[#F5A800]/60 hover:bg-[#F5A800]/5'
            }
            ${uploading ? 'pointer-events-none opacity-70' : ''}
          `}
        >
          {uploading ? (
            <>
              <Loader2 size={28} className="text-[#F5A800] animate-spin" />
              <p className="text-sm font-medium text-gray-500">Téléchargement en cours...</p>
            </>
          ) : (
            <>
              <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
                {dragging
                  ? <Upload size={22} className="text-[#F5A800]" />
                  : <ImageIcon size={22} className="text-gray-400" />
                }
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-[#1A1A1A]">
                  {dragging ? 'Déposer ici' : 'Cliquer ou glisser une image'}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">PNG, JPG, WEBP — max 10 MB</p>
              </div>
            </>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFileChange}
      />
    </div>
  )
}
