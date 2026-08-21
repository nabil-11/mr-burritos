import { getBuilderCategories } from '@/lib/builder'
import KioskForm from './KioskForm'

export default async function CommanderPage() {
  const categories = await getBuilderCategories()
  return <KioskForm categories={categories} />
}
