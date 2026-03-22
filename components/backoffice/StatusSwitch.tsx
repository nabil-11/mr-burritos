'use client'

import { useState } from 'react'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'

interface Props {
  id: string
  field: string
  checked: boolean
  apiPath: string   // e.g. /api/products, /api/categories
  label?: string    // optional label shown beside the switch
}

export default function StatusSwitch({ id, field, checked, apiPath, label }: Props) {
  const [value, setValue] = useState(checked)
  const [loading, setLoading] = useState(false)

  const toggle = async () => {
    const next = !value
    setValue(next) // optimistic
    setLoading(true)
    try {
      const res = await fetch(`${apiPath}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: next }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setValue(!next) // revert on error
      toast.error('Erreur lors de la mise à jour')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Switch
        checked={value}
        onCheckedChange={toggle}
        disabled={loading}
        className="data-[state=checked]:bg-[#F5A800]"
      />
      {label && (
        <span className={`text-xs font-medium ${value ? 'text-[#1A1A1A]' : 'text-gray-400'}`}>
          {value ? label : 'Non'}
        </span>
      )}
    </div>
  )
}
