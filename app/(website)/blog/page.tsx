import { connectDB } from '@/lib/mongodb'
import { Post } from '@/lib/models/Post'
import Link from 'next/link'
import Image from 'next/image'

async function getPosts() {
  await connectDB()
  return Post.find({ isPublished: true }).sort({ publishedAt: -1 }).lean()
}

export default async function BlogPage() {
  const posts = await getPosts()

  const fmtDate = (d: Date | string) =>
    new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="min-h-screen bg-gray-50 pt-24 pb-16" dir="ltr">
      {/* Header */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 mb-12 text-center">
        <span className="inline-block bg-[#F5A800]/10 text-[#F5A800] text-xs font-black px-3 py-1 rounded-full uppercase tracking-widest mb-3">
          Blog
        </span>
        <h1 className="text-4xl font-black text-[#1A1A1A]">Actualités & Recettes</h1>
        <p className="text-gray-500 mt-2 text-sm">Conseils, nouveautés et inspirations culinaires de Mr. Burritos</p>
      </div>

      {/* Posts grid */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        {posts.length === 0 ? (
          <div className="text-center py-24 text-gray-400">
            <p className="text-5xl mb-4">📝</p>
            <p className="text-lg font-semibold">Aucun article pour le moment</p>
            <p className="text-sm mt-1">Revenez bientôt !</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post) => {
              const p = post as {
                _id: unknown; slug: string; title: { fr: string }; excerpt: { fr: string };
                image: string; tags: string[]; publishedAt: Date | null; createdAt: Date
              }
              return (
                <Link key={String(p._id)} href={`/blog/${p.slug}`}
                  className="group bg-white rounded-2xl overflow-hidden border border-gray-100 hover:border-[#F5A800]/40 hover:shadow-lg transition-all duration-200">
                  {/* Image */}
                  <div className="relative h-48 bg-gradient-to-br from-[#F5A800]/10 to-[#FF6B00]/10 overflow-hidden">
                    {p.image ? (
                      <Image src={p.image} alt={p.title.fr} fill sizes="400px" className="object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-5xl">🌯</div>
                    )}
                    {p.tags?.length > 0 && (
                      <span className="absolute top-3 left-3 bg-[#F5A800] text-black text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                        {p.tags[0]}
                      </span>
                    )}
                  </div>
                  {/* Content */}
                  <div className="p-5">
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-2">
                      {fmtDate(p.publishedAt || p.createdAt)}
                    </p>
                    <h2 className="font-black text-[#1A1A1A] text-base leading-snug group-hover:text-[#F5A800] transition-colors line-clamp-2">
                      {p.title.fr}
                    </h2>
                    {p.excerpt?.fr && (
                      <p className="text-gray-500 text-xs mt-2 line-clamp-3 leading-relaxed">{p.excerpt.fr}</p>
                    )}
                    <p className="mt-4 text-[#F5A800] text-xs font-bold flex items-center gap-1">
                      Lire la suite <span className="group-hover:translate-x-1 transition-transform">→</span>
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
