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
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', hcp: '' })

  const loadPlayers = useCallback(async () => {
    const res = await fetch('/api/players')
    setPlayers(await res.json())
  }, [])

  useEffect(() => { loadPlayers() }, [loadPlayers])

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
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-3xl font-bold text-[var(--color-primary)]" style={{ fontFamily: 'Raleway, sans-serif' }}>
            {PL.nav.managePlayers}
          </h1>
          <div className="flex items-center gap-3 mt-2">
            <span className="inline-block w-10 h-0.5 bg-[var(--color-accent)]"></span>
            <span className="text-[var(--color-text-body)]/60 text-sm">{players.length} zawodników</span>
          </div>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary text-sm">
          + {PL.player.addPlayer}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="card p-6 mb-8">
          <h3 className="font-bold text-[var(--color-text-dark)] mb-4">
            {editingPlayer ? PL.player.editPlayer : PL.player.addPlayer}
          </h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-body)]/60 mb-2">
                {PL.player.firstName} *
              </label>
              <input type="text" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                required className="w-full px-4 py-2.5 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-body)]/60 mb-2">
                {PL.player.lastName} *
              </label>
              <input type="text" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                required className="w-full px-4 py-2.5 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-body)]/60 mb-2">
                {PL.player.email}
              </label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-4 py-2.5 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-body)]/60 mb-2">
                {PL.player.phone}
              </label>
              <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-4 py-2.5 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-body)]/60 mb-2">
                {PL.player.hcp}
              </label>
              <input type="number" step="0.1" value={form.hcp} onChange={(e) => setForm({ ...form, hcp: e.target.value })}
                className="w-full px-4 py-2.5 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]" />
            </div>
            <div className="flex items-end gap-3">
              <button type="submit" className="btn-secondary text-sm">{PL.common.save}</button>
              <button type="button" onClick={resetForm} className="text-sm text-[var(--color-text-body)] hover:text-[var(--color-text-dark)]">
                {PL.common.cancel}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <table className="standings-table w-full text-sm">
          <thead>
            <tr>
              <th className="text-left">{PL.standings.player}</th>
              <th className="text-center hidden md:table-cell">{PL.player.email}</th>
              <th className="text-center hidden md:table-cell">{PL.player.phone}</th>
              <th className="text-center">{PL.player.hcp}</th>
              <th className="text-right">Akcje</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <tr key={player.id}>
                <td className="font-semibold text-[var(--color-text-dark)]">
                  {player.firstName} {player.lastName}
                </td>
                <td className="text-center text-[var(--color-text-body)]/50 text-xs hidden md:table-cell">
                  {player.email || '–'}
                </td>
                <td className="text-center text-[var(--color-text-body)]/50 text-xs hidden md:table-cell">
                  {player.phone || '–'}
                </td>
                <td className="text-center text-[var(--color-text-body)]/70">
                  {player.hcp !== null ? Number(player.hcp).toFixed(1) : '–'}
                </td>
                <td className="text-right">
                  <button onClick={() => handleEdit(player)} className="text-[var(--color-primary)] hover:text-[var(--color-accent)] text-xs font-semibold mr-3 transition-colors">
                    {PL.common.edit}
                  </button>
                  <button onClick={() => handleDelete(player.id)} className="text-[var(--color-danger)] hover:text-[var(--color-danger)]/70 text-xs font-semibold transition-colors">
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
