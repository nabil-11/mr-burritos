import { connectDB } from '@/lib/mongodb'
import { Supplement } from '@/lib/models/Supplement'
import { Badge } from '@/components/ui/badge'
import SupplementForm from './SupplementForm'

const typeLabels: Record<string, string> = { sauce: 'Sauce', size: 'Taille', extra: 'Extra' }

export default async function SupplementsPage() {
  await connectDB()
  const supplements = await Supplement.find().lean()

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Suppléments</h1>
        <SupplementForm />
      </div>
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {['Nom (FR)', 'Nom (AR)', 'Prix', 'Type', 'Statut'].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {(supplements as Record<string, unknown>[]).map((sup) => {
              const name = sup.name as { ar: string; fr: string }
              return (
                <tr key={String(sup._id)} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{name.fr}</td>
                  <td className="px-4 py-3">{name.ar}</td>
                  <td className="px-4 py-3 text-[#F5A800] font-bold">{(sup.price as number).toFixed(2)} DT</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{typeLabels[String(sup.type)] || String(sup.type)}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={sup.isActive ? 'default' : 'secondary'}>
                      {sup.isActive ? 'Actif' : 'Inactif'}
                    </Badge>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
