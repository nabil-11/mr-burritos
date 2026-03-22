import { connectDB } from '@/lib/mongodb'
import { Product, Category, Supplement } from '@/lib/models/index'
import ProductEditForm from './ProductEditForm'

type Props = { params: Promise<{ id: string }> }

export default async function ProductEditPage({ params }: Props) {
  const { id } = await params
  await connectDB()

  const [categories, supplements] = await Promise.all([
    Category.find({ isActive: true }).lean(),
    Supplement.find({ isActive: true }).lean(),
  ])

  let product = null
  if (id !== 'new') {
    product = await Product.findById(id).lean()
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">{product ? 'Modifier le produit' : 'Nouveau produit'}</h1>
      <ProductEditForm
        product={product ? JSON.parse(JSON.stringify(product)) : null}
        categories={JSON.parse(JSON.stringify(categories))}
        supplements={JSON.parse(JSON.stringify(supplements))}
      />
    </div>
  )
}
