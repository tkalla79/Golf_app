'use client'

import { useState, useEffect, useCallback } from 'react'
import { PL } from '@/constants/pl'
import { RESULT_CODES } from '@/lib/scoring'
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
  round: { name: string; season: { name: string } }
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
    resultCode: 'Tied',
    isWalkover: false,
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
        resultCode: match.resultCode || 'Tied',
        isWalkover: match.isWalkover,
      })
    } else {
      setResultForm({ winnerId: '', resultCode: 'Tied', isWalkover: false })
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
    return <p className="text-gray-500">{PL.common.loading}</p>
  }

  const unplayedMatches = matches.filter((m) => !m.played)
  const playedMatches = matches.filter((m) => m.played)

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-1">{group.name}</h1>
      <p className="text-gray-600 mb-6">
        {group.round.name} &middot; {group.round.season.name}
      </p>

      {/* Standings */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-8">
        <h2 className="text-lg font-bold mb-3">{PL.group.standings}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-300">
                <th className="text-left py-2 px-1">#</th>
                <th className="text-left py-2 px-1">{PL.standings.player}</th>
                <th className="text-center py-2 px-1">{PL.standings.played}</th>
                <th className="text-center py-2 px-1">{PL.standings.won}</th>
                <th className="text-center py-2 px-1">{PL.standings.drawn}</th>
                <th className="text-center py-2 px-1">{PL.standings.lost}</th>
                <th className="text-center py-2 px-1 font-bold">{PL.standings.bigPoints}</th>
                <th className="text-center py-2 px-1">{PL.standings.smallPoints}</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((s, i) => (
                <tr key={s.playerId} className={`border-b ${i === 0 ? 'bg-green-50' : ''}`}>
                  <td className="py-2 px-1 font-bold text-gray-400">{s.position}</td>
                  <td className="py-2 px-1 font-medium">{s.firstName} {s.lastName}</td>
                  <td className="py-2 px-1 text-center">{s.played}</td>
                  <td className="py-2 px-1 text-center text-green-600">{s.won}</td>
                  <td className="py-2 px-1 text-center text-yellow-600">{s.drawn}</td>
                  <td className="py-2 px-1 text-center text-red-600">{s.lost}</td>
                  <td className="py-2 px-1 text-center font-bold text-lg">{s.bigPoints}</td>
                  <td className="py-2 px-1 text-center">
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
        <div className="bg-white rounded-lg shadow-md p-4 mb-8">
          <h2 className="text-lg font-bold mb-3">
            {PL.match.unplayed} ({unplayedMatches.length})
          </h2>
          <div className="space-y-2">
            {unplayedMatches.map((match) => (
              <div
                key={match.id}
                className="flex items-center justify-between py-2 px-3 bg-yellow-50 rounded border border-yellow-200"
              >
                <span className="font-medium">
                  {match.player1.firstName} {match.player1.lastName}
                </span>
                <span className="text-gray-400 text-sm mx-2">{PL.match.vs}</span>
                <span className="font-medium">
                  {match.player2.firstName} {match.player2.lastName}
                </span>
                <button
                  onClick={() => openResultForm(match)}
                  className="ml-4 bg-[var(--color-primary)] text-white px-3 py-1 rounded text-sm hover:bg-[var(--color-primary-light)]"
                >
                  {PL.match.enterResult}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Played matches */}
      {playedMatches.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-4">
          <h2 className="text-lg font-bold mb-3">{PL.group.matches} ({playedMatches.length})</h2>
          <div className="space-y-2">
            {playedMatches.map((match) => {
              const p1Won = match.winnerId === match.player1Id
              const p2Won = match.winnerId === match.player2Id

              return (
                <div
                  key={match.id}
                  className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded"
                >
                  <span className={`font-medium ${p1Won ? 'text-green-700' : ''}`}>
                    {match.player1.firstName} {match.player1.lastName}
                  </span>
                  <span className={`text-sm font-bold px-3 py-1 rounded ${
                    !match.winnerId
                      ? 'bg-yellow-100 text-yellow-700'
                      : match.isWalkover
                      ? 'bg-gray-200 text-gray-600'
                      : 'bg-[var(--color-primary)] text-white'
                  }`}>
                    {match.isWalkover ? 'W/O' : match.resultCode}
                  </span>
                  <span className={`font-medium ${p2Won ? 'text-green-700' : ''}`}>
                    {match.player2.firstName} {match.player2.lastName}
                  </span>
                  <div className="ml-4 flex gap-2">
                    <button
                      onClick={() => openResultForm(match)}
                      className="text-[var(--color-primary)] hover:underline text-sm"
                    >
                      {PL.common.edit}
                    </button>
                    <button
                      onClick={() => handleClearResult(match.id)}
                      className="text-red-600 hover:underline text-sm"
                    >
                      {PL.common.delete}
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">{PL.match.enterResult}</h3>
            <p className="text-gray-600 mb-4">
              {editingMatch.player1.firstName} {editingMatch.player1.lastName}
              <span className="mx-2 text-gray-400">{PL.match.vs}</span>
              {editingMatch.player2.firstName} {editingMatch.player2.lastName}
            </p>

            <div className="space-y-4">
              {/* Walkover toggle */}
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={resultForm.isWalkover}
                  onChange={(e) =>
                    setResultForm({ ...resultForm, isWalkover: e.target.checked })
                  }
                  className="rounded"
                />
                <span>{PL.match.walkover}</span>
              </label>

              {/* Winner selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {PL.match.winner}
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="winner"
                      value={editingMatch.player1Id}
                      checked={resultForm.winnerId === String(editingMatch.player1Id)}
                      onChange={(e) =>
                        setResultForm({ ...resultForm, winnerId: e.target.value })
                      }
                    />
                    {editingMatch.player1.firstName} {editingMatch.player1.lastName}
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="winner"
                      value={editingMatch.player2Id}
                      checked={resultForm.winnerId === String(editingMatch.player2Id)}
                      onChange={(e) =>
                        setResultForm({ ...resultForm, winnerId: e.target.value })
                      }
                    />
                    {editingMatch.player2.firstName} {editingMatch.player2.lastName}
                  </label>
                  {!resultForm.isWalkover && (
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="winner"
                        value=""
                        checked={resultForm.winnerId === ''}
                        onChange={() =>
                          setResultForm({ ...resultForm, winnerId: '', resultCode: 'Tied' })
                        }
                      />
                      {PL.match.draw}
                    </label>
                  )}
                </div>
              </div>

              {/* Result code (only when winner selected and not walkover) */}
              {resultForm.winnerId && !resultForm.isWalkover && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {PL.match.result}
                  </label>
                  <select
                    value={resultForm.resultCode}
                    onChange={(e) =>
                      setResultForm({ ...resultForm, resultCode: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded"
                  >
                    {RESULT_CODES.filter((c) => c !== 'Tied').map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={handleSubmitResult}
                disabled={!resultForm.winnerId && !resultForm.isWalkover && resultForm.resultCode !== 'Tied'}
                className="flex-1 bg-[var(--color-primary)] text-white py-2 rounded hover:bg-[var(--color-primary-light)] disabled:opacity-50"
              >
                {PL.match.save}
              </button>
              <button
                onClick={() => setEditingMatch(null)}
                className="flex-1 bg-gray-300 text-gray-700 py-2 rounded hover:bg-gray-400"
              >
                {PL.match.cancel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
