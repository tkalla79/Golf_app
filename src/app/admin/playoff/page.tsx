// src/app/admin/playoff/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { PL } from '@/constants/pl'
import { BRACKET_SEEDS, BRACKET_NAMES, BRACKET_DISPLAY_NAMES } from '@/lib/playoff'
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
    let cancelled = false
    void (async () => {
      let res: Response
      try {
        res = await fetch('/api/admin/playoff/ranking')
      } catch {
        // Sieć padła — bez tego strona wisiałaby na „Ładowanie…" bez komunikatu.
        if (!cancelled) { setError('Brak połączenia z serwerem. Odśwież stronę.'); setLoading(false) }
        return
      }
      if (cancelled) return

      if (res.status === 409) {
        try {
          const seasonRes = await fetch('/api/seasons/current')
          if (!cancelled && seasonRes.ok) {
            const season = await seasonRes.json()
            const roundRes = await fetch(`/api/seasons/${season.id}`)
            if (!cancelled && roundRes.ok) {
              const data = await roundRes.json()
              const playoffRound = data.rounds?.find((r: { type: string }) => r.type === 'PLAYOFF')
              if (!cancelled && playoffRound) {
                setExistingGroups(playoffRound.groups)
              }
            }
          }
        } catch {
          if (!cancelled) setError('Nie udało się załadować danych playoff')
        }
        if (!cancelled) setLoading(false)
        return
      }

      // Błąd serwera (500) zwraca stronę HTML, nie JSON — res.json() rzuciłby wtedy
      // wyjątek, setLoading(false) nigdy by się nie wykonał i strona zostałaby
      // na „Ładowanie…" bez żadnej wskazówki, co się stało.
      let data: { ranking?: RankedPlayer[]; brackets?: Record<string, RankedPlayer[]>; seasonId?: number; error?: string } | null = null
      try {
        data = await res.json()
      } catch {
        data = null
      }
      if (cancelled) return

      if (res.ok && data?.ranking && data?.brackets) {
        setRanking(data.ranking)
        setBrackets(data.brackets)
        setSeasonId(data.seasonId ?? null)
      } else {
        setError(data?.error ?? `Serwer zwrócił błąd ${res.status}. Sprawdź logi aplikacji.`)
      }
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

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
            style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif' }}>
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
            style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif' }}>
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
                {BRACKET_DISPLAY_NAMES[bracketName] || bracketName}
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
          style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif' }}>
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
