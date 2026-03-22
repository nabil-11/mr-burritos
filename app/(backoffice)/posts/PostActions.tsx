'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Pencil, Trash2, Eye } from 'lucide-react'

export default function PostActions({ slug }: { slug: string }) {
  const router = useRouter()

  const deletePost = async () => {
    if (!confirm('Supprimer cet article ?')) return
    const res = await fetch(`/api/posts/${slug}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Article supprimé')
      router.refresh()
    } else {
      toast.error('Erreur')
    }
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <a href={`/blog/${slug}`} target="_blank" rel="noopener noreferrer"
        className="p-2 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors">
        <Eye size={15} />
      </a>
      <Link href={`/posts/${slug}/edit`}
        className="p-2 rounded-lg text-gray-400 hover:text-[#F5A800] hover:bg-[#F5A800]/10 transition-colors">
        <Pencil size={15} />
      </Link>
      <button onClick={deletePost}
        className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
        <Trash2 size={15} />
      </button>
    </div>
  )
}
