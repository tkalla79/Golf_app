'use client'

import { useState, useEffect, useCallback } from 'react'
import { PL } from '@/constants/pl'
import Link from 'next/link'

interface Season {
  id: number
  name: string
  year: number
  status: string
  rounds: Round[]
}

interface Round {
  id: number
  name: string
  roundNumber: number
  status: string
  groups: Group[]
}

interface Group {
  id: number
  name: string
  _count: { players: number; matches: number }
}

export default function AdminSeasonPage() {
  const [season, setSeason] = useState<Season | null>(null)
  const [loading, setLoading] = useState(true)

  const loadSeason = useCallback(async () => {
    const res = await fetch('/api/seasons/current')
    if (res.ok) {
      setSeason(await res.json())
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadSeason()
  }, [loadSeason])

  if (loading) return <p>{PL.common.loading}</p>

  if (!season) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-800 mb-4">{PL.nav.manageSeason}</h1>
        <p className="text-gray-500">Brak aktywnego sezonu</p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-1">{season.name}</h1>
      <p className="text-gray-600 mb-6">Status: {season.status}</p>

      <div className="space-y-6">
        {season.rounds.map((round) => (
          <div key={round.id} className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-lg font-bold">{round.name}</h2>
                <span
                  className={`text-xs px-2 py-0.5 rounded ${
                    round.status === 'ACTIVE'
                      ? 'bg-green-100 text-green-700'
                      : round.status === 'COMPLETED'
                      ? 'bg-gray-100 text-gray-600'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}
                >
                  {round.status}
                </span>
              </div>
            </div>

            {round.groups.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {round.groups.map((group) => (
                  <Link
                    key={group.id}
                    href={`/admin/grupa/${group.id}`}
                    className="border rounded p-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="font-medium text-[var(--color-primary)]">
                      {group.name}
                    </div>
                    <div className="text-sm text-gray-500">
                      {group._count.players} zawodników &middot;{' '}
                      {group._count.matches} meczów
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">Brak grup</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
