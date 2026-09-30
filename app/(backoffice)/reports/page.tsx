import ReportsClient from './ReportsClient'

export default function ReportsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Rapports</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Synthèse des recettes de caisse</p>
      </div>
      <ReportsClient />
    </div>
  )
}
