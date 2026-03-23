// src/components/PlayoffBracket.tsx
'use client'

import { useState } from 'react'
import BracketMatchCard from './BracketMatchCard'
import { PL } from '@/constants/pl'
import type { BracketSlot } from '@/lib/playoff'
import { ROUND_NAMES, BRACKET_HOLES } from '@/lib/playoff'

interface BracketData {
  groupId: number
  name: string
  bracketKey: string
  slots: BracketSlot[]
}

interface Props {
  brackets: BracketData[]
}

const HOLES_LABELS: Record<string, string> = {
  '1-16': PL.playoff.holes18,
  '17-32': PL.playoff.holes918,
  '33-48': PL.playoff.holes9,
}

export default function PlayoffBracket({ brackets }: Props) {
  const [activeTab, setActiveTab] = useState(0)
  const active = brackets[activeTab]
  if (!active) return null

  const rounds = [1, 2, 3, 4]
  const roundSizes = [8, 4, 2, 1]

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b-2 border-[var(--color-border)]">
        {brackets.map((b, i) => (
          <button
            key={b.groupId}
            onClick={() => setActiveTab(i)}
            className={`px-5 py-3 font-bold text-sm uppercase tracking-wide border-b-[3px] -mb-[2px] transition-colors ${
              i === activeTab
                ? 'text-[var(--color-primary)] border-[var(--color-accent)]'
                : 'text-[var(--color-text-body)]/50 border-transparent hover:text-[var(--color-primary)]'
            }`}
            style={{ fontFamily: 'Raleway, sans-serif' }}
          >
            {b.name.replace('Drabinka ', '')}
            <span className="block text-[0.6rem] font-normal normal-case tracking-normal text-[var(--color-text-body)]/40">
              {HOLES_LABELS[b.bracketKey] ?? ''}
            </span>
          </button>
        ))}
      </div>

      {/* Bracket grid */}
      <div className="card p-6 overflow-x-auto">
        {/* Round headers */}
        <div className="grid gap-4 mb-4 min-w-[800px]"
             style={{ gridTemplateColumns: 'repeat(4, 200px)', justifyContent: 'start', columnGap: '40px' }}>
          {rounds.map(r => (
            <div key={r} className="text-center text-[0.65rem] font-bold uppercase tracking-[0.15em] text-[var(--color-text-body)]/40">
              {ROUND_NAMES[r]}
            </div>
          ))}
        </div>

        {/* Match grid */}
        <div className="grid gap-4 min-w-[800px]"
             style={{ gridTemplateColumns: 'repeat(4, 200px)', justifyContent: 'start', columnGap: '40px' }}>
          {rounds.map(r => {
            const slotsForRound = active.slots.filter(s => s.bracketRound === r)
            const gapClass = r === 1 ? 'gap-2' : r === 2 ? 'gap-10' : r === 3 ? 'gap-24' : ''
            const paddingTop = r === 2 ? 'pt-7' : r === 3 ? 'pt-[72px]' : r === 4 ? 'pt-[168px]' : ''

            return (
              <div key={r} className={`flex flex-col justify-start ${gapClass} ${paddingTop}`}>
                {slotsForRound.map((slot) => (
                  <BracketMatchCard key={`${slot.bracketRound}-${slot.bracketPosition}`} slot={slot} />
                ))}

                {/* Champion card after final */}
                {r === 4 && slotsForRound[0]?.winnerId && (
                  <div className="mt-4 bg-[var(--color-primary)] border-2 border-[var(--color-accent)] rounded-lg p-4 text-center">
                    <div className="text-2xl mb-1">🏆</div>
                    <div className="text-[0.6rem] font-bold tracking-[0.2em] uppercase text-[var(--color-accent)]">
                      {PL.playoff.champion}
                    </div>
                    <div className="text-white font-bold text-sm mt-1" style={{ fontFamily: 'Raleway, sans-serif' }}>
                      {slotsForRound[0].winnerId === slotsForRound[0].player1Id
                        ? slotsForRound[0].player1Name
                        : slotsForRound[0].player2Name}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
