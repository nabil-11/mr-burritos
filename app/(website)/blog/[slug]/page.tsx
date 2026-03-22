import { connectDB } from '@/lib/mongodb'
import { Post } from '@/lib/models/Post'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

type Props = { params: Promise<{ slug: string }> }

async function getPost(slug: string) {
  await connectDB()
  return Post.findOne({ slug, isPublished: true }).lean()
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params
  const post = await getPost(slug)
  if (!post) notFound()

  const p = post as {
    title: { fr: string; ar: string }
    content: { fr: string; ar: string }
    excerpt: { fr: string }
    image: string
    tags: string[]
    publishedAt: Date | null
    createdAt: Date
  }

  const fmtDate = (d: Date | string) =>
    new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="min-h-screen bg-white pt-20 pb-16" dir="ltr">

      {/* Hero image */}
      {p.image && (
        <div className="relative h-72 sm:h-96 w-full overflow-hidden">
          <Image src={p.image} alt={p.title.fr} fill sizes="100vw" className="object-cover" priority />
          <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent" />
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 sm:px-6">

        {/* Back link */}
        <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm text-[#F5A800] font-semibold mt-8 hover:underline">
          ← Retour au blog
        </Link>

        {/* Tags */}
        {p.tags?.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {p.tags.map((tag) => (
              <span key={tag} className="bg-[#F5A800]/10 text-[#F5A800] text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Title */}
        <h1 className="text-3xl sm:text-4xl font-black text-[#1A1A1A] mt-4 leading-tight">{p.title.fr}</h1>
        {p.excerpt?.fr && (
          <p className="text-gray-500 text-base mt-3 leading-relaxed">{p.excerpt.fr}</p>
        )}
        <p className="text-xs text-gray-400 mt-3 uppercase tracking-widest">
          Publié le {fmtDate(p.publishedAt || p.createdAt)}
        </p>

        <hr className="my-8 border-gray-100" />

        {/* Content */}
        <div className="prose prose-lg max-w-none text-[#1A1A1A]">
          {p.content.fr.split('\n').map((para, i) =>
            para.trim() ? (
              <p key={i} className="mb-4 leading-relaxed text-gray-700">{para}</p>
            ) : (
              <br key={i} />
            )
          )}
        </div>

        {/* Arabic content if available */}
        {p.content.ar && (
          <>
            <hr className="my-10 border-gray-100" />
            <div dir="rtl" className="text-right">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">عربي</span>
              <div className="mt-4 space-y-4 text-gray-700 leading-relaxed text-base font-arabic">
                {p.content.ar.split('\n').map((para, i) =>
                  para.trim() ? <p key={i}>{para}</p> : <br key={i} />
                )}
              </div>
            </div>
          </>
        )}

        <hr className="my-10 border-gray-100" />

        {/* CTA */}
        <div className="bg-gradient-to-br from-[#F5A800]/10 to-[#FF6B00]/5 rounded-2xl p-6 text-center border border-[#F5A800]/20">
          <p className="font-black text-[#1A1A1A] text-lg">Vous avez envie d&apos;un bon burrito ?</p>
          <p className="text-gray-500 text-sm mt-1">Commandez en ligne ou passez nous voir !</p>
          <Link href="/menu"
            className="inline-block mt-4 bg-[#F5A800] hover:bg-[#FF6B00] text-black font-black px-6 py-2.5 rounded-full text-sm transition-colors">
            Voir le menu →
          </Link>
        </div>
      </div>
    </div>
  )
}
