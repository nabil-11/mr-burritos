import PayoutsClient from './PayoutsClient'

export default function PlatformPayoutsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Règlements plateformes</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Glovo, Presto &amp; co encaissent le client et reversent à la semaine ou au mois — voici ce
          qu&apos;elles doivent, et ce qu&apos;elles ont versé.
        </p>
      </div>
      <PayoutsClient />
    </div>
  )
}
