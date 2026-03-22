import { connectDB } from '@/lib/mongodb'
import { Review } from '@/lib/models/Review'
import ReviewActions from './ReviewActions'

async function getReviews() {
  await connectDB()
  return Review.find({}).sort({ createdAt: -1 }).lean()
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-sm tracking-tight">
      {[1,2,3,4,5].map((s) => (
        <span key={s} className={s <= rating ? 'text-[#F5A800]' : 'text-gray-200'}>★</span>
      ))}
    </span>
  )
}

export default async function ReviewsPage() {
  const reviews = await getReviews()
  const pending  = reviews.filter((r) => !r.isApproved).length
  const approved = reviews.filter((r) => r.isApproved).length

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Avis clients</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {pending > 0 && <span className="text-orange-500 font-semibold">{pending} en attente · </span>}
            {approved} approuvé{approved > 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {reviews.length === 0 ? (
        <div className="text-center py-24 text-muted-foreground bg-white rounded-xl border">
          <p className="text-4xl mb-3">💬</p>
          <p className="font-semibold">Aucun avis pour le moment</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-160">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Client</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Note</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Commentaire</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">N° commande</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Statut</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {reviews.map((review) => {
                  const r = review as {
                    _id: unknown; customerName: string; rating: number; comment: string;
                    orderNumber: string; isApproved: boolean; createdAt: Date
                  }
                  return (
                    <tr key={String(r._id)} className={`hover:bg-gray-50 ${!r.isApproved ? 'bg-orange-50/30' : ''}`}>
                      <td className="px-4 py-3 font-semibold">{r.customerName}</td>
                      <td className="px-4 py-3"><Stars rating={r.rating} /></td>
                      <td className="px-4 py-3 text-muted-foreground max-w-xs">
                        <p className="truncate">{r.comment || <span className="italic text-gray-300">—</span>}</p>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {r.orderNumber || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${r.isApproved ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-600'}`}>
                          {r.isApproved ? '✓ Approuvé' : '⏳ En attente'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(r.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <ReviewActions id={String(r._id)} isApproved={r.isApproved} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
