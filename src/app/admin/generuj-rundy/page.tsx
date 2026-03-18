'use client'

import { useState, useEffect, useCallback } from 'react'
import { PL } from '@/constants/pl'

interface Season {
  id: number
  name: string
  rounds: Round[]
}

interface Round {
  id: number
  name: string
  roundNumber: number
  status: string
}

interface GeneratedGroup {
  name: string
  players: { playerId: number; firstName: string; lastName: string; hcp: number | null }[]
}

export default function GenerateRoundsPage() {
  const [season, setSeason] = useState<Season | null>(null)
  const [selectedRound, setSelectedRound] = useState<Round | null>(null)
  const [preview, setPreview] = useState<GeneratedGroup[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const loadSeason = useCallback(async () => {
    const res = await fetch('/api/seasons/current')
    if (res.ok) setSeason(await res.json())
  }, [])

  useEffect(() => { loadSeason() }, [loadSeason])

  const completedRounds = season?.rounds.filter((r) => r.status === 'COMPLETED') || []

  const handleGenerate = async (roundId: number) => {
    setLoading(true)
    setError('')
    setPreview(null)
    const res = await fetch(`/api/rounds/${roundId}/generate-groups`, { method: 'POST' })
    setLoading(false)
    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'Błąd generowania')
      return
    }
    setPreview(await res.json())
    setSelectedRound(completedRounds.find((r) => r.id === roundId) || null)
  }

  const handleApprove = async () => {
    if (!selectedRound) return
    setLoading(true)
    const res = await fetch(`/api/rounds/${selectedRound.id}/approve-groups`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groups: preview }),
    })
    setLoading(false)
    if (res.ok) {
      setPreview(null)
      setSelectedRound(null)
      loadSeason()
    } else {
      const data = await res.json()
      setError(data.error || 'Błąd zatwierdzania')
    }
  }

  return (
    <div>
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-[var(--color-primary)]" style={{ fontFamily: 'Raleway, sans-serif' }}>
          {PL.nav.generateRounds}
        </h1>
        <div className="flex items-center gap-3 mt-2">
          <span className="inline-block w-10 h-0.5 bg-[var(--color-accent)]"></span>
          <span className="text-[var(--color-text-body)]/60 text-sm">
            Automatyczne tworzenie grup na podstawie wyników
          </span>
        </div>
      </div>

      {completedRounds.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-[var(--color-text-body)]/50">
            Brak zakończonych rund. Zakończ bieżącą rundę w sekcji Sezon, aby wygenerować grupy dla kolejnej.
          </p>
        </div>
      ) : (
        <div className="space-y-4 mb-10">
          <h2 className="text-lg font-bold text-[var(--color-text-dark)]" style={{ fontFamily: 'Raleway, sans-serif' }}>
            Zakończone rundy
          </h2>
          {completedRounds.map((round) => (
            <div key={round.id} className="card p-5 flex items-center justify-between">
              <span className="font-semibold text-[var(--color-text-dark)]">{round.name}</span>
              <button
                onClick={() => handleGenerate(round.id)}
                disabled={loading}
                className="btn-primary text-sm disabled:opacity-50"
              >
                Generuj grupy
              </button>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="bg-[var(--color-danger)]/10 text-[var(--color-danger)] px-4 py-3 rounded-lg mb-6 font-medium text-sm">
          {error}
        </div>
      )}

      {preview && (
        <div>
          <h2 className="text-xl font-bold text-[var(--color-text-dark)] mb-6" style={{ fontFamily: 'Raleway, sans-serif' }}>
            Podgląd nowych grup
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {preview.map((group, i) => (
              <div key={i} className="card p-5">
                <h3 className="font-bold text-[var(--color-primary)] mb-3" style={{ fontFamily: 'Raleway, sans-serif' }}>
                  {group.name}
                </h3>
                <div className="space-y-2">
                  {group.players.map((p) => (
                    <div key={p.playerId} className="flex justify-between text-sm">
                      <span className="font-medium text-[var(--color-text-dark)]">
                        {p.firstName} {p.lastName}
                      </span>
                      {p.hcp !== null && (
                        <span className="text-[var(--color-text-body)]/40 text-xs">
                          HCP {p.hcp}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={handleApprove}
            disabled={loading}
            className="btn-primary text-lg px-10 py-3 disabled:opacity-50"
          >
            Zatwierdź i utwórz rundę
          </button>
        </div>
      )}
    </div>
  )
}
