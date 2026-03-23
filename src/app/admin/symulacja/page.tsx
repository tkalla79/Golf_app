'use client'

import { useState } from 'react'
import { PL } from '@/constants/pl'

interface SimulationStats {
  matchesSimulated: number
  roundsCreated: number
  playoffCreated: boolean
}

interface SimulationResult {
  success: boolean
  message: string
  stats: SimulationStats
  error?: string
}

type ActionType = 'current-round' | 'to-playoff' | 'full-season' | 'reset-simulation'

export default function SimulationPage() {
  const [loading, setLoading] = useState<ActionType | null>(null)
  const [result, setResult] = useState<SimulationResult | null>(null)
  const [error, setError] = useState('')

  const runAction = async (action: ActionType) => {
    if (action === 'reset-simulation') {
      const confirmed = window.confirm(PL.simulation.confirmReset)
      if (!confirmed) return
    }

    setLoading(action)
    setResult(null)
    setError('')

    try {
      const res = await fetch('/api/admin/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Wystąpił błąd')
      } else {
        setResult(data)
      }
    } catch {
      setError('Błąd połączenia z serwerem')
    } finally {
      setLoading(null)
    }
  }

  const actions: { action: ActionType; label: string; description: string; variant: 'primary' | 'secondary' | 'danger' }[] = [
    {
      action: 'current-round',
      label: PL.simulation.simulateCurrentRound,
      description: 'Wypełnia losowe wyniki dla wszystkich nierozegranych meczów w aktywnej rundzie.',
      variant: 'primary',
    },
    {
      action: 'to-playoff',
      label: PL.simulation.simulateToPlayoff,
      description: 'Symuluje bieżącą rundę, generuje kolejne rundy i tworzy drabinki play-off.',
      variant: 'primary',
    },
    {
      action: 'full-season',
      label: PL.simulation.simulateFullSeason,
      description: 'Symuluje cały sezon włącznie z meczami play-off.',
      variant: 'primary',
    },
    {
      action: 'reset-simulation',
      label: PL.simulation.resetSimulation,
      description: 'Usuwa wszystkie wyniki i rundy 2+. Przywraca rundę 1 do stanu początkowego.',
      variant: 'danger',
    },
  ]

  return (
    <div>
      <h1
        className="text-2xl font-bold text-[var(--color-text-heading)] mb-6"
        style={{ fontFamily: 'Raleway, sans-serif' }}
      >
        {PL.simulation.title}
      </h1>

      {/* Warning banner */}
      <div className="bg-amber-50 border border-amber-300 text-amber-800 rounded-lg px-4 py-3 mb-8 text-sm font-medium">
        {PL.simulation.warning}
      </div>

      {/* Action cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {actions.map(({ action, label, description, variant }) => (
          <div
            key={action}
            className="bg-white rounded-lg shadow-sm border border-[var(--color-border)] p-5 flex flex-col"
          >
            <h3
              className="text-base font-bold text-[var(--color-text-heading)] mb-2"
              style={{ fontFamily: 'Raleway, sans-serif' }}
            >
              {label}
            </h3>
            <p className="text-sm text-[var(--color-text-body)]/70 mb-4 flex-1">
              {description}
            </p>
            <button
              onClick={() => runAction(action)}
              disabled={loading !== null}
              className={`w-full py-2.5 px-4 rounded-lg font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                variant === 'danger'
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white'
              }`}
            >
              {loading === action ? PL.simulation.running : label}
            </button>
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-300 text-red-800 rounded-lg px-4 py-3 mb-4 text-sm">
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="bg-green-50 border border-green-300 text-green-800 rounded-lg px-4 py-4 text-sm">
          <p className="font-bold mb-2">{PL.simulation.completed}</p>
          <p className="mb-2">{result.message}</p>
          {result.stats.matchesSimulated > 0 && (
            <p>{result.stats.matchesSimulated} {PL.simulation.matchesSimulated}</p>
          )}
          {result.stats.roundsCreated > 0 && (
            <p>{result.stats.roundsCreated} {PL.simulation.roundsCreated}</p>
          )}
        </div>
      )}
    </div>
  )
}
