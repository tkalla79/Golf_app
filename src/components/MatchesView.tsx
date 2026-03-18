'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PL } from '@/constants/pl'

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
  winnerId: number | null
  resultCode: string | null
  player1BigPoints: number
  player2BigPoints: number
  played: boolean
  isWalkover: boolean
}

interface Standing {
  playerId: number
  firstName: string
  lastName: string
  slug: string
  position: number
  bigPoints: number
  smallPoints: number
  hcpAtStart: number | null
}

export default function MatchesView({
  matches,
  standings,
}: {
  matches: Match[]
  standings: Standing[]
}) {
  const [view, setView] = useState<'list' | 'matrix'>('list')

  const playedMatches = matches.filter((m) => m.played)
  const unplayedMatches = matches.filter((m) => !m.played)

  // Build match lookup
  const matchMap = new Map<string, Match>()
  for (const m of matches) {
    matchMap.set(`${m.player1Id}-${m.player2Id}`, m)
    matchMap.set(`${m.player2Id}-${m.player1Id}`, m)
  }

  function getCellData(rowPlayerId: number, colPlayerId: number) {
    const match = matchMap.get(`${rowPlayerId}-${colPlayerId}`)
    if (!match) return null
    if (!match.played) return { points: '', result: '', played: false }

    const rowIsP1 = match.player1Id === rowPlayerId
    const bigPts = rowIsP1 ? match.player1BigPoints : match.player2BigPoints
    const rowWon = match.winnerId === rowPlayerId
    const isDraw = match.played && !match.winnerId

    let resultText = ''
    if (isDraw) resultText = 'AS'
    else if (match.isWalkover) resultText = 'W/O'
    else resultText = match.resultCode || ''

    return { points: String(bigPts), result: resultText, played: true, won: rowWon, draw: isDraw }
  }

  const sortedPlayers = [...standings].sort((a, b) => a.position - b.position)

  return (
    <div>
      {/* Toggle */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-[var(--color-text-dark)]" style={{ fontFamily: 'Raleway, sans-serif' }}>
          Mecze
          <span className="ml-2 text-sm font-normal text-[var(--color-text-body)]/50">
            ({playedMatches.length}/{matches.length})
          </span>
        </h2>
        <div className="flex bg-[var(--color-bg-section)] rounded-lg p-1 border border-[var(--color-border)]">
          <button
            onClick={() => setView('list')}
            className={`px-4 py-1.5 rounded text-xs font-semibold uppercase tracking-wider transition-colors ${
              view === 'list' ? 'bg-[var(--color-primary)] text-white shadow-sm' : 'text-[var(--color-text-body)]/60 hover:text-[var(--color-text-dark)]'
            }`}
          >
            Lista
          </button>
          <button
            onClick={() => setView('matrix')}
            className={`px-4 py-1.5 rounded text-xs font-semibold uppercase tracking-wider transition-colors ${
              view === 'matrix' ? 'bg-[var(--color-primary)] text-white shadow-sm' : 'text-[var(--color-text-body)]/60 hover:text-[var(--color-text-dark)]'
            }`}
          >
            Tabelka
          </button>
        </div>
      </div>

      {view === 'list' ? (
        <div>
          {unplayedMatches.length > 0 && (
            <div className="mb-8">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-body)]/40 mb-3">
                {PL.match.unplayed} ({unplayedMatches.length})
              </h3>
              <div className="space-y-3">
                {unplayedMatches.map((match) => (
                  <div key={match.id} className="match-row border-[var(--color-accent)]/30 bg-[var(--color-accent)]/[0.04]">
                    <span className="font-semibold text-[var(--color-text-dark)] flex-1">{match.player1.firstName} {match.player1.lastName}</span>
                    <span className="badge-unplayed mx-4">{PL.match.vs}</span>
                    <span className="font-semibold text-[var(--color-text-dark)] flex-1 text-right">{match.player2.firstName} {match.player2.lastName}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {playedMatches.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-body)]/40 mb-3">
                Rozegrane ({playedMatches.length})
              </h3>
              <div className="space-y-3">
                {playedMatches.map((match) => {
                  const p1Won = match.winnerId === match.player1Id
                  const p2Won = match.winnerId === match.player2Id
                  const isDraw = match.played && !match.winnerId
                  return (
                    <div key={match.id} className="match-row">
                      <span className={`font-semibold flex-1 ${p1Won ? 'text-[var(--color-success)]' : 'text-[var(--color-text-dark)]'}`}>
                        {match.player1.firstName} {match.player1.lastName}
                        {p1Won && <span className="ml-1 text-xs">&#10003;</span>}
                      </span>
                      <span className={`mx-4 ${isDraw ? 'badge-draw' : match.isWalkover ? 'badge-walkover' : 'badge-win'}`}>
                        {match.isWalkover ? 'W/O' : match.resultCode}
                      </span>
                      <span className={`font-semibold flex-1 text-right ${p2Won ? 'text-[var(--color-success)]' : 'text-[var(--color-text-dark)]'}`}>
                        {p2Won && <span className="mr-1 text-xs">&#10003;</span>}
                        {match.player2.firstName} {match.player2.lastName}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* MATRIX VIEW */
        <div className="overflow-x-auto">
          <table
            className="border-collapse"
            style={{
              borderSpacing: 0,
              border: '2px solid #888',
              fontFamily: 'Lato, sans-serif',
              fontSize: '13px',
            }}
          >
            <thead>
              <tr>
                {/* Top-left corner */}
                <th
                  style={{
                    border: '1px solid #888',
                    padding: '8px 12px',
                    background: '#f0ede6',
                    fontWeight: 700,
                    textAlign: 'left',
                    minWidth: 130,
                    position: 'sticky',
                    left: 0,
                    zIndex: 10,
                  }}
                >
                </th>
                {/* Player column headers */}
                {sortedPlayers.map((p) => (
                  <th
                    key={p.playerId}
                    style={{
                      border: '1px solid #888',
                      padding: '6px 8px',
                      background: '#f0ede6',
                      fontWeight: 700,
                      textAlign: 'center',
                      minWidth: 75,
                      fontSize: '11px',
                      lineHeight: '1.3',
                    }}
                  >
                    {p.firstName}<br />{p.lastName}
                  </th>
                ))}
                <th
                  style={{
                    border: '1px solid #888',
                    padding: '6px 8px',
                    background: '#f0ede6',
                    fontWeight: 700,
                    textAlign: 'center',
                    minWidth: 65,
                    fontSize: '12px',
                  }}
                >
                  PUNKTY
                </th>
                <th
                  style={{
                    border: '1px solid #888',
                    padding: '6px 8px',
                    background: '#f0ede6',
                    fontWeight: 700,
                    textAlign: 'center',
                    minWidth: 50,
                    fontSize: '12px',
                  }}
                >
                  HCP
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedPlayers.map((rowPlayer) => {
                const standing = standings.find((s) => s.playerId === rowPlayer.playerId)
                return (
                  <tr key={rowPlayer.playerId}>
                    {/* Player name */}
                    <td
                      style={{
                        border: '1px solid #888',
                        padding: '0 12px',
                        fontWeight: 600,
                        background: '#fff',
                        whiteSpace: 'nowrap',
                        position: 'sticky',
                        left: 0,
                        zIndex: 5,
                      }}
                    >
                      <Link
                        href={`/zawodnik/${rowPlayer.slug}`}
                        className="hover:text-[var(--color-primary)] transition-colors"
                        style={{ color: '#333', textDecoration: 'none' }}
                      >
                        {rowPlayer.firstName} {rowPlayer.lastName}
                      </Link>
                    </td>

                    {/* Match cells */}
                    {sortedPlayers.map((colPlayer) => {
                      // Diagonal
                      if (rowPlayer.playerId === colPlayer.playerId) {
                        return (
                          <td
                            key={colPlayer.playerId}
                            style={{
                              border: '1px solid #2d7a3a',
                              background: '#2d7a3a',
                              width: 75,
                            }}
                          >
                            <div style={{ height: 24 }}></div>
                            <div style={{ height: 24 }}></div>
                          </td>
                        )
                      }

                      const cell = getCellData(rowPlayer.playerId, colPlayer.playerId)

                      // No match data
                      if (!cell) {
                        return (
                          <td key={colPlayer.playerId} style={{ border: '1px solid #888', background: '#fff' }}>
                            <div style={{ height: 24 }}></div>
                            <div style={{ height: 24, borderTop: '1px solid #ddd' }}></div>
                          </td>
                        )
                      }

                      // Unplayed
                      if (!cell.played) {
                        return (
                          <td key={colPlayer.playerId} style={{ border: '1px solid #888', background: '#fff' }}>
                            <div style={{ height: 24 }}></div>
                            <div style={{ height: 24, borderTop: '1px solid #ddd', textAlign: 'center', color: '#ccc', fontSize: 11, lineHeight: '24px' }}>
                            </div>
                          </td>
                        )
                      }

                      // Played
                      return (
                        <td key={colPlayer.playerId} style={{ border: '1px solid #888', background: '#fff' }}>
                          {/* Points row */}
                          <div
                            style={{
                              height: 24,
                              textAlign: 'center',
                              fontWeight: 700,
                              fontSize: 13,
                              lineHeight: '24px',
                              color: '#333',
                            }}
                          >
                            {cell.points}
                          </div>
                          {/* Result row */}
                          <div
                            style={{
                              height: 24,
                              textAlign: 'center',
                              fontSize: 12,
                              lineHeight: '24px',
                              borderTop: '1px solid #ddd',
                              fontWeight: 600,
                              color: '#555',
                            }}
                          >
                            {cell.result}
                          </div>
                        </td>
                      )
                    })}

                    {/* PUNKTY */}
                    <td
                      style={{
                        border: '1px solid #888',
                        textAlign: 'center',
                        fontWeight: 700,
                        fontSize: 15,
                        padding: '8px 4px',
                        background: '#fff',
                        color: '#134a56',
                      }}
                    >
                      {standing?.bigPoints ?? 0}
                    </td>

                    {/* HCP */}
                    <td
                      style={{
                        border: '1px solid #888',
                        textAlign: 'center',
                        fontSize: 13,
                        padding: '8px 4px',
                        background: '#fff',
                        color: '#666',
                      }}
                    >
                      {standing?.hcpAtStart != null ? standing.hcpAtStart.toFixed(1) : '–'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
