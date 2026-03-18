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
  const [form, setForm] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
  })
  const [error, setError] = useState('')

  const loadAdmins = useCallback(async () => {
    const res = await fetch('/api/admins')
    if (res.ok) setAdmins(await res.json())
  }, [])

  useEffect(() => {
    loadAdmins()
  }, [loadAdmins])

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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">{PL.nav.manageAdmins}</h1>
        <button
          onClick={() => setShowForm(true)}
          className="bg-[var(--color-primary)] text-white px-4 py-2 rounded hover:bg-[var(--color-primary-light)]"
        >
          {PL.admin.addAdmin}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-bold mb-4">{PL.admin.addAdmin}</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {PL.player.firstName} *
              </label>
              <input
                type="text"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {PL.player.lastName} *
              </label>
              <input
                type="text"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {PL.admin.email} *
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {PL.admin.password} *
              </label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                minLength={6}
                className="w-full px-3 py-2 border border-gray-300 rounded"
              />
            </div>
            {error && (
              <p className="text-red-600 text-sm col-span-2">{error}</p>
            )}
            <div className="flex gap-2 col-span-2">
              <button
                type="submit"
                className="bg-[var(--color-primary)] text-white px-6 py-2 rounded hover:bg-[var(--color-primary-light)]"
              >
                {PL.common.save}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="bg-gray-300 text-gray-700 px-6 py-2 rounded hover:bg-gray-400"
              >
                {PL.common.cancel}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-800 text-white">
              <th className="text-left py-3 px-4">{PL.standings.player}</th>
              <th className="text-left py-3 px-4">{PL.admin.email}</th>
              <th className="text-right py-3 px-4">Akcje</th>
            </tr>
          </thead>
          <tbody>
            {admins.map((admin, i) => (
              <tr key={admin.id} className={`border-b ${i % 2 === 0 ? 'bg-gray-50' : ''}`}>
                <td className="py-3 px-4 font-medium">
                  {admin.firstName} {admin.lastName}
                </td>
                <td className="py-3 px-4 text-gray-500">{admin.email}</td>
                <td className="py-3 px-4 text-right">
                  <button
                    onClick={() => handleDelete(admin.id)}
                    className="text-red-600 hover:underline text-sm"
                  >
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
