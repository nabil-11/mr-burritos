import PostForm from '../PostForm'

export default function NewPostPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Nouvel article</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Créer un nouvel article de blog</p>
      </div>
      <PostForm />
    </div>
  )
}
