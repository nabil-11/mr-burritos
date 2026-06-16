import { connectDB } from '@/lib/mongodb'
import { User } from '@/lib/models/User'
import { Badge } from '@/components/ui/badge'
import UserForm from './UserForm'
import UserActions, { type SerializedUser } from './UserActions'

export default async function UsersPage() {
  await connectDB()
  const raw = await User.find().select('-password').sort({ createdAt: -1 }).lean()

  const users: (SerializedUser & { createdAt: string })[] = (raw as any[]).map((u) => ({
    _id: String(u._id),
    name: u.name,
    email: u.email,
    phone: u.phone || '',
    role: u.role,
    isActive: Boolean(u.isActive),
    createdAt: u.createdAt instanceof Date ? u.createdAt.toISOString() : String(u.createdAt),
  }))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Utilisateurs</h1>
        <UserForm />
      </div>
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Nom', 'Email', 'Téléphone', 'Rôle', 'Statut', 'Créé le', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((u) => (
                <tr key={u._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{u.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-3 text-muted-foreground">{u.phone || '—'}</td>
                  <td className="px-4 py-3 capitalize">
                    <Badge variant="outline">{u.role}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={u.isActive ? 'default' : 'secondary'}>
                      {u.isActive ? 'Actif' : 'Inactif'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {new Date(u.createdAt).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-4 py-3">
                    <UserActions user={u} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
