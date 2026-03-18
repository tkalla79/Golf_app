'use client'

import { useState, useEffect, useCallback } from 'react'
import { PL } from '@/constants/pl'

interface Player {
  id: number
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  hcp: number | null
  slug: string
  active: boolean
}

export default function AdminPlayersPage() {
  const [players, setPlayers] = useState<Player[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null)
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    hcp: '',
  })

  const loadPlayers = useCallback(async () => {
    const res = await fetch('/api/players')
    setPlayers(await res.json())
  }, [])

  useEffect(() => {
    loadPlayers()
  }, [loadPlayers])

  const resetForm = () => {
    setForm({ firstName: '', lastName: '', email: '', phone: '', hcp: '' })
    setEditingPlayer(null)
    setShowForm(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (editingPlayer) {
      await fetch(`/api/players/${editingPlayer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
    } else {
      await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
    }

    resetForm()
    loadPlayers()
  }

  const handleEdit = (player: Player) => {
    setForm({
      firstName: player.firstName,
      lastName: player.lastName,
      email: player.email || '',
      phone: player.phone || '',
      hcp: player.hcp !== null ? String(player.hcp) : '',
    })
    setEditingPlayer(player)
    setShowForm(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm(PL.admin.confirmDelete)) return
    await fetch(`/api/players/${id}`, { method: 'DELETE' })
    loadPlayers()
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">{PL.nav.managePlayers}</h1>
        <button
          onClick={() => setShowForm(true)}
          className="bg-[var(--color-primary)] text-white px-4 py-2 rounded hover:bg-[var(--color-primary-light)] transition-colors"
        >
          {PL.player.addPlayer}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-bold mb-4">
            {editingPlayer ? PL.player.editPlayer : PL.player.addPlayer}
          </h2>
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
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-[var(--color-primary)]"
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
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {PL.player.email}
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {PL.player.phone}
              </label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {PL.player.hcp}
              </label>
              <input
                type="number"
                step="0.1"
                value={form.hcp}
                onChange={(e) => setForm({ ...form, hcp: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                type="submit"
                className="bg-[var(--color-primary)] text-white px-6 py-2 rounded hover:bg-[var(--color-primary-light)]"
              >
                {PL.common.save}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-300 text-gray-700 px-6 py-2 rounded hover:bg-gray-400"
              >
                {PL.common.cancel}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-800 text-white">
              <th className="text-left py-3 px-4">{PL.standings.player}</th>
              <th className="text-center py-3 px-4 hidden md:table-cell">{PL.player.email}</th>
              <th className="text-center py-3 px-4 hidden md:table-cell">{PL.player.phone}</th>
              <th className="text-center py-3 px-4">{PL.player.hcp}</th>
              <th className="text-right py-3 px-4">Akcje</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player, i) => (
              <tr
                key={player.id}
                className={`border-b hover:bg-gray-50 ${i % 2 === 0 ? 'bg-gray-50' : ''}`}
              >
                <td className="py-3 px-4 font-medium">
                  {player.firstName} {player.lastName}
                </td>
                <td className="py-3 px-4 text-center text-gray-500 hidden md:table-cell">
                  {player.email || '-'}
                </td>
                <td className="py-3 px-4 text-center text-gray-500 hidden md:table-cell">
                  {player.phone || '-'}
                </td>
                <td className="py-3 px-4 text-center">
                  {player.hcp !== null ? Number(player.hcp).toFixed(1) : '-'}
                </td>
                <td className="py-3 px-4 text-right space-x-2">
                  <button
                    onClick={() => handleEdit(player)}
                    className="text-[var(--color-primary)] hover:underline text-sm"
                  >
                    {PL.common.edit}
                  </button>
                  <button
                    onClick={() => handleDelete(player.id)}
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
