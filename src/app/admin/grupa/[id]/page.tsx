'use client'

import { useState, useEffect, useCallback } from 'react'
import { PL } from '@/constants/pl'
import { RESULT_CODES, RESULT_CODES_18 } from '@/lib/scoring'
import { use } from 'react'

interface Player {
  id: number
  firstName: string
  lastName: string
  slug: string
}

interface Match {
  id: number
  player1Id: number
  player2Id: number
  player1: Player
  player2: Player
  winner: Player | null
  winnerId: number | null
  resultCode: string | null
  player1BigPoints: number
  player2BigPoints: number
  player1SmallPoints: number
  player2SmallPoints: number
  player1Birdies: number
  player2Birdies: number
  played: boolean
  isWalkover: boolean
}

interface Standing {
  playerId: number
  firstName: string
  lastName: string
  played: number
  won: number
  drawn: number
  lost: number
  bigPoints: number
  smallPoints: number
  position: number
}

interface GroupData {
  id: number
  name: string
  round: { name: string; type: string; holes: number; season: { name: string }; config?: Record<string, unknown> }
}

export default function AdminGroupPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [group, setGroup] = useState<GroupData | null>(null)
  const [matches, setMatches] = useState<Match[]>([])
  const [standings, setStandings] = useState<Standing[]>([])
  const [editingMatch, setEditingMatch] = useState<Match | null>(null)
  const [resultForm, setResultForm] = useState({
    winnerId: '',
    resultCode: '1Up',
    isWalkover: false,
    player1Birdies: '0',
    player2Birdies: '0',
  })

  const loadData = useCallback(async () => {
    const [groupRes, matchesRes, standingsRes] = await Promise.all([
      fetch(`/api/groups/${id}`),
      fetch(`/api/groups/${id}/matches`),
      fetch(`/api/groups/${id}/standings`),
    ])
    setGroup(await groupRes.json())
    setMatches(await matchesRes.json())
    setStandings(await standingsRes.json())
  }, [id])

  useEffect(() => {
    loadData()
  }, [loadData])

  const openResultForm = (match: Match) => {
    setEditingMatch(match)
    if (match.played) {
      setResultForm({
        winnerId: match.winnerId ? String(match.winnerId) : '',
        resultCode: match.resultCode || '1Up',
        isWalkover: match.isWalkover,
        player1Birdies: String(match.player1Birdies ?? 0),
        player2Birdies: String(match.player2Birdies ?? 0),
      })
    } else {
      setResultForm({ winnerId: '', resultCode: '1Up', isWalkover: false, player1Birdies: '0', player2Birdies: '0' })
    }
  }

  const handleSubmitResult = async () => {
    if (!editingMatch) return
    await fetch(`/api/matches/${editingMatch.id}/result`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(resultForm),
    })
    setEditingMatch(null)
    loadData()
  }

  const handleClearResult = async (matchId: number) => {
    if (!confirm('Wyczyścić wynik meczu?')) return
    await fetch(`/api/matches/${matchId}/result`, { method: 'DELETE' })
    loadData()
  }

  if (!group) {
    return <div className="text-[var(--color-text-body)]/50 animate-pulse py-10">{PL.common.loading}</div>
  }

  const unplayedMatches = matches.filter((m) => !m.played)
  const playedMatches = matches.filter((m) => m.played)

  return (
    <div>
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-[var(--color-primary)]" style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif' }}>
          {group.name}
        </h1>
        <div className="flex items-center gap-3 mt-2">
          <span className="inline-block w-10 h-0.5 bg-[var(--color-accent)]"></span>
          <p className="text-[var(--color-text-body)]">
            {group.round.name} &middot; {group.round.season.name}
          </p>
        </div>
      </div>

      {/* Standings */}
      <div className="card p-0 mb-10 overflow-hidden">
        <div className="bg-[var(--color-primary)] px-6 py-4">
          <h2 className="text-white font-bold tracking-wide" style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif' }}>
            {PL.group.standings}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="standings-table w-full text-sm">
            <thead>
              <tr>
                <th className="text-left !rounded-none">#</th>
                <th className="text-left !rounded-none">{PL.standings.player}</th>
                <th className="text-center !rounded-none">{PL.standings.played}</th>
                <th className="text-center !rounded-none">{PL.standings.won}</th>
                <th className="text-center !rounded-none">{PL.standings.drawn}</th>
                <th className="text-center !rounded-none">{PL.standings.lost}</th>
                <th className="text-center !rounded-none">{PL.standings.bigPoints}</th>
                <th className="text-center !rounded-none">{PL.standings.smallPoints}</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((s, i) => (
                <tr key={s.playerId}>
                  <td className={`font-bold text-[var(--color-primary)] ${i === 0 ? 'bg-[var(--color-accent)]/10' : ''}`}>
                    {s.position}
                  </td>
                  <td className={`font-semibold text-[var(--color-text-dark)] ${i === 0 ? 'bg-[var(--color-accent)]/10' : ''}`}>
                    {s.firstName} {s.lastName}
                  </td>
                  <td className={`text-center ${i === 0 ? 'bg-[var(--color-accent)]/10' : ''}`}>{s.played}</td>
                  <td className={`text-center text-[var(--color-success)] font-semibold ${i === 0 ? 'bg-[var(--color-accent)]/10' : ''}`}>{s.won}</td>
                  <td className={`text-center text-[var(--color-warning)] font-semibold ${i === 0 ? 'bg-[var(--color-accent)]/10' : ''}`}>{s.drawn}</td>
                  <td className={`text-center text-[var(--color-danger)] font-semibold ${i === 0 ? 'bg-[var(--color-accent)]/10' : ''}`}>{s.lost}</td>
                  <td className={`text-center font-bold text-lg text-[var(--color-primary)] ${i === 0 ? 'bg-[var(--color-accent)]/10' : ''}`}>{s.bigPoints}</td>
                  <td className={`text-center text-[var(--color-text-body)]/60 ${i === 0 ? 'bg-[var(--color-accent)]/10' : ''}`}>
                    {s.smallPoints > 0 ? `+${s.smallPoints}` : s.smallPoints}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Unplayed matches */}
      {unplayedMatches.length > 0 && (
        <div className="mb-10">
          <h2 className="text-xl font-bold text-[var(--color-text-dark)] mb-4" style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif' }}>
            Do rozegrania
            <span className="ml-2 bg-[var(--color-accent)] text-[var(--color-primary-dark)] text-xs font-bold px-2 py-0.5 rounded-full">
              {unplayedMatches.length}
            </span>
          </h2>
          <div className="space-y-3">
            {unplayedMatches.map((match) => (
              <div key={match.id} className="match-row border-[var(--color-accent)]/30 bg-[var(--color-accent)]/[0.04]">
                <span className="font-semibold text-[var(--color-text-dark)] flex-1">
                  {match.player1.firstName} {match.player1.lastName}
                </span>
                <span className="badge-unplayed mx-3">vs</span>
                <span className="font-semibold text-[var(--color-text-dark)] flex-1 text-right">
                  {match.player2.firstName} {match.player2.lastName}
                </span>
                <button
                  onClick={() => openResultForm(match)}
                  className="ml-4 btn-primary text-xs uppercase tracking-wider"
                  style={{ padding: '6px 16px' }}
                >
                  Wynik
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Played matches */}
      {playedMatches.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-[var(--color-text-dark)] mb-4" style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif' }}>
            Rozegrane ({playedMatches.length})
          </h2>
          <div className="space-y-3">
            {playedMatches.map((match) => {
              const p1Won = match.winnerId === match.player1Id
              const p2Won = match.winnerId === match.player2Id

              return (
                <div key={match.id} className="match-row">
                  <span className={`font-semibold flex-1 ${p1Won ? 'text-[var(--color-success)]' : 'text-[var(--color-text-dark)]'}`}>
                    {match.player1.firstName} {match.player1.lastName}
                    {p1Won && <span className="ml-1 text-xs">&#10003;</span>}
                  </span>
                  <span className={`mx-3 ${
                    !match.winnerId ? 'badge-draw' : match.isWalkover ? 'badge-walkover' : 'badge-win'
                  }`}>
                    {match.isWalkover ? 'W/O' : match.resultCode}
                  </span>
                  <span className={`font-semibold flex-1 text-right ${p2Won ? 'text-[var(--color-success)]' : 'text-[var(--color-text-dark)]'}`}>
                    {p2Won && <span className="mr-1 text-xs">&#10003;</span>}
                    {match.player2.firstName} {match.player2.lastName}
                  </span>
                  <div className="ml-4 flex gap-2">
                    <button
                      onClick={() => openResultForm(match)}
                      className="text-[var(--color-primary)] hover:text-[var(--color-accent)] text-xs font-semibold transition-colors"
                    >
                      Edytuj
                    </button>
                    <button
                      onClick={() => handleClearResult(match.id)}
                      className="text-[var(--color-danger)] hover:text-[var(--color-danger)]/70 text-xs font-semibold transition-colors"
                    >
                      Wyczyść
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Result entry modal */}
      {editingMatch && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="card p-8 w-full max-w-md">
            <h3 className="text-xl font-bold text-[var(--color-primary)] mb-1" style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif' }}>
              Wprowadź wynik
            </h3>
            <div className="flex items-center gap-3 mb-6">
              <span className="inline-block w-8 h-0.5 bg-[var(--color-accent)]"></span>
            </div>

            <div className="bg-[var(--color-bg-section)] rounded-lg p-4 mb-6 text-center">
              <span className="font-bold text-[var(--color-text-dark)]">
                {editingMatch.player1.firstName} {editingMatch.player1.lastName}
              </span>
              <span className="mx-3 text-[var(--color-text-body)]/40 text-sm">vs</span>
              <span className="font-bold text-[var(--color-text-dark)]">
                {editingMatch.player2.firstName} {editingMatch.player2.lastName}
              </span>
            </div>

            <div className="space-y-5">
              {/* Walkover */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={resultForm.isWalkover}
                  onChange={(e) =>
                    setResultForm({ ...resultForm, isWalkover: e.target.checked })
                  }
                  className="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                />
                <span className="font-medium text-[var(--color-text-dark)]">Walkower</span>
              </label>

              {/* Winner */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-body)]/60 mb-3">
                  Zwycięzca
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 rounded-lg border border-[var(--color-border)] cursor-pointer hover:border-[var(--color-primary)] transition-colors">
                    <input
                      type="radio"
                      name="winner"
                      value={editingMatch.player1Id}
                      checked={resultForm.winnerId === String(editingMatch.player1Id)}
                      onChange={(e) => setResultForm({ ...resultForm, winnerId: e.target.value })}
                      className="text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                    />
                    <span className="font-medium">{editingMatch.player1.firstName} {editingMatch.player1.lastName}</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 rounded-lg border border-[var(--color-border)] cursor-pointer hover:border-[var(--color-primary)] transition-colors">
                    <input
                      type="radio"
                      name="winner"
                      value={editingMatch.player2Id}
                      checked={resultForm.winnerId === String(editingMatch.player2Id)}
                      onChange={(e) => setResultForm({ ...resultForm, winnerId: e.target.value })}
                      className="text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                    />
                    <span className="font-medium">{editingMatch.player2.firstName} {editingMatch.player2.lastName}</span>
                  </label>
                  {!resultForm.isWalkover && group?.round.type !== 'PLAYOFF' && (
                    <label className="flex items-center gap-3 p-3 rounded-lg border border-[var(--color-border)] cursor-pointer hover:border-[var(--color-primary)] transition-colors">
                      <input
                        type="radio"
                        name="winner"
                        value=""
                        checked={resultForm.winnerId === ''}
                        onChange={() => setResultForm({ ...resultForm, winnerId: '', resultCode: 'Tied' })}
                        className="text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                      />
                      <span className="font-medium">Remis</span>
                    </label>
                  )}
                  {group?.round.type === 'PLAYOFF' && (
                    <p className="text-xs text-[var(--color-text-body)]/50 italic mt-1">
                      Remisy w play-off rozstrzygane nagłą śmiercią — zawsze wybierz zwycięzcę.
                    </p>
                  )}
                </div>
              </div>

              {/* Result code */}
              {resultForm.winnerId && !resultForm.isWalkover && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-body)]/60 mb-3">
                    Wynik
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(group?.round.type === 'PLAYOFF' && group?.round.holes === 18
                      ? RESULT_CODES_18
                      : RESULT_CODES
                    ).filter((c) => c !== 'Tied').map((code) => (
                      <button
                        key={code}
                        onClick={() => setResultForm({ ...resultForm, resultCode: code })}
                        className={`py-2 px-3 rounded-lg border font-bold text-sm transition-colors ${
                          resultForm.resultCode === code
                            ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                            : 'border-[var(--color-border)] text-[var(--color-text-dark)] hover:border-[var(--color-primary)]'
                        }`}
                      >
                        {code}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Birdie count */}
              <div className="mt-4">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-body)]/60 mb-3">
                  🐦 Birdie
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-[var(--color-text-body)]/50 mb-1 block">
                      {editingMatch.player1.firstName} {editingMatch.player1.lastName}
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="18"
                      value={resultForm.player1Birdies}
                      onChange={(e) => setResultForm({ ...resultForm, player1Birdies: e.target.value })}
                      className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-center font-bold text-lg focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--color-text-body)]/50 mb-1 block">
                      {editingMatch.player2.firstName} {editingMatch.player2.lastName}
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="18"
                      value={resultForm.player2Birdies}
                      onChange={(e) => setResultForm({ ...resultForm, player2Birdies: e.target.value })}
                      className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-center font-bold text-lg focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={handleSubmitResult}
                disabled={!resultForm.winnerId && resultForm.resultCode !== 'Tied'}
                className="flex-1 btn-primary py-3 text-center text-sm uppercase tracking-wider disabled:opacity-40"
              >
                Zapisz wynik
              </button>
              <button
                onClick={() => setEditingMatch(null)}
                className="flex-1 border border-[var(--color-border)] text-[var(--color-text-body)] py-3 rounded-md hover:bg-[var(--color-bg-section)] transition-colors text-sm font-semibold"
              >
                Anuluj
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
