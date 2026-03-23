// src/app/admin/playoff/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { PL } from '@/constants/pl'
import { BRACKET_SEEDS, BRACKET_NAMES } from '@/lib/playoff'
import type { RankedPlayer } from '@/lib/playoff'
import Link from 'next/link'

interface PlayoffGroup {
  id: number
  name: string
}

export default function AdminPlayoffPage() {
  const [ranking, setRanking] = useState<RankedPlayer[] | null>(null)
  const [brackets, setBrackets] = useState<Record<string, RankedPlayer[]> | null>(null)
  const [seasonId, setSeasonId] = useState<number | null>(null)
  const [existingGroups, setExistingGroups] = useState<PlayoffGroup[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    checkPlayoffStatus()
  }, [])

  async function checkPlayoffStatus() {
    // Check if playoff already exists
    const res = await fetch('/api/admin/playoff/ranking')
    if (res.status === 409) {
      // Playoff exists — fetch the groups
      const seasonRes = await fetch('/api/seasons/current')
      if (seasonRes.ok) {
        const season = await seasonRes.json()
        const roundRes = await fetch(`/api/seasons/${season.id}`)
        if (roundRes.ok) {
          const data = await roundRes.json()
          const playoffRound = data.rounds?.find((r: { type: string }) => r.type === 'PLAYOFF')
          if (playoffRound) {
            setExistingGroups(playoffRound.groups)
          }
        }
      }
      setLoading(false)
      return
    }

    if (res.ok) {
      const data = await res.json()
      setRanking(data.ranking)
      setBrackets(data.brackets)
      setSeasonId(data.seasonId)
    } else {
      const data = await res.json()
      setError(data.error)
    }
    setLoading(false)
  }

  async function handleCreate() {
    if (!seasonId) return
    setCreating(true)
    setError(null)

    const res = await fetch('/api/admin/playoff/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seasonId }),
    })

    if (res.ok) {
      const data = await res.json()
      setExistingGroups(data.groups)
      setRanking(null)
      setBrackets(null)
    } else {
      const data = await res.json()
      setError(data.error)
    }
    setCreating(false)
  }

  if (loading) return <div className="p-8">{PL.common.loading}</div>

  // State 3: Playoff exists — show links to bracket groups
  if (existingGroups) {
    return (
      <div>
        <h1 className="text-3xl font-bold text-[var(--color-primary)] mb-6"
            style={{ fontFamily: 'Raleway, sans-serif' }}>
          {PL.playoff.title}
        </h1>
        <p className="text-[var(--color-text-body)] mb-8">{PL.playoff.playoffExists}</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {existingGroups.map((group) => (
            <Link
              key={group.id}
              href={`/admin/grupa/${group.id}`}
              className="card card-clickable p-6 text-center"
            >
              <h2 className="text-lg font-bold text-[var(--color-primary)]">{group.name}</h2>
              <p className="text-sm text-[var(--color-text-body)]/60 mt-2">Wprowadź wyniki</p>
            </Link>
          ))}
        </div>

        <div className="mt-8">
          <Link href="/playoff" className="btn-secondary text-sm">
            Zobacz drabinki publiczne &rarr;
          </Link>
        </div>
      </div>
    )
  }

  // State 2: Show seeding preview
  if (ranking && brackets) {
    return (
      <div>
        <h1 className="text-3xl font-bold text-[var(--color-primary)] mb-6"
            style={{ fontFamily: 'Raleway, sans-serif' }}>
          {PL.playoff.seedingPreview}
        </h1>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">{error}</div>
        )}

        {BRACKET_NAMES.map((bracketName) => {
          const seeds = BRACKET_SEEDS[bracketName]
          const players = brackets[bracketName]
          if (!players) return null

          return (
            <div key={bracketName} className="card p-6 mb-6">
              <h2 className="text-xl font-bold text-[var(--color-primary)] mb-4">
                Drabinka {bracketName}
              </h2>
              <div className="space-y-2">
                {seeds.map(([s1, s2], idx) => {
                  const p1 = ranking.find(p => p.rank === s1)
                  const p2 = ranking.find(p => p.rank === s2)
                  return (
                    <div key={idx} className="flex items-center gap-4 text-sm py-2 border-b border-[var(--color-border)]">
                      <span className="w-8 text-right font-bold text-[var(--color-primary)]/40">M{idx + 1}</span>
                      <span className="flex-1">
                        <span className="font-bold">{s1}.</span> {p1?.firstName} {p1?.lastName}
                        <span className="text-[var(--color-text-body)]/40 mx-2">vs</span>
                        <span className="font-bold">{s2}.</span> {p2?.firstName} {p2?.lastName}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        <button
          onClick={handleCreate}
          disabled={creating}
          className="btn-primary text-lg px-8 py-3"
        >
          {creating ? PL.common.loading : PL.playoff.confirmCreate}
        </button>
      </div>
    )
  }

  // State 1: Error or not ready
  return (
    <div>
      <h1 className="text-3xl font-bold text-[var(--color-primary)] mb-6"
          style={{ fontFamily: 'Raleway, sans-serif' }}>
        {PL.playoff.title}
      </h1>
      {error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</div>
      ) : (
        <p className="text-[var(--color-text-body)]">{PL.playoff.noPlayoff}</p>
      )}
    </div>
  )
}
