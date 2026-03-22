import { connectDB } from '@/lib/mongodb'
import { Category, Product } from '@/lib/models/index'
import KioskForm from './KioskForm'

export default async function CommanderPage() {
  await connectDB()

  const categories = await Category.find({ isActive: true }).sort({ order: 1 }).lean()
  const products = await Product.find({ isAvailable: true, isActive: true })
    .populate('supplements')
    .populate('category')
    .lean()

  return (
    <KioskForm
      products={JSON.parse(JSON.stringify(products))}
      categories={JSON.parse(JSON.stringify(categories))}
    />
  )
}
