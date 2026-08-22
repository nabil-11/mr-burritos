import { getBuilderCategories } from '@/lib/builder'
import KioskForm from './KioskForm'

// Staff change prices and availability mid-service; a prerendered kiosk would
// keep selling yesterday’s menu until the next deploy.
export const dynamic = 'force-dynamic'

export default async function CommanderPage() {
  const categories = await getBuilderCategories()
  return <KioskForm categories={categories} />
}
