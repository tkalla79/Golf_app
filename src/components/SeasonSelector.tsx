'use client'

import { useRouter, useSearchParams } from 'next/navigation'

interface Season {
  id: number
  name: string
  year: number
  status: string
}

export default function SeasonSelector({ seasons, currentSeasonId }: { seasons: Season[], currentSeasonId: number }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  if (seasons.length <= 1) return null

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const seasonId = e.target.value
    const params = new URLSearchParams(searchParams.toString())
    // If selecting the active season, remove the param
    const activeSeason = seasons.find(s => s.status === 'ACTIVE')
    if (activeSeason && seasonId === String(activeSeason.id)) {
      params.delete('sezon')
    } else {
      params.set('sezon', seasonId)
    }
    // Remove round param when switching seasons
    params.delete('runda')
    const query = params.toString()
    router.push(query ? `?${query}` : window.location.pathname)
  }

  return (
    <select
      value={currentSeasonId}
      onChange={handleChange}
      className="bg-transparent border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm font-semibold text-[var(--color-primary)] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/50"
      style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif' }}
    >
      {seasons.map(s => (
        <option key={s.id} value={s.id}>
          {s.name} {s.status === 'ACTIVE' ? '\u25CF' : ''}
        </option>
      ))}
    </select>
  )
}
