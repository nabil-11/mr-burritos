'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

export interface SerializedUser {
  _id: string
  name: string
  email: string
  phone: string
  role: string
  isActive: boolean
}

export default function UserActions({ user }: { user: SerializedUser }) {
  const router = useRouter()

  /* ── Edit state ── */
  const [editOpen, setEditOpen] = useState(false)
  const [editLoading, setEditLoading] = useState(false)
  const [editForm, setEditForm] = useState({
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    isActive: user.isActive,
    newPassword: '',
  })

  /* ── Delete state ── */
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  /* ── Handlers ── */
  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    setEditLoading(true)
    try {
      const body: Record<string, unknown> = {
        name: editForm.name,
        email: editForm.email,
        phone: editForm.phone,
        role: editForm.role,
        isActive: editForm.isActive,
      }
      if (editForm.newPassword.trim()) {
        body.newPassword = editForm.newPassword
      }
      const res = await fetch(`/api/users/${user._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      toast.success('Utilisateur mis à jour')
      setEditOpen(false)
      router.refresh()
    } catch {
      toast.error('Erreur lors de la mise à jour')
    } finally {
      setEditLoading(false)
    }
  }

  const handleDelete = async () => {
    setDeleteLoading(true)
    try {
      const res = await fetch(`/api/users/${user._id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Utilisateur supprimé')
      setDeleteOpen(false)
      router.refresh()
    } catch {
      toast.error('Erreur lors de la suppression')
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {/* ── Edit dialog ── */}
      <Dialog open={editOpen} onOpenChange={(o) => {
        setEditOpen(o)
        if (o) setEditForm({ name: user.name, email: user.email, phone: user.phone, role: user.role, isActive: user.isActive, newPassword: '' })
      }}>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600"
          onClick={() => setEditOpen(true)}
          title="Modifier"
        >
          <Pencil size={14} />
        </Button>
        <DialogContent>
          <DialogHeader><DialogTitle>Modifier l'utilisateur</DialogTitle></DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-1">
              <Label>Nom</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} required />
            </div>
            <div className="space-y-1">
              <Label>Téléphone</Label>
              <Input type="tel" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} placeholder="+212..." />
            </div>
            <div className="space-y-1">
              <Label>Rôle</Label>
              <Select value={editForm.role} onValueChange={(v) => v && setEditForm({ ...editForm, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="delivery">Delivery</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Statut</Label>
              <Select value={editForm.isActive ? 'active' : 'inactive'} onValueChange={(v) => setEditForm({ ...editForm, isActive: v === 'active' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Actif</SelectItem>
                  <SelectItem value="inactive">Inactif</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Nouveau mot de passe <span className="text-muted-foreground text-xs">(laisser vide pour ne pas changer)</span></Label>
              <Input type="password" value={editForm.newPassword} onChange={(e) => setEditForm({ ...editForm, newPassword: e.target.value })} placeholder="••••••••" />
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setEditOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={editLoading} className="flex-1 bg-[#F5A800] hover:bg-[#FF6B00] text-black font-bold">
                {editLoading ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete dialog ── */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
          onClick={() => setDeleteOpen(true)}
          title="Supprimer"
        >
          <Trash2 size={14} />
        </Button>
        <DialogContent>
          <DialogHeader><DialogTitle>Supprimer l'utilisateur</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Êtes-vous sûr de vouloir supprimer <span className="font-semibold text-foreground">{user.name}</span> ?
            Cette action est irréversible.
          </p>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteOpen(false)}>Annuler</Button>
            <Button
              disabled={deleteLoading}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold"
              onClick={handleDelete}
            >
              {deleteLoading ? 'Suppression...' : 'Supprimer'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
