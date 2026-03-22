'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import ImageUpload from '@/components/backoffice/ImageUpload'

interface Post {
  _id?: string
  slug?: string
  title: { fr: string; ar: string }
  excerpt: { fr: string; ar: string }
  content: { fr: string; ar: string }
  image: string
  tags: string[]
  isPublished: boolean
}

interface Props {
  post?: Post
  onSaved?: () => void
}

export default function PostForm({ post, onSaved }: Props) {
  const router = useRouter()
  const isEdit = !!post

  const [form, setForm] = useState({
    title: { fr: post?.title?.fr ?? '', ar: post?.title?.ar ?? '' },
    excerpt: { fr: post?.excerpt?.fr ?? '', ar: post?.excerpt?.ar ?? '' },
    content: { fr: post?.content?.fr ?? '', ar: post?.content?.ar ?? '' },
    image: post?.image ?? '',
    tags: post?.tags?.join(', ') ?? '',
    isPublished: post?.isPublished ?? false,
  })
  const [loading, setLoading] = useState(false)

  const set = (field: string, value: unknown) =>
    setForm((prev) => ({ ...prev, [field]: value }))
  const setNested = (field: 'title' | 'excerpt' | 'content', lang: 'fr' | 'ar', value: string) =>
    setForm((prev) => ({ ...prev, [field]: { ...prev[field], [lang]: value } }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.fr.trim()) return toast.error('Titre (FR) requis')
    if (!form.content.fr.trim()) return toast.error('Contenu (FR) requis')
    setLoading(true)
    try {
      const payload = {
        ...form,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      }
      const url  = isEdit ? `/api/posts/${post!.slug}` : '/api/posts'
      const method = isEdit ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error()
      toast.success(isEdit ? 'Article mis à jour' : 'Article créé')
      if (onSaved) onSaved()
      else router.push('/posts')
    } catch {
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">

      {/* Title */}
      <div className="bg-white rounded-xl border p-5 space-y-4">
        <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest">Titre</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Français *</Label>
            <Input value={form.title.fr} onChange={(e) => setNested('title', 'fr', e.target.value)} placeholder="Titre de l'article" />
          </div>
          <div className="space-y-1.5">
            <Label>عربي</Label>
            <Input dir="rtl" value={form.title.ar} onChange={(e) => setNested('title', 'ar', e.target.value)} placeholder="عنوان المقال" />
          </div>
        </div>
      </div>

      {/* Excerpt */}
      <div className="bg-white rounded-xl border p-5 space-y-4">
        <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest">Résumé</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Français</Label>
            <textarea
              rows={2}
              value={form.excerpt.fr}
              onChange={(e) => setNested('excerpt', 'fr', e.target.value)}
              placeholder="Courte description…"
              className="w-full border border-input rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="space-y-1.5">
            <Label>عربي</Label>
            <textarea
              dir="rtl"
              rows={2}
              value={form.excerpt.ar}
              onChange={(e) => setNested('excerpt', 'ar', e.target.value)}
              placeholder="وصف قصير…"
              className="w-full border border-input rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl border p-5 space-y-4">
        <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest">Contenu *</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Français *</Label>
            <textarea
              rows={12}
              value={form.content.fr}
              onChange={(e) => setNested('content', 'fr', e.target.value)}
              placeholder="Rédigez votre article ici…"
              className="w-full border border-input rounded-md px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="space-y-1.5">
            <Label>عربي</Label>
            <textarea
              dir="rtl"
              rows={12}
              value={form.content.ar}
              onChange={(e) => setNested('content', 'ar', e.target.value)}
              placeholder="اكتب مقالك هنا…"
              className="w-full border border-input rounded-md px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
      </div>

      {/* Image + Tags + Publish */}
      <div className="grid sm:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border p-5 space-y-3">
          <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest">Image de couverture</h3>
          <ImageUpload value={form.image} onChange={(url) => set('image', url)} />
        </div>

        <div className="bg-white rounded-xl border p-5 space-y-5">
          <div className="space-y-1.5">
            <Label>Tags <span className="text-gray-400 font-normal">(séparés par virgule)</span></Label>
            <Input value={form.tags} onChange={(e) => set('tags', e.target.value)} placeholder="recette, actualité, promo" />
          </div>

          <div>
            <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Publication</h3>
            <label className="flex items-center gap-3 cursor-pointer group">
              <div
                onClick={() => set('isPublished', !form.isPublished)}
                className={`relative w-11 h-6 rounded-full transition-colors ${form.isPublished ? 'bg-[#F5A800]' : 'bg-gray-200'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${form.isPublished ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-sm font-medium">{form.isPublished ? 'Publié' : 'Brouillon'}</span>
            </label>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="bg-[#F5A800] hover:bg-[#FF6B00] disabled:opacity-50 text-black font-black px-8 py-3 rounded-xl text-sm transition-colors"
        >
          {loading ? 'Sauvegarde…' : isEdit ? 'Mettre à jour' : 'Créer l\'article'}
        </button>
        <button type="button" onClick={() => router.push('/posts')}
          className="px-6 py-3 rounded-xl text-sm border border-gray-200 hover:bg-gray-50 font-medium transition-colors">
          Annuler
        </button>
      </div>
    </form>
  )
}
