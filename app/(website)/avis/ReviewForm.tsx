'use client'

import { useState } from 'react'
import { toast } from 'sonner'

export default function ReviewForm() {
  const [form, setForm] = useState({ customerName: '', orderNumber: '', rating: 0, comment: '' })
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.customerName.trim()) return toast.error('Entrez votre prénom')
    if (!form.rating) return toast.error('Choisissez une note')
    setLoading(true)
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error()
      setSent(true)
      toast.success('Merci pour votre avis !')
    } catch {
      toast.error('Erreur, réessayez.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="text-center py-8">
        <p className="text-4xl mb-3">🎉</p>
        <p className="font-black text-[#1A1A1A]">Merci !</p>
        <p className="text-xs text-gray-500 mt-1">Votre avis sera publié après vérification.</p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {/* Star selector */}
      <div>
        <label className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-2">Note *</label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setForm({ ...form, rating: s })}
              className={`text-3xl transition-transform hover:scale-110 active:scale-95 ${s <= form.rating ? 'text-[#F5A800]' : 'text-gray-200 hover:text-[#F5A800]/50'}`}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-1.5">Prénom *</label>
        <input
          type="text"
          placeholder="Votre prénom"
          value={form.customerName}
          onChange={(e) => setForm({ ...form, customerName: e.target.value })}
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5A800] focus:border-transparent"
        />
      </div>

      <div>
        <label className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-1.5">
          N° de commande <span className="text-gray-300 normal-case font-medium">(facultatif)</span>
        </label>
        <input
          type="text"
          placeholder="ex: MB-20260323-0042"
          value={form.orderNumber}
          onChange={(e) => setForm({ ...form, orderNumber: e.target.value })}
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#F5A800] focus:border-transparent"
        />
      </div>

      <div>
        <label className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-1.5">Commentaire</label>
        <textarea
          placeholder="Partagez votre expérience…"
          rows={3}
          value={form.comment}
          onChange={(e) => setForm({ ...form, comment: e.target.value })}
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#F5A800] focus:border-transparent"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-[#F5A800] hover:bg-[#FF6B00] disabled:opacity-50 text-black font-black py-3 rounded-xl text-sm transition-colors"
      >
        {loading ? 'Envoi…' : 'Envoyer mon avis'}
      </button>
    </form>
  )
}
