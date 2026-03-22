import { connectDB } from '@/lib/mongodb'
import { Review } from '@/lib/models/Review'
import ReviewForm from './ReviewForm'

async function getApprovedReviews() {
  await connectDB()
  return Review.find({ isApproved: true }).sort({ createdAt: -1 }).lean()
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <span key={s} className={`text-lg ${s <= rating ? 'text-[#F5A800]' : 'text-gray-200'}`}>★</span>
      ))}
    </div>
  )
}

export default async function AvisPage() {
  const reviews = await getApprovedReviews()

  const avg = reviews.length
    ? (reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length).toFixed(1)
    : null

  return (
    <div className="min-h-screen bg-gray-50 pt-24 pb-16" dir="ltr">

      {/* Header */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 mb-12 text-center">
        <span className="inline-block bg-[#F5A800]/10 text-[#F5A800] text-xs font-black px-3 py-1 rounded-full uppercase tracking-widest mb-3">
          Avis clients
        </span>
        <h1 className="text-4xl font-black text-[#1A1A1A]">Ce que vous en pensez</h1>
        {avg && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <span className="text-4xl font-black text-[#F5A800]">{avg}</span>
            <div>
              <div className="flex gap-0.5">
                {[1,2,3,4,5].map((s) => (
                  <span key={s} className={`text-xl ${s <= Math.round(Number(avg)) ? 'text-[#F5A800]' : 'text-gray-200'}`}>★</span>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{reviews.length} avis</p>
            </div>
          </div>
        )}
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 grid lg:grid-cols-5 gap-10">

        {/* Left — submit form */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-gray-100 p-6 sticky top-28">
            <h2 className="font-black text-[#1A1A1A] text-lg mb-1">Laissez un avis</h2>
            <p className="text-xs text-gray-500 mb-5">Votre avis sera publié après modération.</p>
            <ReviewForm />
          </div>
        </div>

        {/* Right — list of reviews */}
        <div className="lg:col-span-3 space-y-4">
          {reviews.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-4xl mb-3">💬</p>
              <p className="font-semibold">Soyez le premier à laisser un avis !</p>
            </div>
          ) : (
            reviews.map((r) => {
              const rev = r as {
                _id: unknown; customerName: string; rating: number; comment: string;
                orderNumber: string; createdAt: Date
              }
              return (
                <div key={String(rev._id)} className="bg-white rounded-2xl border border-gray-100 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#F5A800]/10 flex items-center justify-center text-[#F5A800] font-black text-sm shrink-0">
                        {rev.customerName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-[#1A1A1A] text-sm">{rev.customerName}</p>
                        {rev.orderNumber && (
                          <p className="text-[10px] text-gray-400 font-mono">#{rev.orderNumber}</p>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0">
                      <Stars rating={rev.rating} />
                    </div>
                  </div>
                  {rev.comment && (
                    <p className="mt-3 text-gray-600 text-sm leading-relaxed">{rev.comment}</p>
                  )}
                  <p className="mt-3 text-[10px] text-gray-300 uppercase tracking-widest">
                    {new Date(rev.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
