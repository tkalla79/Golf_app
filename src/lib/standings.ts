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

/**
 * Tie-breaker rules — KEEP IN SYNC z `src/app/(public)/regulamin/page.tsx` (sekcja IV.4).
 *
 * Algorytm ustalania kolejności w grupach (identyczna liczba dużych punktów):
 *
 * ── I. Dla 2 graczy ───────────────────────────────────────────────────
 *   1) Wynik bezpośredniego meczu (H2H)
 *   2) (w razie remisu) Małe punkty — suma marginesów
 *   3) (w razie remisu) Aktywny HCP — wyższy zajmuje wyższe miejsce
 *   4) (w razie remisu) Losowanie Zarządu Ligi
 *
 * ── II. Dla 3+ graczy ────────────────────────────────────────────────
 *   1) "Mała tabelka" — duże punkty TYLKO z meczów między remisującymi
 *      • Po małej tabelce gdy 2 graczy nadal tied → wraca do sekwencji I (H2H → m.pkt → HCP → los)
 *      • Po małej tabelce gdy 3+ graczy nadal tied:
 *           - Małe punkty
 *           - (w razie remisu 2 graczy po m.pkt) H2H → HCP → losowanie
 *           - (w razie remisu 3+ po m.pkt) HCP → losowanie
 *
 * Implementacja: rekurencyjne grupowanie zamiast pojedynczego Array.sort()
 * (różne reguły dla par vs grup wymagają etapowego rozstrzygania).
 *
 * Regresja: testy w `src/__tests__/standings.test.ts` weryfikują każdy z poziomów.
 */
export function computeStandings(
  groupPlayers: GroupPlayerWithPlayer[],
  matches: MatchWithPlayers[],
  /**
   * Optional map of playerId → season-cumulative birdie count.
   * When provided, the `birdies` field in the result reflects season totals
   * (R1 + R2 + ...) instead of just current round. Used in rounds 2+ so the
   * birdie column shows player's full-season tally.
   */
  seasonBirdies?: Map<number, number>,
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
    // Birdies: only accumulate per-round if seasonBirdies map is NOT provided.
    // Otherwise we overwrite below with season-cumulative totals.
    if (!seasonBirdies) {
      p1.birdies += match.player1Birdies
      p2.birdies += match.player2Birdies
    }

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

  // Overwrite birdies with season-cumulative totals when provided (Sekcja 2 / round 2+)
  if (seasonBirdies) {
    for (const standing of standings.values()) {
      standing.birdies = seasonBirdies.get(standing.playerId) ?? 0
    }
  }

  const players = Array.from(standings.values())

  // ─── Hierarchical ranking — see header comment for algorithm ────────
  const ranked = rankByBigPoints(players, matches)

  ranked.forEach((s, i) => {
    s.position = s.finalPosition ?? i + 1
  })

  // Re-sort by final position if any are set manually (finalPosition override)
  ranked.sort((a, b) => a.position - b.position)

  return ranked
}

// ─── Ranking helpers (hierarchical) ──────────────────────────────────

/**
 * Top-level: group by big points DESC, then resolve each tied group via
 * Path I (2 players) or Path II (3+ players).
 */
function rankByBigPoints(
  players: PlayerStanding[],
  matches: MatchWithPlayers[],
): PlayerStanding[] {
  const byBig = bucketBy(players, (p) => p.bigPoints)
  const keys = [...byBig.keys()].sort((a, b) => b - a)
  const result: PlayerStanding[] = []
  for (const k of keys) {
    const group = byBig.get(k)!
    if (group.length === 1) result.push(group[0])
    else if (group.length === 2) result.push(...resolvePair(group[0], group[1], matches))
    else result.push(...resolveMultiTied(group, matches))
  }
  return result
}

/**
 * Path I — 2 graczy: H2H → m.pkt → HCP → losowanie (zachowanie stabilne).
 */
function resolvePair(
  a: PlayerStanding,
  b: PlayerStanding,
  matches: MatchWithPlayers[],
): [PlayerStanding, PlayerStanding] {
  // 1) H2H
  const h2h = getHeadToHead(a.playerId, b.playerId, matches)
  if (h2h < 0) return [a, b]
  if (h2h > 0) return [b, a]
  // 2) Małe punkty DESC
  if (a.smallPoints !== b.smallPoints) {
    return a.smallPoints > b.smallPoints ? [a, b] : [b, a]
  }
  // 3) HCP DESC
  const aHcp = a.hcpAtStart ?? 0
  const bHcp = b.hcpAtStart ?? 0
  if (aHcp !== bHcp) return aHcp > bHcp ? [a, b] : [b, a]
  // 4) Losowanie — zachowaj kolejność wejściową
  return [a, b]
}

/**
 * Path II — 3+ graczy: mała tabelka → ...
 *
 * Po małej tabelce:
 *   - 1 player: gotowe
 *   - 2 players: powrót do Path I (H2H → m.pkt → HCP → losowanie)
 *   - 3+ players: idziemy na m.pkt → (2 tied) H2H → HCP → losowanie / (3+ tied) HCP → losowanie
 */
function resolveMultiTied(
  group: PlayerStanding[],
  matches: MatchWithPlayers[],
): PlayerStanding[] {
  const tiedIds = new Set(group.map((p) => p.playerId))
  const miniPts = computeMiniTable(tiedIds, matches)

  const byMini = bucketBy(group, (p) => miniPts.get(p.playerId) ?? 0)
  const keys = [...byMini.keys()].sort((a, b) => b - a)

  const result: PlayerStanding[] = []
  for (const k of keys) {
    const sub = byMini.get(k)!
    if (sub.length === 1) result.push(sub[0])
    else if (sub.length === 2) result.push(...resolvePair(sub[0], sub[1], matches))
    else result.push(...resolveMultiTiedAfterMini(sub, matches))
  }
  return result
}

/**
 * 3+ graczy z identycznym wynikiem w małej tabelce → m.pkt rozstrzygają.
 * Następnie: 2 tied po m.pkt → H2H → HCP → losowanie.
 *            3+ tied po m.pkt → HCP → losowanie.
 */
function resolveMultiTiedAfterMini(
  group: PlayerStanding[],
  matches: MatchWithPlayers[],
): PlayerStanding[] {
  const bySmall = bucketBy(group, (p) => p.smallPoints)
  const keys = [...bySmall.keys()].sort((a, b) => b - a)

  const result: PlayerStanding[] = []
  for (const k of keys) {
    const sub = bySmall.get(k)!
    if (sub.length === 1) {
      result.push(sub[0])
    } else if (sub.length === 2) {
      result.push(...resolvePairByH2HThenHcp(sub[0], sub[1], matches))
    } else {
      // 3+ tied po m.pkt: HCP → losowanie
      result.push(...[...sub].sort((a, b) => (b.hcpAtStart ?? 0) - (a.hcpAtStart ?? 0)))
    }
  }
  return result
}

/**
 * Para tied po m.pkt: H2H → HCP DESC → losowanie (stabilna kolejność wejścia).
 * Używane gdy m.pkt już zostały sprawdzone — kontrast z `resolvePair`
 * które startuje od H2H i ma m.pkt jako krok 2.
 */
function resolvePairByH2HThenHcp(
  a: PlayerStanding,
  b: PlayerStanding,
  matches: MatchWithPlayers[],
): [PlayerStanding, PlayerStanding] {
  const h2h = getHeadToHead(a.playerId, b.playerId, matches)
  if (h2h < 0) return [a, b]
  if (h2h > 0) return [b, a]
  const aHcp = a.hcpAtStart ?? 0
  const bHcp = b.hcpAtStart ?? 0
  return aHcp >= bHcp ? [a, b] : [b, a]
}

/** Bucket players by a key function (used for stable grouping). */
function bucketBy<T, K>(arr: T[], keyFn: (item: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>()
  for (const item of arr) {
    const k = keyFn(item)
    const bucket = m.get(k) ?? []
    bucket.push(item)
    m.set(k, bucket)
  }
  return m
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
