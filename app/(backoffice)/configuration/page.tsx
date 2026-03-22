import { connectDB } from '@/lib/mongodb'
import { Configuration } from '@/lib/models/Configuration'
import ConfigForm from './ConfigForm'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

export default async function ConfigurationPage() {
  await connectDB()
  const configs = await Configuration.find().lean()

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Configuration</h1>
        <ConfigForm />
      </div>
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {['Clé', 'Valeur', 'Type', 'Description'].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {(configs as Record<string, unknown>[]).map((c) => (
              <tr key={String(c._id)} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono font-bold text-sm">{String(c.key)}</td>
                <td className="px-4 py-3 max-w-xs truncate">{String(c.value)}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{String(c.type)}</td>
                <td className="px-4 py-3 text-muted-foreground">{String(c.description)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {configs.length === 0 && (
          <div className="text-center py-10 text-muted-foreground">
            <p className="mb-3">Aucune configuration</p>
            <Button variant="outline" size="sm">
              <Plus size={14} className="mr-1" /> Ajouter une clé
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
