import { connectDB } from '@/lib/mongodb'
import { Supplement, Product, Category } from '@/lib/models/index'
import { Badge } from '@/components/ui/badge'
import SupplementForm, { type ProductOption, type SerializedSupplement } from './SupplementForm'
import DeleteSupplement from './DeleteSupplement'
import StatusSwitch from '@/components/backoffice/StatusSwitch'

const TYPE_ORDER = ['size', 'viande', 'sauce', 'extra']
const typeLabels: Record<string, string> = { sauce: 'Sauce', size: 'Taille', viande: 'Viande', extra: 'Extra' }

type Doc = Record<string, unknown>

export default async function SupplementsPage() {
  await connectDB()
  const [rawSupplements, rawProducts, rawCategories] = await Promise.all([
    Supplement.find().sort({ price: 1 }).lean(),
    Product.find({ isActive: true }).select('name category isBase supplements').lean(),
    Category.find().select('name order').sort({ order: 1 }).lean(),
  ])
  const { sups, prods, cats } = JSON.parse(
    JSON.stringify({ sups: rawSupplements, prods: rawProducts, cats: rawCategories })
  ) as { sups: Doc[]; prods: Doc[]; cats: Doc[] }

  const supplements: SerializedSupplement[] = sups
    .map((s) => ({
      _id: String(s._id),
      name: s.name as { fr: string; ar: string },
      price: Number(s.price ?? 0),
      type: String(s.type ?? 'extra'),
      meatCount: Number(s.meatCount ?? 1),
      image: String(s.image ?? ''),
      layerImage: String(s.layerImage ?? ''),
      isActive: Boolean(s.isActive),
    }))
    .sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type))

  const typeOf = new Map(supplements.map((s) => [s._id, s.type]))
  const catName = new Map(cats.map((c) => [String(c._id), (c.name as { fr: string }).fr]))
  const catRank = new Map(cats.map((c, i) => [String(c._id), i]))

  const categoryOf = new Map(prods.map((p) => [String(p._id), String(p.category)]))
  const rankOf = (p: ProductOption) => catRank.get(categoryOf.get(p._id) ?? '') ?? 999

  const products: ProductOption[] = prods
    .map((p) => {
      const supplementIds = ((p.supplements ?? []) as unknown[]).map(String)
      return {
        _id: String(p._id),
        name: (p.name as { fr: string }).fr,
        category: catName.get(String(p.category)) ?? 'Sans catégorie',
        isBase: Boolean(p.isBase),
        offers: [...new Set(supplementIds.map((id) => typeOf.get(id)).filter(Boolean) as string[])],
        supplementIds,
      }
    })
    // Categories in menu order, the "à composer" base first, then by name.
    .sort(
      (a, b) =>
        rankOf(a) - rankOf(b) || Number(b.isBase) - Number(a.isBase) || a.name.localeCompare(b.name, 'fr')
    )

  const usage = (id: string) => products.filter((p) => p.supplementIds.includes(id)).length

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold">Suppléments</h1>
        <SupplementForm products={products} />
      </div>
      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-150">
          <thead className="bg-muted/50 border-b">
            <tr>
              {['Nom (FR)', 'Nom (AR)', 'Prix', 'Type', 'Produits', 'Actif', ''].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {supplements.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">Aucun supplément pour l’instant.</td>
              </tr>
            )}
            {supplements.map((sup) => {
              const count = usage(sup._id)
              return (
                <tr key={sup._id} className={`hover:bg-muted/50 ${sup.isActive ? '' : 'opacity-60'}`}>
                  <td className="px-4 py-3 font-medium">{sup.name.fr}</td>
                  <td className="px-4 py-3" dir="rtl">{sup.name.ar}</td>
                  <td className="px-4 py-3 text-[#F5A800] font-bold tabular-nums">{sup.price.toFixed(2)} DT</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge variant="outline">{typeLabels[sup.type] || sup.type}</Badge>
                    {sup.type === 'size' && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {sup.meatCount} viande{sup.meatCount > 1 ? 's' : ''}
                      </span>
                    )}
                  </td>
                  <td className={`px-4 py-3 tabular-nums ${count === 0 ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                    {count === 0 ? 'Aucun' : count}
                  </td>
                  <td className="px-4 py-3">
                    <StatusSwitch
                      id={sup._id}
                      field="isActive"
                      checked={sup.isActive}
                      apiPath="/api/supplements"
                      label="Actif"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <SupplementForm supplement={sup} products={products} />
                      <DeleteSupplement id={sup._id} name={sup.name.fr} productCount={count} />
                    </div>
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
