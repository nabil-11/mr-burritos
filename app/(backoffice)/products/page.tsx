import { connectDB } from '@/lib/mongodb'
import { Product } from '@/lib/models/index'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import Image from 'next/image'

export default async function ProductsPage() {
  await connectDB()
  const products = await Product.find().populate('category').sort({ createdAt: -1 }).lean()

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Produits</h1>
        <Link href="/products/new" className="inline-flex items-center gap-1 bg-[#F5A800] hover:bg-[#FF6B00] text-black font-bold px-3 py-2 rounded-lg text-sm transition-colors"><Plus size={16} /> Nouveau produit</Link>
      </div>
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {['Image', 'Nom', 'Catégorie', 'Prix', 'Disponible', 'Statut', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {(products as Record<string, unknown>[]).map((p) => {
              const name = p.name as { ar: string; fr: string }
              const cat = p.category as Record<string, unknown> | null
              return (
                <tr key={String(p._id)} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    {p.image ? (
                      <Image src={String(p.image)} alt={name.fr} width={40} height={40} className="rounded-lg object-cover" />
                    ) : (
                      <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-lg">🌯</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{name.fr}</p>
                    <p className="text-xs text-muted-foreground">{name.ar}</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {cat ? String((cat.name as { fr: string }).fr) : '-'}
                  </td>
                  <td className="px-4 py-3 font-bold text-[#F5A800]">{(p.price as number).toFixed(2)} DT</td>
                  <td className="px-4 py-3">
                    <Badge variant={p.isAvailable ? 'default' : 'secondary'}>{p.isAvailable ? 'Oui' : 'Non'}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={p.isActive ? 'default' : 'secondary'}>{p.isActive ? 'Actif' : 'Inactif'}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/products/${p._id}`} className="inline-flex items-center px-2.5 py-1 rounded-lg border border-border text-xs hover:bg-muted transition-colors">Modifier</Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {products.length === 0 && <p className="text-center text-muted-foreground py-10">Aucun produit</p>}
      </div>
    </div>
  )
}
