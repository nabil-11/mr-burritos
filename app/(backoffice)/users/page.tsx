import { connectDB } from '@/lib/mongodb'
import { User } from '@/lib/models/User'
import { Badge } from '@/components/ui/badge'
import UserForm from './UserForm'

export default async function UsersPage() {
  await connectDB()
  const users = await User.find().select('-password').sort({ createdAt: -1 }).lean()

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Utilisateurs</h1>
        <UserForm />
      </div>
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {['Nom', 'Email', 'Rôle', 'Statut', 'Créé le'].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {(users as Record<string, unknown>[]).map((u) => (
              <tr key={String(u._id)} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{String(u.name)}</td>
                <td className="px-4 py-3 text-muted-foreground">{String(u.email)}</td>
                <td className="px-4 py-3 capitalize">
                  <Badge variant="outline">{String(u.role)}</Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={u.isActive ? 'default' : 'secondary'}>{u.isActive ? 'Actif' : 'Inactif'}</Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">
                  {new Date(u.createdAt as string).toLocaleDateString('fr-FR')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
