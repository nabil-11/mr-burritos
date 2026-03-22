import { connectDB } from '@/lib/mongodb'
import { Category } from '@/lib/models/Category'
import CategoryForm from './CategoryForm'
import StatusSwitch from '@/components/backoffice/StatusSwitch'

export default async function CategoriesPage() {
  await connectDB()
  const categories = await Category.find().sort({ order: 1 }).lean()

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Catégories</h1>
        <CategoryForm />
      </div>
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-125">
          <thead className="bg-gray-50 border-b">
            <tr>
              {['Nom (FR)', 'Nom (AR)', 'Slug', 'Ordre', 'Actif'].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {(categories as Record<string, unknown>[]).map((cat) => {
              const name = cat.name as { ar: string; fr: string }
              return (
                <tr key={String(cat._id)} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{name.fr}</td>
                  <td className="px-4 py-3">{name.ar}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{String(cat.slug)}</td>
                  <td className="px-4 py-3">{String(cat.order)}</td>
                  <td className="px-4 py-3">
                    <StatusSwitch
                      id={String(cat._id)}
                      field="isActive"
                      checked={Boolean(cat.isActive)}
                      apiPath="/api/categories"
                      label="Actif"
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}
