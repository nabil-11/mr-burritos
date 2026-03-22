import { connectDB } from '@/lib/mongodb'
import { Post } from '@/lib/models/Post'
import { notFound } from 'next/navigation'
import PostForm from '../../PostForm'

type Props = { params: Promise<{ slug: string }> }

export default async function EditPostPage({ params }: Props) {
  const { slug } = await params
  await connectDB()
  const post = await Post.findOne({ slug }).lean()
  if (!post) notFound()

  const p = post as {
    _id: unknown; slug: string
    title: { fr: string; ar: string }
    excerpt: { fr: string; ar: string }
    content: { fr: string; ar: string }
    image: string; tags: string[]; isPublished: boolean
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Modifier l&apos;article</h1>
        <p className="text-sm text-muted-foreground mt-0.5 font-mono">{p.slug}</p>
      </div>
      <PostForm post={p} />
    </div>
  )
}
