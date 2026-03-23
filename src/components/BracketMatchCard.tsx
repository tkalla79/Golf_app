// src/components/BracketMatchCard.tsx
import Link from 'next/link'
import type { BracketSlot } from '@/lib/playoff'

interface Props {
  slot: BracketSlot
}

export default function BracketMatchCard({ slot }: Props) {
  const hasPlayers = slot.player1Name || slot.player2Name

  return (
    <div className={`border rounded-lg overflow-hidden text-sm transition-colors ${
      slot.played
        ? 'border-[var(--color-border)] bg-white'
        : 'border-[var(--color-border)]/50 bg-[var(--color-primary)]/[0.02]'
    }`}>
      {/* Player 1 (top) */}
      <PlayerSlot
        name={slot.player1Name}
        slug={slot.player1Slug}
        seed={slot.player1Seed}
        isWinner={slot.winnerId !== null && slot.winnerId === slot.player1Id}
        isLoser={slot.winnerId !== null && slot.winnerId !== slot.player1Id}
        resultCode={slot.winnerId === slot.player1Id ? slot.resultCode : null}
      />

      <div className="border-t border-[var(--color-border)]/50" />

      {/* Player 2 (bottom) */}
      {slot.resultCode === 'BYE' ? (
        <div className="px-3 py-2 flex items-center gap-2">
          <span className="text-[var(--color-text-body)]/40 italic text-xs font-semibold">BYE</span>
        </div>
      ) : (
        <PlayerSlot
          name={slot.player2Name}
          slug={slot.player2Slug}
          seed={slot.player2Seed}
          isWinner={slot.winnerId !== null && slot.winnerId === slot.player2Id}
          isLoser={slot.winnerId !== null && slot.winnerId !== slot.player2Id}
          resultCode={slot.winnerId === slot.player2Id ? slot.resultCode : null}
        />
      )}

      {/* Status bar */}
      <div className={`text-center py-1 text-[0.6rem] font-semibold uppercase tracking-wider ${
        slot.played ? 'text-[var(--color-success)]/70' : 'text-[var(--color-text-body)]/30'
      }`}>
        {slot.played
          ? slot.holes
            ? `rozegrany · ${slot.holes} dołków`
            : 'rozegrany'
          : hasPlayers ? `do ${slot.deadline}` : ''}
      </div>
    </div>
  )
}

function PlayerSlot({
  name,
  slug,
  seed,
  isWinner,
  isLoser,
  resultCode,
}: {
  name: string | null
  slug: string | null
  seed: number | null
  isWinner: boolean
  isLoser: boolean
  resultCode: string | null
}) {
  if (!name) {
    return (
      <div className="px-3 py-2 flex items-center gap-2">
        <span className="text-[var(--color-text-body)]/20 italic text-xs">Oczekuje na wynik</span>
      </div>
    )
  }

  const nameEl = slug ? (
    <Link
      href={`/zawodnik/${slug}`}
      className={`font-semibold transition-colors ${
        isWinner ? 'text-[var(--color-primary)] hover:text-[var(--color-accent)]' :
        isLoser ? 'text-[var(--color-text-body)]/40 line-through' :
        'text-[var(--color-text-dark)] hover:text-[var(--color-primary)]'
      }`}
    >
      {name}
    </Link>
  ) : (
    <span className={`font-semibold ${
      isWinner ? 'text-[var(--color-primary)]' :
      isLoser ? 'text-[var(--color-text-body)]/40 line-through' :
      'text-[var(--color-text-body)]/40 italic'
    }`}>
      {name}
    </span>
  )

  return (
    <div className={`px-3 py-2 flex items-center justify-between gap-2 ${
      isWinner ? 'bg-[var(--color-success)]/[0.04]' : ''
    }`}>
      <div className="flex items-center gap-2 min-w-0">
        {seed !== null && (
          <span className={`text-xs font-bold w-5 text-center flex-shrink-0 ${
            isWinner ? 'text-[var(--color-success)]' : 'text-[var(--color-primary)]/30'
          }`}>
            {seed}
          </span>
        )}
        {nameEl}
      </div>
      {resultCode && (
        <span className="text-xs font-bold text-[var(--color-accent)] flex-shrink-0 ml-2">
          {resultCode}
        </span>
      )}
    </div>
  )
}
