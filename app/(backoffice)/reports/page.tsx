import ReportsClient from './ReportsClient'

export default function ReportsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1A1A1A]">Rapports</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Analyse des ventes et performances</p>
      </div>
      <ReportsClient />
    </div>
  )
}
