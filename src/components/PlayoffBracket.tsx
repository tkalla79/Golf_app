// src/components/PlayoffBracket.tsx
'use client'

import { useState } from 'react'
import BracketMatchCard from './BracketMatchCard'
import { PL } from '@/constants/pl'
import type { BracketSlot } from '@/lib/playoff'
import { ROUND_NAMES, PLACEMENT_LABELS } from '@/lib/playoff'
import Link from 'next/link'

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

  const slots = active.slots
  const getSlots = (round: number, positions?: number[]) =>
    slots
      .filter(s => s.bracketRound === round && (!positions || positions.includes(s.bracketPosition)))
      .sort((a, b) => a.bracketPosition - b.bracketPosition)

  // R4 slots for final classification
  const r4Slots = getSlots(4)

  // Determine bracket offset for placement labels (0 for 1-16, 16 for 17-32, 32 for 33-48)
  const bracketOffset = active.bracketKey === '1-16' ? 0 : active.bracketKey === '17-32' ? 16 : 32

  // Build final classification from R4 results
  const classification: { place: number; name: string; slug: string | null }[] = []
  for (const slot of r4Slots) {
    if (!slot.played || !slot.winnerId) continue
    const winnerName = slot.winnerId === slot.player1Id ? slot.player1Name : slot.player2Name
    const winnerSlug = slot.winnerId === slot.player1Id ? slot.player1Slug : slot.player2Slug
    const loserName = slot.winnerId === slot.player1Id ? slot.player2Name : slot.player1Name
    const loserSlug = slot.winnerId === slot.player1Id ? slot.player2Slug : slot.player1Slug

    // pos 1 → places 1-2 (winner=1, loser=2), pos 2 → 3-4, etc.
    const basePlace = (slot.bracketPosition - 1) * 2 + 1 + bracketOffset
    if (winnerName) classification.push({ place: basePlace, name: winnerName, slug: winnerSlug })
    if (loserName) classification.push({ place: basePlace + 1, name: loserName, slug: loserSlug })
  }
  classification.sort((a, b) => a.place - b.place)

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
            style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif' }}
          >
            {b.name.replace('Drabinka ', '')}
            <span className="block text-[0.6rem] font-normal normal-case tracking-normal text-[var(--color-text-body)]/40">
              {HOLES_LABELS[b.bracketKey] ?? ''}
            </span>
          </button>
        ))}
      </div>

      {/* ═══ RUNDA 1 — 1/8 Finału ═══ */}
      <RoundSection title="Runda 1 — 1/8 Finału" deadline="do 06.09.2026">
        <MatchGrid slots={getSlots(1)} columns={4} />
      </RoundSection>

      {/* ═══ RUNDA 2 ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Górna tabela — zwycięzcy R1 (o miejsca 1-8) */}
        <RoundSection
          title="Runda 2 — O miejsca 1-8"
          subtitle="Zwycięzcy 1/8 finału"
          accent="success"
          deadline="do 25.09.2026"
        >
          <MatchGrid slots={getSlots(2, [1, 2, 3, 4])} columns={2} />
        </RoundSection>

        {/* Dolna tabela — przegrani R1 (o miejsca 9-16) */}
        <RoundSection
          title="Runda 2 — O miejsca 9-16"
          subtitle="Przegrani 1/8 finału"
          accent="muted"
          deadline="do 25.09.2026"
        >
          <MatchGrid slots={getSlots(2, [5, 6, 7, 8])} columns={2} />
        </RoundSection>
      </div>

      {/* ═══ RUNDA 3 ═══ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <RoundSection title="Półfinał 1-4" compact deadline="do 11.10.2026">
          <MatchGrid slots={getSlots(3, [1, 2])} columns={1} />
        </RoundSection>
        <RoundSection title="O miejsca 5-8" compact accent="muted" deadline="do 11.10.2026">
          <MatchGrid slots={getSlots(3, [3, 4])} columns={1} />
        </RoundSection>
        <RoundSection title="O miejsca 9-12" compact accent="muted" deadline="do 11.10.2026">
          <MatchGrid slots={getSlots(3, [5, 6])} columns={1} />
        </RoundSection>
        <RoundSection title="O miejsca 13-16" compact accent="muted" deadline="do 11.10.2026">
          <MatchGrid slots={getSlots(3, [7, 8])} columns={1} />
        </RoundSection>
      </div>

      {/* ═══ RUNDA 4 — Finały o miejsca ═══ */}
      <RoundSection title="Runda 4 — Finały o miejsca" deadline="do 31.10.2026">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {r4Slots.map(slot => (
            <div key={`${slot.bracketRound}-${slot.bracketPosition}`}>
              <div className={`text-center text-[0.65rem] font-bold uppercase tracking-wider mb-2 ${
                slot.bracketPosition <= 2 ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-body)]/40'
              }`}>
                {slot.placementLabel ?? `Miejsca ${(slot.bracketPosition - 1) * 2 + 1 + bracketOffset}-${slot.bracketPosition * 2 + bracketOffset}`}
              </div>
              <BracketMatchCard slot={slot} />
            </div>
          ))}
        </div>
      </RoundSection>

      {/* ═══ CHAMPION ═══ */}
      {r4Slots[0]?.played && r4Slots[0]?.winnerId && (
        <div className="bg-[var(--color-primary)] border-2 border-[var(--color-accent)] rounded-xl p-6 text-center mb-8">
          <div className="text-3xl mb-2">🏆</div>
          <div className="text-[0.65rem] font-bold tracking-[0.25em] uppercase text-[var(--color-accent)]">
            {PL.playoff.champion} {active.name.replace('Drabinka ', '')}
          </div>
          <div className="text-white font-bold text-xl mt-1" style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif' }}>
            {r4Slots[0].winnerId === r4Slots[0].player1Id ? r4Slots[0].player1Name : r4Slots[0].player2Name}
          </div>
        </div>
      )}

      {/* ═══ ZBIORCZA KLASYFIKACJA ═══ */}
      {classification.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="bg-[var(--color-primary)] px-6 py-4">
            <h3 className="text-white font-bold tracking-wide" style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif' }}>
              Klasyfikacja końcowa — {active.name}
            </h3>
          </div>
          <table className="standings-table w-full text-sm">
            <thead>
              <tr>
                <th className="text-left !rounded-none">Miejsce</th>
                <th className="text-left !rounded-none">Zawodnik</th>
              </tr>
            </thead>
            <tbody>
              {classification.map(({ place, name, slug }) => (
                <tr key={place} className={place <= (bracketOffset + 3) ? 'bg-[var(--color-accent)]/[0.06]' : ''}>
                  <td className="font-bold text-[var(--color-primary)] w-16">
                    {place === bracketOffset + 1 && <span className="mr-1">🥇</span>}
                    {place === bracketOffset + 2 && <span className="mr-1">🥈</span>}
                    {place === bracketOffset + 3 && <span className="mr-1">🥉</span>}
                    {place}
                  </td>
                  <td>
                    {slug ? (
                      <Link
                        href={`/zawodnik/${slug}`}
                        className="font-semibold text-[var(--color-text-dark)] hover:text-[var(--color-primary)] transition-colors"
                      >
                        {name}
                      </Link>
                    ) : (
                      <span className="font-semibold text-[var(--color-text-dark)]">{name}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ═══ Helper Components ═══

function RoundSection({
  title,
  subtitle,
  accent,
  compact,
  deadline,
  children,
}: {
  title: string
  subtitle?: string
  accent?: 'success' | 'muted'
  compact?: boolean
  deadline?: string
  children: React.ReactNode
}) {
  return (
    <div className={compact ? '' : 'mb-8'}>
      <div className={`flex items-center justify-between mb-3 ${compact ? '' : 'border-b border-[var(--color-border)] pb-2'}`}>
        <div>
          <h3 className={`font-bold ${compact ? 'text-sm' : 'text-base'} ${
            accent === 'muted' ? 'text-[var(--color-text-body)]/60' : 'text-[var(--color-primary)]'
          }`} style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif' }}>
            {title}
          </h3>
          {subtitle && (
            <div className="text-[0.65rem] text-[var(--color-text-body)]/40 mt-0.5">{subtitle}</div>
          )}
        </div>
        {deadline && (
          <span className="text-[0.6rem] font-semibold text-[var(--color-text-body)]/30 uppercase tracking-wider">
            {deadline}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

function MatchGrid({ slots, columns }: { slots: BracketSlot[]; columns: number }) {
  return (
    <div className={`grid gap-3 ${
      columns === 4 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4' :
      columns === 2 ? 'grid-cols-1 sm:grid-cols-2' :
      'grid-cols-1'
    }`}>
      {slots.map(slot => (
        <BracketMatchCard key={`${slot.bracketRound}-${slot.bracketPosition}`} slot={slot} />
      ))}
    </div>
  )
}
