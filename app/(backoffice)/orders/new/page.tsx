import { connectDB } from '@/lib/mongodb'
import { DeliveryCompany } from '@/lib/models/DeliveryCompany'
import { getBuilderCategories } from '@/lib/builder'
import NewOrderForm from './NewOrderForm'

export default async function NewOrderPage() {
  await connectDB()

  const [categories, deliveryCompanies] = await Promise.all([
    getBuilderCategories(),
    DeliveryCompany.find({ isActive: true }).sort({ name: 1 }).lean(),
  ])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">Nouvelle commande</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Saisie manuelle — comptoir ou téléphone</p>
        </div>
      </div>
      <NewOrderForm
        categories={categories}
        deliveryCompanies={JSON.parse(JSON.stringify(deliveryCompanies))}
      />
    </div>
  )
}
