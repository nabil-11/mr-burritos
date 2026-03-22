import { connectDB } from '@/lib/mongodb'
import { Category, Product } from '@/lib/models/index'
import { DeliveryCompany } from '@/lib/models/DeliveryCompany'
import NewOrderForm from './NewOrderForm'

export default async function NewOrderPage() {
  await connectDB()

  const categories = await Category.find({ isActive: true }).sort({ order: 1 }).lean()
  const products = await Product.find({ isAvailable: true, isActive: true })
    .populate('supplements')
    .populate('category')
    .lean()
  const deliveryCompanies = await DeliveryCompany.find({ isActive: true }).sort({ name: 1 }).lean()

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">Nouvelle commande</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Saisie manuelle — comptoir ou téléphone</p>
        </div>
      </div>
      <NewOrderForm
        products={JSON.parse(JSON.stringify(products))}
        categories={JSON.parse(JSON.stringify(categories))}
        deliveryCompanies={JSON.parse(JSON.stringify(deliveryCompanies))}
      />
    </div>
  )
}
