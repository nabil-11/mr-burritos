import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken } from '@/lib/auth'
import Sidebar from '@/components/backoffice/Sidebar'

export default async function BackofficeLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  const payload = token ? verifyToken(token) : null

  if (!payload) redirect('/login')

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50" dir="ltr">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-4 lg:p-6 pt-18 lg:pt-6">
        {children}
      </main>
    </div>
  )
}
