'use client'

import { useState, useEffect, useCallback } from 'react'
import { PL } from '@/constants/pl'

interface Admin {
  id: number
  email: string
  firstName: string
  lastName: string
}

export default function AdminUsersPage() {
  const [admins, setAdmins] = useState<Admin[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '' })
  const [error, setError] = useState('')

  const loadAdmins = useCallback(async () => {
    const res = await fetch('/api/admins')
    if (res.ok) setAdmins(await res.json())
  }, [])

  useEffect(() => { loadAdmins() }, [loadAdmins])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const res = await fetch('/api/admins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (!res.ok) {
      const data = await res.json()
      setError(data.error)
      return
    }
    setForm({ email: '', password: '', firstName: '', lastName: '' })
    setShowForm(false)
    loadAdmins()
  }

  const handleDelete = async (id: number) => {
    if (!confirm(PL.admin.confirmDelete)) return
    const res = await fetch('/api/admins', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (!res.ok) {
      const data = await res.json()
      alert(data.error)
      return
    }
    loadAdmins()
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-3xl font-bold text-[var(--color-primary)]" style={{ fontFamily: 'Raleway, sans-serif' }}>
            {PL.nav.manageAdmins}
          </h1>
          <div className="flex items-center gap-3 mt-2">
            <span className="inline-block w-10 h-0.5 bg-[var(--color-accent)]"></span>
          </div>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary text-sm">
          + {PL.admin.addAdmin}
        </button>
      </div>

      {showForm && (
        <div className="card p-6 mb-8">
          <h3 className="font-bold text-[var(--color-text-dark)] mb-4">{PL.admin.addAdmin}</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-body)]/60 mb-2">
                {PL.player.firstName} *
              </label>
              <input type="text" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                required className="w-full px-4 py-2.5 border border-[var(--color-border)] rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-body)]/60 mb-2">
                {PL.player.lastName} *
              </label>
              <input type="text" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                required className="w-full px-4 py-2.5 border border-[var(--color-border)] rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-body)]/60 mb-2">
                Email *
              </label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                required className="w-full px-4 py-2.5 border border-[var(--color-border)] rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-body)]/60 mb-2">
                Hasło *
              </label>
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                required minLength={6} className="w-full px-4 py-2.5 border border-[var(--color-border)] rounded-lg" />
            </div>
            {error && <p className="text-[var(--color-danger)] text-sm md:col-span-2">{error}</p>}
            <div className="flex gap-3 md:col-span-2">
              <button type="submit" className="btn-secondary text-sm">{PL.common.save}</button>
              <button type="button" onClick={() => setShowForm(false)} className="text-sm text-[var(--color-text-body)]">{PL.common.cancel}</button>
            </div>
          </form>
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <table className="standings-table w-full text-sm">
          <thead>
            <tr>
              <th className="text-left">{PL.standings.player}</th>
              <th className="text-left">Email</th>
              <th className="text-right">Akcje</th>
            </tr>
          </thead>
          <tbody>
            {admins.map((admin) => (
              <tr key={admin.id}>
                <td className="font-semibold text-[var(--color-text-dark)]">
                  {admin.firstName} {admin.lastName}
                </td>
                <td className="text-[var(--color-text-body)]/50">{admin.email}</td>
                <td className="text-right">
                  <button onClick={() => handleDelete(admin.id)} className="text-[var(--color-danger)] hover:text-[var(--color-danger)]/70 text-xs font-semibold transition-colors">
                    {PL.common.delete}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
