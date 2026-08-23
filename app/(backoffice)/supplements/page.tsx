import { connectDB } from '@/lib/mongodb'
import { Supplement } from '@/lib/models/Supplement'
import { Badge } from '@/components/ui/badge'
import SupplementForm from './SupplementForm'
import StatusSwitch from '@/components/backoffice/StatusSwitch'

const typeLabels: Record<string, string> = { sauce: 'Sauce', size: 'Taille', viande: 'Viande', extra: 'Extra' }

export default async function SupplementsPage() {
  await connectDB()
  const supplements = await Supplement.find().lean()

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Suppléments</h1>
        <SupplementForm />
      </div>
      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-125">
          <thead className="bg-muted/50 border-b">
            <tr>
              {['Nom (FR)', 'Nom (AR)', 'Prix', 'Type', 'Actif'].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {(supplements as Record<string, unknown>[]).map((sup) => {
              const name = sup.name as { ar: string; fr: string }
              return (
                <tr key={String(sup._id)} className="hover:bg-muted/50">
                  <td className="px-4 py-3 font-medium">{name.fr}</td>
                  <td className="px-4 py-3">{name.ar}</td>
                  <td className="px-4 py-3 text-[#F5A800] font-bold">{(sup.price as number).toFixed(2)} DT</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{typeLabels[String(sup.type)] || String(sup.type)}</Badge>
                    {sup.type === 'size' && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {Number(sup.meatCount ?? 1)} viande{Number(sup.meatCount ?? 1) > 1 ? 's' : ''}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusSwitch
                      id={String(sup._id)}
                      field="isActive"
                      checked={Boolean(sup.isActive)}
                      apiPath="/api/supplements"
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
