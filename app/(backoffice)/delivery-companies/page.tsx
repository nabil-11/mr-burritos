import { connectDB } from '@/lib/mongodb'
import { DeliveryCompany } from '@/lib/models/DeliveryCompany'
import { AddCompanyButton, EditCompanyButton, DeleteCompanyButton } from './DeliveryCompanyForm'
import StatusSwitch from '@/components/backoffice/StatusSwitch'

export default async function DeliveryCompaniesPage() {
  await connectDB()
  const companies = await DeliveryCompany.find().sort({ name: 1 }).lean()

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Sociétés de livraison</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Glovo, Presto, etc. — commissions appliquées aux commandes</p>
        </div>
        <AddCompanyButton />
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-100">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Société', 'Commission', 'Montant net (ex. 10 DT)', 'Actif', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {(companies as Record<string, unknown>[]).map((c) => {
                const commission = c.commission as number
                const net = (10 * (1 - commission / 100)).toFixed(2)
                return (
                  <tr key={String(c._id)} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[#1A1A1A]">{String(c.name)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 font-black text-sm px-2.5 py-1 rounded-full">
                        {commission}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      Vous recevez <span className="font-bold text-green-600">{net} DT</span> sur 10 DT
                    </td>
                    <td className="px-4 py-3">
                      <StatusSwitch
                        id={String(c._id)}
                        field="isActive"
                        checked={Boolean(c.isActive)}
                        apiPath="/api/delivery-companies"
                        label="Actif"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <EditCompanyButton company={{ _id: String(c._id), name: String(c.name), commission, isActive: Boolean(c.isActive) }} />
                        <DeleteCompanyButton company={{ _id: String(c._id), name: String(c.name), commission, isActive: Boolean(c.isActive) }} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {companies.length === 0 && (
          <p className="text-center text-muted-foreground py-10 text-sm">
            Aucune société — cliquez sur &ldquo;Ajouter&rdquo; pour commencer
          </p>
        )}
      </div>
    </div>
  )
}
