'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import type { ExportDocument, ExportFormat } from '@/lib/tableExport'

/**
 * Les quatre exports d'une page : PDF, Excel, Word, CSV.
 *
 * Le document arrive tout construit de la page serveur — les mêmes chiffres
 * que l'écran. L'écriture des fichiers (et jsPDF) n'est chargée qu'au clic.
 */

const FORMATS: { format: ExportFormat; label: string; title: string }[] = [
  { format: 'pdf', label: 'PDF', title: 'Exporter en PDF — à imprimer ou envoyer' },
  { format: 'xlsx', label: 'Excel', title: 'Exporter en Excel (.xlsx) — une feuille par tableau' },
  { format: 'docx', label: 'Word', title: 'Exporter en Word (.docx)' },
  { format: 'csv', label: 'CSV', title: 'Exporter en CSV (séparateur point-virgule)' },
]

export default function ExportButtons({ doc }: { doc: ExportDocument }) {
  const [busy, setBusy] = useState<ExportFormat | null>(null)
  const empty = doc.tables.every((t) => t.rows.length === 0)

  const run = async (format: ExportFormat, label: string) => {
    setBusy(format)
    try {
      const { exportDocument } = await import('@/lib/tableExport')
      await exportDocument(doc, format)
    } catch (e) {
      toast.error(e instanceof Error ? `Export ${label} impossible : ${e.message}` : `Export ${label} impossible`)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="inline-flex items-center rounded-lg border border-border bg-card overflow-hidden text-sm">
      <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-muted-foreground border-r border-border">
        <Download size={14} /> Exporter
      </span>
      {FORMATS.map(({ format, label, title }, i) => (
        <button
          key={format}
          onClick={() => run(format, label)}
          disabled={empty || busy !== null}
          title={title}
          className={`px-3 py-2 font-semibold hover:bg-[#F5A800] hover:text-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-inherit ${
            i > 0 ? 'border-l border-border' : ''
          }`}
        >
          {busy === format ? '…' : label}
        </button>
      ))}
    </div>
  )
}
