import { connectDB } from '@/lib/mongodb'
import { Post } from '@/lib/models/Post'
import Link from 'next/link'
import Image from 'next/image'
import PostActions from './PostActions'

async function getPosts() {
  await connectDB()
  return Post.find({}).sort({ createdAt: -1 }).lean()
}

export default async function PostsPage() {
  const posts = await getPosts()

  const fmtDate = (d: Date | string) =>
    new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Blog</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{posts.length} article{posts.length > 1 ? 's' : ''}</p>
        </div>
        <Link href="/posts/new"
          className="bg-[#F5A800] hover:bg-[#FF6B00] text-black font-black px-5 py-2.5 rounded-xl text-sm transition-colors">
          + Nouvel article
        </Link>
      </div>

      {posts.length === 0 ? (
        <div className="text-center py-24 text-muted-foreground bg-white rounded-xl border">
          <p className="text-4xl mb-3">📝</p>
          <p className="font-semibold">Aucun article</p>
          <p className="text-sm mt-1">Créez votre premier article de blog</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-150">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Article</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tags</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Statut</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {posts.map((post) => {
                  const p = post as {
                    _id: unknown; slug: string; title: { fr: string }; image: string;
                    tags: string[]; isPublished: boolean; publishedAt: Date | null; createdAt: Date
                  }
                  return (
                    <tr key={String(p._id)} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {p.image ? (
                            <div className="relative w-12 h-10 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                              <Image src={p.image} alt={p.title.fr} fill sizes="48px" className="object-cover" />
                            </div>
                          ) : (
                            <div className="w-12 h-10 rounded-lg bg-[#F5A800]/10 flex items-center justify-center text-xl shrink-0">🌯</div>
                          )}
                          <div className="min-w-0">
                            <p className="font-semibold truncate max-w-xs">{p.title.fr}</p>
                            <p className="text-xs text-muted-foreground font-mono">{p.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {p.tags?.slice(0, 2).map((tag) => (
                            <span key={tag} className="text-[10px] bg-gray-100 px-2 py-0.5 rounded-full text-gray-500">{tag}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${p.isPublished ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {p.isPublished ? '● Publié' : '○ Brouillon'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {fmtDate(p.publishedAt || p.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <PostActions slug={p.slug} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
