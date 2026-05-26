import { Match, Player, GroupPlayer } from '@prisma/client'

export interface PlayerStanding {
  playerId: number
  firstName: string
  lastName: string
  slug: string
  played: number
  won: number
  drawn: number
  lost: number
  bigPoints: number
  smallPoints: number
  birdies: number
  hcpAtStart: number | null
  position: number
  finalPosition: number | null
}

type MatchWithPlayers = Match & {
  player1: Player
  player2: Player
}

type GroupPlayerWithPlayer = GroupPlayer & {
  player: Player
}

export function computeStandings(
  groupPlayers: GroupPlayerWithPlayer[],
  matches: MatchWithPlayers[]
): PlayerStanding[] {
  const standings: Map<number, PlayerStanding> = new Map()

  for (const gp of groupPlayers) {
    standings.set(gp.playerId, {
      playerId: gp.playerId,
      firstName: gp.player.firstName,
      lastName: gp.player.lastName,
      slug: gp.player.slug,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      bigPoints: 0,
      smallPoints: 0,
      birdies: 0,
      hcpAtStart: gp.hcpAtStart ? Number(gp.hcpAtStart) : null,
      position: 0,
      finalPosition: gp.finalPosition,
    })
  }

  for (const match of matches) {
    if (!match.played) continue

    const p1 = standings.get(match.player1Id)
    const p2 = standings.get(match.player2Id)
    if (!p1 || !p2) continue

    p1.played++
    p2.played++
    p1.bigPoints += Number(match.player1BigPoints)
    p2.bigPoints += Number(match.player2BigPoints)
    p1.smallPoints += match.player1SmallPoints
    p2.smallPoints += match.player2SmallPoints
    p1.birdies += match.player1Birdies
    p2.birdies += match.player2Birdies

    if (match.winnerId === match.player1Id) {
      p1.won++
      p2.lost++
    } else if (match.winnerId === match.player2Id) {
      p2.won++
      p1.lost++
    } else {
      p1.drawn++
      p2.drawn++
    }
  }

  const players = Array.from(standings.values())

  // Pre-compute tied groups and mini-tables BEFORE sorting (to avoid unstable comparator)
  const byBigPoints = new Map<number, number[]>()
  for (const p of players) {
    const group = byBigPoints.get(p.bigPoints) || []
    group.push(p.playerId)
    byBigPoints.set(p.bigPoints, group)
  }

  const miniTables = new Map<number, Map<number, number>>()
  for (const [bp, playerIds] of byBigPoints) {
    if (playerIds.length >= 3) {
      miniTables.set(bp, computeMiniTable(new Set(playerIds), matches))
    }
  }

  const sorted = players
  /**
   * Tie-breaker rules — KEEP IN SYNC z `src/app/(public)/regulamin/page.tsx` (sekcja IV.4)
   *
   * Kolejność rozstrzygania remisów (gracze z tymi samymi big points):
   *   1. Małe punkty DESC — suma margin holes ze WSZYSTKICH rozegranych meczów
   *   2. Head-to-head — bezpośredni mecz (gdy 2 graczy nadal remisuje po m.pkt)
   *   3. Mała tabelka — big points z meczów tylko między tied players (3+ graczy)
   *   4. HCP DESC — wyższy HCP → wyższa pozycja (fair na słabszych)
   *   5. (poza kodem) Losowanie Zarządu Ligi
   *
   * Uzasadnienie kolejności:
   *   - Małe punkty agregują wynik z CAŁEGO sezonu, więc gracz dominujący przewagą
   *     (np. +32 m.pkt) trafia wyżej niż ten, kto wygrał konkretne 2 mecze w mini-lidze.
   *   - Mała tabelka jako fallback dla skrajnych remisów po m.pkt — rzadko stosowana.
   *
   * Regresja: testy w `src/__tests__/standings.test.ts` blokują zmianę tej kolejności
   * bez aktualizacji testów I regulaminu.
   */
  sorted.sort((a, b) => {
    // 1. Big points DESC
    if (b.bigPoints !== a.bigPoints) return b.bigPoints - a.bigPoints

    // 2. Małe punkty DESC (suma margin ze wszystkich meczów)
    if (b.smallPoints !== a.smallPoints) return b.smallPoints - a.smallPoints

    // 3. Head-to-head (tylko 2 tied — bezpośredni mecz)
    const h2h = getHeadToHead(a.playerId, b.playerId, matches)
    if (h2h !== 0) return h2h

    // 4. Mała tabelka (3+ tied — fallback gdy m.pkt też równe)
    const miniTable = miniTables.get(a.bigPoints)
    if (miniTable) {
      const aMini = miniTable.get(a.playerId) ?? 0
      const bMini = miniTable.get(b.playerId) ?? 0
      if (bMini !== aMini) return bMini - aMini
    }

    // 5. HCP DESC — wyższy HCP zajmuje wyższe miejsce
    const aHcp = a.hcpAtStart ?? 0
    const bHcp = b.hcpAtStart ?? 0
    if (bHcp !== aHcp) return bHcp - aHcp

    return 0
  })

  sorted.forEach((s, i) => {
    s.position = s.finalPosition ?? i + 1
  })

  // Re-sort by final position if any are set manually
  sorted.sort((a, b) => a.position - b.position)

  return sorted
}

/**
 * "Mała tabelka" — compute big points from only matches between a set of tied players.
 * Returns a Map of playerId → mini-table big points.
 */
function computeMiniTable(
  tiedPlayerIds: Set<number>,
  matches: MatchWithPlayers[]
): Map<number, number> {
  const miniPoints = new Map<number, number>()
  for (const id of tiedPlayerIds) {
    miniPoints.set(id, 0)
  }

  for (const match of matches) {
    if (!match.played) continue
    if (!tiedPlayerIds.has(match.player1Id) || !tiedPlayerIds.has(match.player2Id)) continue

    // Both players are in the tied group — count their big points
    miniPoints.set(match.player1Id, (miniPoints.get(match.player1Id) ?? 0) + Number(match.player1BigPoints))
    miniPoints.set(match.player2Id, (miniPoints.get(match.player2Id) ?? 0) + Number(match.player2BigPoints))
  }

  return miniPoints
}

function getHeadToHead(
  playerAId: number,
  playerBId: number,
  matches: MatchWithPlayers[]
): number {
  const h2hMatch = matches.find(
    (m) =>
      m.played &&
      ((m.player1Id === playerAId && m.player2Id === playerBId) ||
        (m.player1Id === playerBId && m.player2Id === playerAId))
  )

  if (!h2hMatch || !h2hMatch.winnerId) return 0

  if (h2hMatch.winnerId === playerAId) return -1 // A wins -> A ranks higher
  if (h2hMatch.winnerId === playerBId) return 1  // B wins -> B ranks higher
  return 0
}
