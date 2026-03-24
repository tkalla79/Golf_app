'use client'

import { useState, useEffect, use } from 'react'
import { PL } from '@/constants/pl'
import Link from 'next/link'
import { DEFAULT_SEASON_CONFIG, SeasonConfig } from '@/lib/scoring'

export default function AdminScoringConfigPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [config, setConfig] = useState<SeasonConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch(`/api/seasons/${id}/config`)
      .then((res) => res.json())
      .then((data) => {
        setConfig(data)
        setLoading(false)
      })
  }, [id])

  const handleSave = async () => {
    if (!config) return
    setSaving(true)
    setSaved(false)
    await fetch(`/api/seasons/${id}/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const handleReset = () => {
    setConfig(structuredClone(DEFAULT_SEASON_CONFIG))
  }

  const updateScoring = (key: keyof SeasonConfig['scoring'], value: number) => {
    if (!config) return
    setConfig({
      ...config,
      scoring: { ...config.scoring, [key]: value },
    })
  }

  const updateSmallPoints = (
    resultCode: string,
    index: 0 | 1,
    value: number
  ) => {
    if (!config) return
    const newMap = { ...config.small_points_map }
    const pair = [...newMap[resultCode]] as [number, number]
    pair[index] = value
    newMap[resultCode] = pair
    setConfig({ ...config, small_points_map: newMap })
  }

  if (loading)
    return (
      <div className="animate-pulse text-[var(--color-text-body)]/50 py-10">
        {PL.common.loading}
      </div>
    )
  if (!config) return null

  const scoringFields: { key: keyof SeasonConfig['scoring']; label: string }[] = [
    { key: 'win', label: PL.scoring.win },
    { key: 'draw', label: PL.scoring.draw },
    { key: 'loss', label: PL.scoring.loss },
    { key: 'unplayed', label: PL.scoring.unplayed },
    { key: 'walkover_winner', label: PL.scoring.walkoverWinner },
    { key: 'walkover_loser', label: PL.scoring.walkoverLoser },
  ]

  return (
    <div>
      {/* Header */}
      <div className="mb-10">
        <Link
          href={`/admin/sezon/${id}`}
          className="text-sm text-[var(--color-primary)] hover:text-[var(--color-accent)] transition-colors font-medium"
        >
          &larr; {PL.common.back}
        </Link>
        <h1
          className="text-3xl font-bold text-[var(--color-primary)] mt-4"
          style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif' }}
        >
          {PL.scoring.config}
        </h1>
        <div className="flex items-center gap-3 mt-2">
          <span className="inline-block w-10 h-0.5 bg-[var(--color-accent)]"></span>
        </div>
      </div>

      {/* Big points section */}
      <div className="card p-6 mb-6">
        <h2
          className="text-xl font-bold text-[var(--color-text-dark)] mb-6"
          style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif' }}
        >
          {PL.scoring.bigPoints}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {scoringFields.map(({ key, label }) => (
            <div key={key}>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-body)]/60 mb-2">
                {label}
              </label>
              <input
                type="number"
                value={config.scoring[key]}
                onChange={(e) => updateScoring(key, parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-2.5 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Small points section */}
      <div className="card p-6 mb-6">
        <h2
          className="text-xl font-bold text-[var(--color-text-dark)] mb-6"
          style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif' }}
        >
          {PL.scoring.smallPoints}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="text-left py-3 px-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-body)]/60">
                  {PL.scoring.resultCode}
                </th>
                <th className="text-left py-3 px-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-body)]/60">
                  {PL.scoring.winnerPoints}
                </th>
                <th className="text-left py-3 px-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-body)]/60">
                  {PL.scoring.loserPoints}
                </th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(config.small_points_map).map(([code, [winnerPts, loserPts]]) => (
                <tr key={code} className="border-b border-[var(--color-border)]/50">
                  <td className="py-3 px-2 font-medium text-[var(--color-text-dark)]">
                    {code}
                  </td>
                  <td className="py-3 px-2">
                    <input
                      type="number"
                      value={winnerPts}
                      onChange={(e) =>
                        updateSmallPoints(code, 0, parseFloat(e.target.value) || 0)
                      }
                      className="w-24 px-3 py-1.5 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]"
                    />
                  </td>
                  <td className="py-3 px-2">
                    <input
                      type="number"
                      value={loserPts}
                      onChange={(e) =>
                        updateSmallPoints(code, 1, parseFloat(e.target.value) || 0)
                      }
                      className="w-24 px-3 py-1.5 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-4">
        <button onClick={handleSave} disabled={saving} className="btn-primary text-sm">
          {saving ? PL.common.loading : PL.scoring.save}
        </button>
        <button onClick={handleReset} className="btn-secondary text-sm">
          {PL.scoring.resetDefaults}
        </button>
        {saved && (
          <span className="text-sm text-[var(--color-success)] font-medium">
            {PL.scoring.saved}
          </span>
        )}
      </div>
    </div>
  )
}
