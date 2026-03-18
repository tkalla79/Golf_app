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

  useEffect(() => {
    loadSeason()
  }, [loadSeason])

  const completedRounds = season?.rounds.filter((r) => r.status === 'COMPLETED') || []

  const handleGenerate = async (roundId: number) => {
    setLoading(true)
    setError('')
    setPreview(null)

    const res = await fetch(`/api/rounds/${roundId}/generate-groups`, {
      method: 'POST',
    })

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
      alert('Grupy zatwierdzone!')
    } else {
      const data = await res.json()
      setError(data.error || 'Błąd zatwierdzania')
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">{PL.nav.generateRounds}</h1>

      {completedRounds.length === 0 ? (
        <p className="text-gray-500">
          Brak zakończonych rund. Zakończ bieżącą rundę aby wygenerować grupy dla kolejnej.
        </p>
      ) : (
        <div className="space-y-4 mb-8">
          <h2 className="text-lg font-bold">Zakończone rundy:</h2>
          {completedRounds.map((round) => (
            <div key={round.id} className="flex items-center justify-between bg-white rounded-lg shadow p-4">
              <span className="font-medium">{round.name}</span>
              <button
                onClick={() => handleGenerate(round.id)}
                disabled={loading}
                className="bg-[var(--color-primary)] text-white px-4 py-2 rounded hover:bg-[var(--color-primary-light)] disabled:opacity-50"
              >
                {PL.round.generate}
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-red-600 mb-4">{error}</p>}

      {preview && (
        <div>
          <h2 className="text-lg font-bold mb-4">{PL.round.preview}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {preview.map((group, i) => (
              <div key={i} className="bg-white rounded-lg shadow p-4">
                <h3 className="font-bold text-[var(--color-primary)] mb-2">{group.name}</h3>
                <ul className="space-y-1">
                  {group.players.map((p) => (
                    <li key={p.playerId} className="text-sm">
                      {p.firstName} {p.lastName}
                      {p.hcp !== null && (
                        <span className="text-gray-400 ml-2">(HCP: {p.hcp})</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <button
            onClick={handleApprove}
            disabled={loading}
            className="bg-[var(--color-accent)] text-white px-8 py-3 rounded-lg text-lg font-bold hover:bg-[var(--color-accent-light)] disabled:opacity-50"
          >
            {PL.round.approve}
          </button>
        </div>
      )}
    </div>
  )
}
