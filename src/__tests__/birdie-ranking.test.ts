import { describe, it, expect } from 'vitest'
import { buildBirdieRanking, type BirdieMatchRow } from '@/lib/season-birdies'

/**
 * Klasyfikacja birdie — faza grupowa i playoff sumowane razem.
 * Ustalenie Tomka (20.08.2026): birdie z playoff DOKŁADAJĄ się do dorobku z rund
 * grupowych, nie zerują go.
 */

const players: Record<number, { firstName: string; lastName: string; slug: string }> = {
  1: { firstName: 'Kacper', lastName: 'Glinka', slug: 'kacper-glinka' },
  2: { firstName: 'Sebastian', lastName: 'Szot', slug: 'sebastian-szot' },
  3: { firstName: 'Fabio', lastName: 'Szic', slug: 'fabio-szic' },
  4: { firstName: 'Anna', lastName: 'Adamska', slug: 'anna-adamska' },
}

function match(
  p1: number, p1Birdies: number,
  p2: number, p2Birdies: number,
  type: 'ROUND_ROBIN' | 'PLAYOFF' = 'ROUND_ROBIN',
): BirdieMatchRow {
  return {
    player1Id: p1,
    player2Id: p2,
    player1Birdies: p1Birdies,
    player2Birdies: p2Birdies,
    player1: players[p1],
    player2: players[p2],
    group: { round: { type } },
  }
}

describe('buildBirdieRanking', () => {
  it('sumuje birdie z fazy grupowej i playoff', () => {
    const ranking = buildBirdieRanking([
      match(1, 3, 2, 1),                  // grupy
      match(1, 2, 3, 0, 'PLAYOFF'),       // playoff
    ])

    const glinka = ranking.find((r) => r.playerId === 1)!
    expect(glinka.groupPhase).toBe(3)
    expect(glinka.playoff).toBe(2)
    expect(glinka.total).toBe(5)
    expect(glinka.matchesPlayed).toBe(2)
  })

  it('playoff nie zeruje dorobku z grup', () => {
    const ranking = buildBirdieRanking([
      match(1, 4, 2, 0),
      match(1, 0, 3, 0, 'PLAYOFF'), // zero birdie w playoff
    ])
    expect(ranking.find((r) => r.playerId === 1)!.total).toBe(4)
  })

  it('sortuje po sumie malejąco', () => {
    const ranking = buildBirdieRanking([
      match(1, 1, 2, 5),
      match(3, 3, 4, 0),
    ])
    expect(ranking.map((r) => r.playerId)).toEqual([2, 3, 1, 4])
  })

  it('przy równej sumie wyżej gracz z mniejszą liczbą meczów', () => {
    const ranking = buildBirdieRanking([
      match(1, 2, 2, 0),  // Glinka: 2 birdie w 1 meczu
      match(1, 0, 3, 0),  // Glinka: 2. mecz, 0 birdie
      match(4, 2, 2, 0),  // Adamska: 2 birdie w 1 meczu
    ])
    const glinka = ranking.find((r) => r.playerId === 1)!
    const adamska = ranking.find((r) => r.playerId === 4)!
    expect(glinka.total).toBe(2)
    expect(adamska.total).toBe(2)
    expect(adamska.matchesPlayed).toBeLessThan(glinka.matchesPlayed)
    expect(adamska.position).toBeLessThanOrEqual(glinka.position)
  })

  it('ta sama suma daje tę samą pozycję (ex aequo)', () => {
    const ranking = buildBirdieRanking([
      match(1, 3, 2, 3),
      match(3, 1, 4, 0),
    ])
    const byId = new Map(ranking.map((r) => [r.playerId, r]))
    expect(byId.get(1)!.total).toBe(3)
    expect(byId.get(2)!.total).toBe(3)
    expect(byId.get(1)!.position).toBe(byId.get(2)!.position)
    expect(byId.get(3)!.position).toBe(3) // po dwóch remisujących na 1. miejscu
  })

  it('liczy średnią birdie na mecz', () => {
    const ranking = buildBirdieRanking([
      match(1, 3, 2, 0),
      match(1, 2, 3, 0),
    ])
    expect(ranking.find((r) => r.playerId === 1)!.perMatch).toBe(2.5)
    expect(ranking.find((r) => r.playerId === 2)!.perMatch).toBe(0)
  })

  it('pomija mecze BYE (ten sam gracz po obu stronach)', () => {
    const ranking = buildBirdieRanking([
      { ...match(1, 0, 1, 0, 'PLAYOFF'), player2Id: 1, player2: players[1] },
      match(1, 2, 2, 0),
    ])
    const glinka = ranking.find((r) => r.playerId === 1)!
    expect(glinka.matchesPlayed).toBe(1)
    expect(glinka.total).toBe(2)
  })

  it('pusta lista meczów daje pustą klasyfikację', () => {
    expect(buildBirdieRanking([])).toEqual([])
  })
})
