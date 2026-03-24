// src/components/BracketMatchCard.tsx
import Link from 'next/link'
import type { BracketSlot } from '@/lib/playoff'

interface Props {
  slot: BracketSlot
  compact?: boolean
  showLabel?: string
}

export default function BracketMatchCard({ slot, compact, showLabel }: Props) {
  const isDecided = slot.played && slot.winnerId

  // Determine line colors for winner/loser paths
  const p1IsWinner = !!slot.winnerId && slot.winnerId === slot.player1Id
  const p2IsWinner = !!slot.winnerId && slot.winnerId === slot.player2Id

  return (
    <div className="bracket-match-card">
      {showLabel && (
        <div className="bracket-match-label">{showLabel}</div>
      )}
      <div className={`bracket-match ${isDecided ? 'decided' : 'pending'}`}>
        {/* Winner indicator line on left */}
        {isDecided && (
          <div className="bracket-indicator">
            <div className={`bracket-indicator-line ${p1IsWinner ? 'winner-line' : 'loser-line'}`} />
            <div className={`bracket-indicator-line ${p2IsWinner ? 'winner-line' : 'loser-line'}`} />
          </div>
        )}
        <div className="bracket-match-inner">
          <PlayerRow
            name={slot.player1Name}
            slug={slot.player1Slug}
            seed={slot.player1Seed}
            isWinner={p1IsWinner}
            isLoser={isDecided && !p1IsWinner}
            score={p1IsWinner ? 1 : slot.played ? 0 : null}
            compact={compact}
          />
          {slot.resultCode === 'BYE' ? (
            <div className="bracket-player bye">
              <span className="bracket-player-name">BYE</span>
            </div>
          ) : (
            <PlayerRow
              name={slot.player2Name}
              slug={slot.player2Slug}
              seed={slot.player2Seed}
              isWinner={p2IsWinner}
              isLoser={isDecided && !p2IsWinner}
              score={p2IsWinner ? 1 : slot.played ? 0 : null}
              compact={compact}
            />
          )}
        </div>
      </div>
      {slot.played && slot.resultCode && slot.resultCode !== 'BYE' && (
        <div className="bracket-result-code">{slot.resultCode}</div>
      )}
    </div>
  )
}

function PlayerRow({
  name,
  slug,
  seed,
  isWinner,
  isLoser,
  score,
  compact,
}: {
  name: string | null
  slug: string | null
  seed: number | null
  isWinner: boolean
  isLoser?: boolean
  score: number | null
  compact?: boolean
}) {
  if (!name) {
    return (
      <div className="bracket-player pending">
        <span className="bracket-player-name empty">&nbsp;</span>
      </div>
    )
  }

  const nameEl = slug ? (
    <Link href={`/zawodnik/${slug}`} className={`bracket-player-name ${isWinner ? 'winner' : isLoser ? 'loser' : ''}`}>
      {compact ? shortName(name) : name}
    </Link>
  ) : (
    <span className={`bracket-player-name ${isWinner ? 'winner' : isLoser ? 'loser' : ''}`}>
      {compact ? shortName(name) : name}
    </span>
  )

  return (
    <div className={`bracket-player ${isWinner ? 'winner-row' : isLoser ? 'loser-row' : ''}`}>
      {seed !== null && <span className="bracket-seed">{seed}</span>}
      {nameEl}
      {score !== null && (
        <span className={`bracket-score ${isWinner ? 'win' : 'lose'}`}>{score}</span>
      )}
    </div>
  )
}

function shortName(full: string): string {
  const parts = full.split(' ')
  if (parts.length < 2) return full
  return `${parts[0][0]}. ${parts.slice(1).join(' ')}`
}
