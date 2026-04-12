// src/components/PlayoffBracket.tsx
'use client'

import { useState } from 'react'
import BracketMatchCard from './BracketMatchCard'
import { PL } from '@/constants/pl'
import type { BracketSlot } from '@/lib/playoff'
import { PLACEMENT_LABELS } from '@/lib/playoff'
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
  const getSlot = (round: number, pos: number) =>
    slots.find(s => s.bracketRound === round && s.bracketPosition === pos) ?? null
  const getSlots = (round: number, positions: number[]) =>
    positions.map(p => getSlot(round, p)).filter(Boolean) as BracketSlot[]

  const bracketOffset = active.bracketKey === '1-16' ? 0 : active.bracketKey === '17-32' ? 16 : 32

  // Build classification from R4
  const r4Slots = getSlots(4, [1, 2, 3, 4, 5, 6, 7, 8])
  const classification: { place: number; name: string; slug: string | null }[] = []
  for (const slot of r4Slots) {
    if (!slot.played || !slot.winnerId) continue
    const wName = slot.winnerId === slot.player1Id ? slot.player1Name : slot.player2Name
    const wSlug = slot.winnerId === slot.player1Id ? slot.player1Slug : slot.player2Slug
    const lName = slot.winnerId === slot.player1Id ? slot.player2Name : slot.player1Name
    const lSlug = slot.winnerId === slot.player1Id ? slot.player2Slug : slot.player1Slug
    const base = (slot.bracketPosition - 1) * 2 + 1 + bracketOffset
    if (wName) classification.push({ place: base, name: wName, slug: wSlug })
    if (lName) classification.push({ place: base + 1, name: lName, slug: lSlug })
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
            {b.name}
            <span className="block text-[0.6rem] font-normal normal-case tracking-normal text-[var(--color-text-body)]/40">
              {HOLES_LABELS[b.bracketKey] ?? ''}
            </span>
          </button>
        ))}
      </div>

      {/* Pyramid bracket */}
      <div className="bracket-pyramid-container">

        {/* ═══ TOP: Finały o miejsca (R4) — zwycięzca na górze ═══ */}
        <div className="bracket-section">
          <div className="bracket-section-title accent">Finały o miejsca</div>

          {/* Miejsca 1-2 (FINAŁ) */}
          <div className="bracket-finals-top">
            {getSlot(4, 1) && (
              <BracketMatchCard slot={getSlot(4, 1)!} showLabel={`Miejsca ${1 + bracketOffset}-${2 + bracketOffset}`} />
            )}
          </div>

          {/* Miejsca 3-4 */}
          <div className="bracket-finals-row">
            {getSlot(4, 2) && (
              <BracketMatchCard slot={getSlot(4, 2)!} showLabel={`Miejsca ${3 + bracketOffset}-${4 + bracketOffset}`} />
            )}
          </div>

          {/* Miejsca 5-8 */}
          <div className="bracket-finals-pair">
            {[3, 4].map(p => getSlot(4, p) && (
              <BracketMatchCard key={p} slot={getSlot(4, p)!} compact showLabel={`Miejsca ${(p - 1) * 2 + 1 + bracketOffset}-${p * 2 + bracketOffset}`} />
            ))}
          </div>
        </div>

        {/* ═══ GÓRNA TABELA: O miejsca 1-8 (R1 winners path) ═══ */}
        <div className="bracket-section">
          <div className="bracket-section-title">O miejsca {1 + bracketOffset}-{8 + bracketOffset}</div>

          {/* R3: Półfinały (pos 1-2) + O miejsca 5-8 (pos 3-4) */}
          <div className="bracket-round-row">
            <div className="bracket-subsection">
              <div className="bracket-sub-label">Półfinały</div>
              <div className="bracket-pair-row">
                {[1, 2].map(p => getSlot(3, p) && (
                  <BracketMatchCard key={p} slot={getSlot(3, p)!} compact />
                ))}
              </div>
            </div>
            <div className="bracket-subsection muted">
              <div className="bracket-sub-label">O miejsca {5 + bracketOffset}-{8 + bracketOffset}</div>
              <div className="bracket-pair-row">
                {[3, 4].map(p => getSlot(3, p) && (
                  <BracketMatchCard key={p} slot={getSlot(3, p)!} compact />
                ))}
              </div>
            </div>
          </div>

          {/* R2: Ćwierćfinały (pos 1-4) */}
          <div className="bracket-round-row">
            <div className="bracket-sub-label">Ćwierćfinały</div>
            <div className="bracket-quad-row">
              {[1, 2, 3, 4].map(p => getSlot(2, p) && (
                <BracketMatchCard key={p} slot={getSlot(2, p)!} compact />
              ))}
            </div>
          </div>
        </div>

        {/* ═══ RUNDA 1: 1/8 Finału ═══ */}
        <div className="bracket-section">
          <div className="bracket-section-title">1/8 Finału</div>
          <div className="bracket-r1-row">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(p => getSlot(1, p) && (
              <BracketMatchCard key={p} slot={getSlot(1, p)!} compact />
            ))}
          </div>
        </div>

        {/* ═══ DOLNA TABELA: O miejsca 9-16 (R1 losers path) ═══ */}
        <div className="bracket-section">
          <div className="bracket-section-title muted">O miejsca {9 + bracketOffset}-{16 + bracketOffset}</div>

          {/* R2: O miejsca 9-16 (pos 5-8) */}
          <div className="bracket-round-row">
            <div className="bracket-sub-label">Runda 2</div>
            <div className="bracket-quad-row">
              {[5, 6, 7, 8].map(p => getSlot(2, p) && (
                <BracketMatchCard key={p} slot={getSlot(2, p)!} compact />
              ))}
            </div>
          </div>

          {/* R3: O miejsca 9-12 (pos 5-6) + O miejsca 13-16 (pos 7-8) */}
          <div className="bracket-round-row">
            <div className="bracket-subsection">
              <div className="bracket-sub-label">O miejsca {9 + bracketOffset}-{12 + bracketOffset}</div>
              <div className="bracket-pair-row">
                {[5, 6].map(p => getSlot(3, p) && (
                  <BracketMatchCard key={p} slot={getSlot(3, p)!} compact />
                ))}
              </div>
            </div>
            <div className="bracket-subsection muted">
              <div className="bracket-sub-label">O miejsca {13 + bracketOffset}-{16 + bracketOffset}</div>
              <div className="bracket-pair-row">
                {[7, 8].map(p => getSlot(3, p) && (
                  <BracketMatchCard key={p} slot={getSlot(3, p)!} compact />
                ))}
              </div>
            </div>
          </div>

          {/* R4: Finały o 9-16 */}
          <div className="bracket-finals-pair">
            {[5, 6, 7, 8].map(p => getSlot(4, p) && (
              <BracketMatchCard key={p} slot={getSlot(4, p)!} compact showLabel={`Miejsca ${(p - 1) * 2 + 1 + bracketOffset}-${p * 2 + bracketOffset}`} />
            ))}
          </div>
        </div>
      </div>

      {/* ═══ CHAMPION ═══ */}
      {r4Slots[0]?.played && r4Slots[0]?.winnerId && (
        <div className="bg-[var(--color-primary)] border-2 border-[var(--color-accent)] rounded-xl p-6 text-center my-8">
          <div className="text-3xl mb-2">🏆</div>
          <div className="text-[0.65rem] font-bold tracking-[0.25em] uppercase text-[var(--color-accent)]">
            {PL.playoff.champion} — {active.name}
          </div>
          <div className="text-white font-bold text-xl mt-1" style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif' }}>
            {r4Slots[0].winnerId === r4Slots[0].player1Id ? r4Slots[0].player1Name : r4Slots[0].player2Name}
          </div>
        </div>
      )}

      {/* ═══ KLASYFIKACJA KOŃCOWA ═══ */}
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
                <th className="text-left !rounded-none w-20">Miejsce</th>
                <th className="text-left !rounded-none">Zawodnik</th>
              </tr>
            </thead>
            <tbody>
              {classification.map(({ place, name, slug }) => (
                <tr key={place} className={place <= (bracketOffset + 3) ? 'bg-[var(--color-accent)]/[0.06]' : ''}>
                  <td className="font-bold text-[var(--color-primary)]">
                    {place === bracketOffset + 1 && '🥇 '}
                    {place === bracketOffset + 2 && '🥈 '}
                    {place === bracketOffset + 3 && '🥉 '}
                    {place}
                  </td>
                  <td>
                    {slug ? (
                      <Link href={`/zawodnik/${slug}`} className="font-semibold text-[var(--color-text-dark)] hover:text-[var(--color-primary)] transition-colors">
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
