'use client'

import { useState, useEffect, useCallback } from 'react'
import { PL } from '@/constants/pl'
import Link from 'next/link'

interface Season {
  id: number
  name: string
  year: number
  status: string
  rounds: { id: number; name: string; status: string }[]
}

export default function AdminSeasonPage() {
  const [seasons, setSeasons] = useState<Season[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', year: String(new Date().getFullYear()) })

  const loadSeasons = useCallback(async () => {
    const res = await fetch('/api/seasons')
    if (res.ok) setSeasons(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => {
    loadSeasons()
  }, [loadSeasons])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    await fetch('/api/seasons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setShowForm(false)
    setForm({ name: '', year: String(new Date().getFullYear()) })
    loadSeasons()
  }

  if (loading) return <div className="animate-pulse text-[var(--color-text-body)]/50 py-10">{PL.common.loading}</div>

  return (
    <div>
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-3xl font-bold text-[var(--color-primary)]" style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif' }}>
            Sezony
          </h1>
          <div className="flex items-center gap-3 mt-2">
            <span className="inline-block w-10 h-0.5 bg-[var(--color-accent)]"></span>
          </div>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary text-sm">
          + Nowy sezon
        </button>
      </div>

      {showForm && (
        <div className="card p-6 mb-8">
          <h3 className="font-bold text-[var(--color-text-dark)] mb-4">Nowy sezon</h3>
          <form onSubmit={handleCreate} className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-body)]/60 mb-2">
                Nazwa
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Don Papa Match Play 2026"
                className="w-full px-4 py-2.5 border border-[var(--color-border)] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-body)]/60 mb-2">
                Rok
              </label>
              <input
                type="number"
                value={form.year}
                onChange={(e) => setForm({ ...form, year: e.target.value })}
                required
                className="w-32 px-4 py-2.5 border border-[var(--color-border)] rounded-lg"
              />
            </div>
            <button type="submit" className="btn-secondary text-sm">Utwórz</button>
            <button type="button" onClick={() => setShowForm(false)} className="text-sm text-[var(--color-text-body)]">
              Anuluj
            </button>
          </form>
        </div>
      )}

      {seasons.length === 0 ? (
        <p className="text-[var(--color-text-body)]/50">Brak sezonów. Utwórz pierwszy sezon.</p>
      ) : (
        <div className="space-y-4">
          {seasons.map((season) => (
            <Link
              key={season.id}
              href={`/admin/sezon/${season.id}`}
              className="card card-clickable p-6 flex justify-between items-center block"
            >
              <div>
                <h3 className="font-bold text-[var(--color-text-dark)] text-lg">{season.name}</h3>
                <div className="flex items-center gap-3 mt-1">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                    season.status === 'ACTIVE' ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]' :
                    season.status === 'COMPLETED' ? 'bg-[var(--color-text-body)]/10 text-[var(--color-text-body)]' :
                    'bg-[var(--color-accent)]/20 text-[var(--color-accent-hover)]'
                  }`}>
                    {season.status === 'ACTIVE' ? 'Aktywny' : season.status === 'COMPLETED' ? 'Zakończony' : 'Szkic'}
                  </span>
                  <span className="text-sm text-[var(--color-text-body)]/50">
                    {season.rounds.length} rund
                  </span>
                </div>
              </div>
              <span className="text-[var(--color-accent)] font-semibold text-sm">
                Zarządzaj &rarr;
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
