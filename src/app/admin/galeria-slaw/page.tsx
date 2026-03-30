'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import Image from 'next/image'

interface HallOfFameEntry {
  id: number
  playerName: string
  seasonName: string
  year: number
  photoUrl: string | null
  description: string | null
  sortOrder: number
}

const emptyForm = {
  playerName: '',
  seasonName: '',
  year: new Date().getFullYear(),
  description: '',
  sortOrder: 0,
  photoUrl: '',
}

export default function AdminGaleriaSlaw() {
  const [entries, setEntries] = useState<HallOfFameEntry[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editing, setEditing] = useState<HallOfFameEntry | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadEntries = useCallback(async () => {
    const res = await fetch('/api/hall-of-fame')
    if (res.ok) setEntries(await res.json())
  }, [])

  useEffect(() => { loadEntries() }, [loadEntries])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError('')
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/upload/hall-of-fame', { method: 'POST', body: fd })
    const data = await res.json()
    if (res.ok) {
      setForm(f => ({ ...f, photoUrl: data.url }))
    } else {
      setError(data.error || 'Błąd uploadu')
    }
    setUploading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    const body = {
      playerName: form.playerName,
      seasonName: form.seasonName,
      year: Number(form.year),
      photoUrl: form.photoUrl || null,
      description: form.description || null,
      sortOrder: Number(form.sortOrder),
    }
    const res = editing
      ? await fetch(`/api/hall-of-fame/${editing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      : await fetch('/api/hall-of-fame', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
    if (res.ok) {
      resetForm()
      loadEntries()
    } else {
      const data = await res.json()
      setError(data.error || 'Błąd zapisu')
    }
    setSaving(false)
  }

  const handleEdit = (entry: HallOfFameEntry) => {
    setEditing(entry)
    setForm({
      playerName: entry.playerName,
      seasonName: entry.seasonName,
      year: entry.year,
      description: entry.description || '',
      sortOrder: entry.sortOrder,
      photoUrl: entry.photoUrl || '',
    })
    setShowForm(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Usunąć ten wpis?')) return
    await fetch(`/api/hall-of-fame/${id}`, { method: 'DELETE' })
    loadEntries()
  }

  const resetForm = () => {
    setForm(emptyForm)
    setEditing(null)
    setShowForm(false)
    setError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1
            className="text-2xl font-bold text-[var(--color-text-dark)]"
            style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif' }}
          >
            Galeria Sław
          </h1>
          <p className="text-sm text-[var(--color-text-body)]/50 mt-1">
            Zarządzaj wpisami zwycięzców sezonu
          </p>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="btn-secondary text-sm">
            + Dodaj wpis
          </button>
        )}
      </div>

      {showForm && (
        <div className="card p-6 mb-8">
          <h3 className="font-bold text-[var(--color-text-dark)] mb-4">
            {editing ? 'Edytuj wpis' : 'Nowy wpis'}
          </h3>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-body)]/60 mb-2">
                  Imię i nazwisko *
                </label>
                <input
                  type="text"
                  value={form.playerName}
                  onChange={e => setForm(f => ({ ...f, playerName: e.target.value }))}
                  required
                  className="w-full px-4 py-2.5 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:outline-none"
                  placeholder="Jan Kowalski"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-body)]/60 mb-2">
                  Nazwa sezonu *
                </label>
                <input
                  type="text"
                  value={form.seasonName}
                  onChange={e => setForm(f => ({ ...f, seasonName: e.target.value }))}
                  required
                  className="w-full px-4 py-2.5 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:outline-none"
                  placeholder="Sezon Wiosna 2024"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-body)]/60 mb-2">
                  Rok *
                </label>
                <input
                  type="number"
                  value={form.year}
                  onChange={e => setForm(f => ({ ...f, year: Number(e.target.value) }))}
                  required
                  min={2000}
                  max={2099}
                  className="w-full px-4 py-2.5 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-body)]/60 mb-2">
                  Kolejność wyświetlania
                </label>
                <input
                  type="number"
                  value={form.sortOrder}
                  onChange={e => setForm(f => ({ ...f, sortOrder: Number(e.target.value) }))}
                  className="w-full px-4 py-2.5 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-body)]/60 mb-2">
                Opis (opcjonalny)
              </label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={2}
                className="w-full px-4 py-2.5 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:outline-none resize-none"
                placeholder="Krótki opis osiągnięcia..."
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-body)]/60 mb-2">
                Zdjęcie
              </label>
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="block w-full text-sm text-[var(--color-text-body)]/60 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-[var(--color-primary)] file:text-white hover:file:bg-[var(--color-primary)]/90 file:cursor-pointer"
                  />
                  {uploading && (
                    <p className="text-xs text-[var(--color-text-body)]/50 mt-1 animate-pulse">
                      Wgrywanie...
                    </p>
                  )}
                  {form.photoUrl && !uploading && (
                    <p className="text-xs text-green-600 mt-1">✓ Zdjęcie wgrane</p>
                  )}
                </div>
                {form.photoUrl && (
                  <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-[var(--color-border)] flex-shrink-0">
                    <Image src={form.photoUrl} alt="Podgląd" fill className="object-cover" />
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={saving || uploading}
                className="btn-secondary text-sm disabled:opacity-50"
              >
                {saving ? 'Zapisywanie...' : editing ? 'Zapisz zmiany' : 'Dodaj wpis'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="text-sm text-[var(--color-text-body)]/50 hover:text-[var(--color-text-body)] transition-colors"
              >
                Anuluj
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <table className="standings-table w-full text-sm">
          <thead>
            <tr>
              <th className="text-left">Zawodnik</th>
              <th className="text-left hidden md:table-cell">Sezon</th>
              <th className="text-center">Rok</th>
              <th className="text-center hidden md:table-cell">Zdjęcie</th>
              <th className="text-right">Akcje</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center text-[var(--color-text-body)]/40 py-8 italic">
                  Brak wpisów — dodaj pierwszego zwycięzcę
                </td>
              </tr>
            ) : (
              entries.map(entry => (
                <tr key={entry.id}>
                  <td className="font-semibold">{entry.playerName}</td>
                  <td className="hidden md:table-cell text-[var(--color-text-body)]/60">{entry.seasonName}</td>
                  <td className="text-center font-bold text-[var(--color-primary)]">{entry.year}</td>
                  <td className="text-center hidden md:table-cell">
                    {entry.photoUrl ? (
                      <div className="flex justify-center">
                        <div className="relative w-8 h-8 rounded overflow-hidden">
                          <Image src={entry.photoUrl} alt={entry.playerName} fill className="object-cover" />
                        </div>
                      </div>
                    ) : (
                      <span className="text-[var(--color-text-body)]/30 text-xs">brak</span>
                    )}
                  </td>
                  <td className="text-right">
                    <button
                      onClick={() => handleEdit(entry)}
                      className="text-[var(--color-primary)] hover:text-[var(--color-accent)] text-xs font-semibold mr-3 transition-colors"
                    >
                      Edytuj
                    </button>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="text-red-500 hover:text-red-700 text-xs font-semibold transition-colors"
                    >
                      Usuń
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
