import { prisma } from './db'
import { computeStandings } from './standings'

// ═══ CONSTANTS ═══

/** Round 1 seeding pairs per bracket: [seed1, seed2] in bracketPosition order (positions 1-8) */
export const BRACKET_SEEDS: Record<string, [number, number][]> = {
  '1-16': [
    [1, 16], [8, 9],    // → R2 pos 1 (W) and pos 5 (L)
    [4, 13], [5, 12],   // → R2 pos 2 (W) and pos 6 (L)
    [2, 15], [7, 10],   // → R2 pos 3 (W) and pos 7 (L)
    [3, 14], [6, 11],   // → R2 pos 4 (W) and pos 8 (L)
  ],
  '17-32': [
    [17, 32], [24, 25],
    [20, 29], [21, 28],
    [18, 31], [23, 26],
    [19, 30], [22, 27],
  ],
  '33-48': [
    [33, 48], [40, 41],
    [36, 45], [37, 44],
    [34, 47], [39, 42],
    [35, 46], [38, 43],
  ],
}

export const BRACKET_NAMES = ['1-16', '17-32', '33-48'] as const

export const BRACKET_HOLES: Record<string, number> = {
  '1-16': 18,
  '17-32': 9,
  '33-48': 9,
}

export const ROUND_NAMES: Record<number, string> = {
  1: '1/8 Finału',
  2: 'Ćwierćfinały / O miejsca 9-16',
  3: 'Półfinały / O miejsca',
  4: 'Finały o miejsca',
}

export const ROUND_DEADLINES: Record<number, string> = {
  1: '06.09.2026',
  2: '25.09.2026',
  3: '11.10.2026',
  4: '31.10.2026',
}

/**
 * Full placement bracket: 32 matches per bracket, 4 rounds × 8 matches.
 * Every player plays exactly 4 matches and finishes with a definitive place.
 *
 * Match position mapping (each round has positions 1-8):
 *
 * ROUND 1 (1/8 finału): positions 1-8 = seeded matches
 *
 * ROUND 2 (8 matches):
 *   pos 1-4: WINNERS from R1 (upper bracket / ćwierćfinały o 1-8)
 *     pos 1: W(R1-1) vs W(R1-2)
 *     pos 2: W(R1-3) vs W(R1-4)
 *     pos 3: W(R1-5) vs W(R1-6)
 *     pos 4: W(R1-7) vs W(R1-8)
 *   pos 5-8: LOSERS from R1 (lower bracket / o miejsca 9-16)
 *     pos 5: L(R1-1) vs L(R1-2)
 *     pos 6: L(R1-3) vs L(R1-4)
 *     pos 7: L(R1-5) vs L(R1-6)
 *     pos 8: L(R1-7) vs L(R1-8)
 *
 * ROUND 3 (8 matches):
 *   pos 1-2: WINNERS of R2 upper (półfinały o 1-4)
 *     pos 1: W(R2-1) vs W(R2-2)
 *     pos 2: W(R2-3) vs W(R2-4)
 *   pos 3-4: LOSERS of R2 upper (o miejsca 5-8)
 *     pos 3: L(R2-1) vs L(R2-2)
 *     pos 4: L(R2-3) vs L(R2-4)
 *   pos 5-6: WINNERS of R2 lower (o miejsca 9-12)
 *     pos 5: W(R2-5) vs W(R2-6)
 *     pos 6: W(R2-7) vs W(R2-8)
 *   pos 7-8: LOSERS of R2 lower (o miejsca 13-16)
 *     pos 7: L(R2-5) vs L(R2-6)
 *     pos 8: L(R2-7) vs L(R2-8)
 *
 * ROUND 4 (8 matches — all placement finals):
 *   pos 1: W(R3-1) vs W(R3-2)  → MIEJSCA 1-2
 *   pos 2: L(R3-1) vs L(R3-2)  → MIEJSCA 3-4
 *   pos 3: W(R3-3) vs W(R3-4)  → MIEJSCA 5-6
 *   pos 4: L(R3-3) vs L(R3-4)  → MIEJSCA 7-8
 *   pos 5: W(R3-5) vs W(R3-6)  → MIEJSCA 9-10
 *   pos 6: L(R3-5) vs L(R3-6)  → MIEJSCA 11-12
 *   pos 7: W(R3-7) vs W(R3-8)  → MIEJSCA 13-14
 *   pos 8: L(R3-7) vs L(R3-8)  → MIEJSCA 15-16
 */

/** Placement label for each R4 position */
export const PLACEMENT_LABELS: Record<number, string> = {
  1: 'Miejsca 1-2',
  2: 'Miejsca 3-4',
  3: 'Miejsca 5-6',
  4: 'Miejsca 7-8',
  5: 'Miejsca 9-10',
  6: 'Miejsca 11-12',
  7: 'Miejsca 13-14',
  8: 'Miejsca 15-16',
}

/**
 * Feed map: for rounds 2-4, defines how each match position is fed from previous round.
 * Format: [prevRound, prevPos, 'W'|'L'] for player1 and player2
 */
interface FeedSource {
  round: number
  position: number
  result: 'W' | 'L'
}

export interface MatchFeed {
  player1: FeedSource
  player2: FeedSource
}

export const MATCH_FEEDS: Record<number, Record<number, MatchFeed>> = {
  // Round 2
  2: {
    // Upper bracket (winners of R1)
    1: { player1: { round: 1, position: 1, result: 'W' }, player2: { round: 1, position: 2, result: 'W' } },
    2: { player1: { round: 1, position: 3, result: 'W' }, player2: { round: 1, position: 4, result: 'W' } },
    3: { player1: { round: 1, position: 5, result: 'W' }, player2: { round: 1, position: 6, result: 'W' } },
    4: { player1: { round: 1, position: 7, result: 'W' }, player2: { round: 1, position: 8, result: 'W' } },
    // Lower bracket (losers of R1)
    5: { player1: { round: 1, position: 1, result: 'L' }, player2: { round: 1, position: 2, result: 'L' } },
    6: { player1: { round: 1, position: 3, result: 'L' }, player2: { round: 1, position: 4, result: 'L' } },
    7: { player1: { round: 1, position: 5, result: 'L' }, player2: { round: 1, position: 6, result: 'L' } },
    8: { player1: { round: 1, position: 7, result: 'L' }, player2: { round: 1, position: 8, result: 'L' } },
  },
  // Round 3
  3: {
    // Upper winners → semifinals for 1-4
    1: { player1: { round: 2, position: 1, result: 'W' }, player2: { round: 2, position: 2, result: 'W' } },
    2: { player1: { round: 2, position: 3, result: 'W' }, player2: { round: 2, position: 4, result: 'W' } },
    // Upper losers → for 5-8
    3: { player1: { round: 2, position: 1, result: 'L' }, player2: { round: 2, position: 2, result: 'L' } },
    4: { player1: { round: 2, position: 3, result: 'L' }, player2: { round: 2, position: 4, result: 'L' } },
    // Lower winners → for 9-12
    5: { player1: { round: 2, position: 5, result: 'W' }, player2: { round: 2, position: 6, result: 'W' } },
    6: { player1: { round: 2, position: 7, result: 'W' }, player2: { round: 2, position: 8, result: 'W' } },
    // Lower losers → for 13-16
    7: { player1: { round: 2, position: 5, result: 'L' }, player2: { round: 2, position: 6, result: 'L' } },
    8: { player1: { round: 2, position: 7, result: 'L' }, player2: { round: 2, position: 8, result: 'L' } },
  },
  // Round 4 (placement finals)
  4: {
    1: { player1: { round: 3, position: 1, result: 'W' }, player2: { round: 3, position: 2, result: 'W' } }, // 1-2
    2: { player1: { round: 3, position: 1, result: 'L' }, player2: { round: 3, position: 2, result: 'L' } }, // 3-4
    3: { player1: { round: 3, position: 3, result: 'W' }, player2: { round: 3, position: 4, result: 'W' } }, // 5-6
    4: { player1: { round: 3, position: 3, result: 'L' }, player2: { round: 3, position: 4, result: 'L' } }, // 7-8
    5: { player1: { round: 3, position: 5, result: 'W' }, player2: { round: 3, position: 6, result: 'W' } }, // 9-10
    6: { player1: { round: 3, position: 5, result: 'L' }, player2: { round: 3, position: 6, result: 'L' } }, // 11-12
    7: { player1: { round: 3, position: 7, result: 'W' }, player2: { round: 3, position: 8, result: 'W' } }, // 13-14
    8: { player1: { round: 3, position: 7, result: 'L' }, player2: { round: 3, position: 8, result: 'L' } }, // 15-16
  },
}

// ═══ BRACKET SLOT INTERFACE ═══

export interface BracketSlot {
  bracketRound: number
  bracketPosition: number
  matchId: number | null
  player1Id: number | null
  player2Id: number | null
  player1Name: string | null
  player2Name: string | null
  player1Slug: string | null
  player2Slug: string | null
  player1Seed: number | null
  player2Seed: number | null
  winnerId: number | null
  loserId: number | null
  resultCode: string | null
  played: boolean
  isWalkover: boolean
  holes: number | null
  deadline: string
  placementLabel: string | null // e.g. "Miejsca 1-2" for R4 matches
  player1Birdies: number
  player2Birdies: number
}

// ═══ GLOBAL RANKING ═══

export interface RankedPlayer {
  rank: number
  playerId: number
  firstName: string
  lastName: string
  slug: string
  bigPoints: number
  smallPoints: number
  hcpAtStart: number | null
  groupName: string
  positionInGroup: number
}

/**
 * Compute global ranking from the last completed ROUND_ROBIN round.
 * Sort: position in group → BP desc → SP desc → HCP desc (higher HCP = higher rank).
 */
export async function computeGlobalRanking(seasonId: number): Promise<RankedPlayer[]> {
  const lastRound = await prisma.round.findFirst({
    where: {
      seasonId,
      type: 'ROUND_ROBIN',
      status: { in: ['COMPLETED', 'ACTIVE'] },
    },
    orderBy: { roundNumber: 'desc' },
    include: {
      groups: {
        orderBy: { sortOrder: 'asc' },
        include: {
          players: { include: { player: true } },
          matches: { include: { player1: true, player2: true } },
        },
      },
    },
  })

  if (!lastRound) return []

  const allPlayers: RankedPlayer[] = []

  for (const group of lastRound.groups) {
    const standings = computeStandings(group.players, group.matches)
    for (const s of standings) {
      allPlayers.push({
        rank: 0,
        playerId: s.playerId,
        firstName: s.firstName,
        lastName: s.lastName,
        slug: s.slug,
        bigPoints: s.bigPoints,
        smallPoints: s.smallPoints,
        hcpAtStart: s.hcpAtStart,
        groupName: group.name,
        positionInGroup: s.position,
      })
    }
  }

  allPlayers.sort((a, b) => {
    if (a.positionInGroup !== b.positionInGroup) return a.positionInGroup - b.positionInGroup
    if (b.bigPoints !== a.bigPoints) return b.bigPoints - a.bigPoints
    if (b.smallPoints !== a.smallPoints) return b.smallPoints - a.smallPoints
    const aHcp = a.hcpAtStart ?? 0
    const bHcp = b.hcpAtStart ?? 0
    return bHcp - aHcp
  })

  allPlayers.forEach((p, i) => { p.rank = i + 1 })

  return allPlayers
}

// ═══ BUILD BRACKET VIEW ═══

/**
 * Build the full 32-slot bracket array for a playoff group.
 * 4 rounds × 8 positions = 32 matches total.
 */
export async function buildBracketSlots(groupId: number): Promise<BracketSlot[]> {
  const matches = await prisma.match.findMany({
    where: {
      groupId,
      bracketRound: { not: null },
    },
    include: { player1: true, player2: true },
    orderBy: [{ bracketRound: 'asc' }, { bracketPosition: 'asc' }],
  })

  const groupPlayers = await prisma.groupPlayer.findMany({
    where: { groupId },
    include: { player: true },
  })

  // Build match lookup: "round-position" → match
  const matchMap = new Map<string, typeof matches[0]>()
  for (const m of matches) {
    if (m.bracketRound && m.bracketPosition) {
      matchMap.set(`${m.bracketRound}-${m.bracketPosition}`, m)
    }
  }

  // Helper: resolve player from a feeder match
  function resolveFeeder(feed: FeedSource): { playerId: number | null; name: string | null; slug: string | null } {
    const feederMatch = matchMap.get(`${feed.round}-${feed.position}`)
    if (!feederMatch || !feederMatch.played || !feederMatch.winnerId) {
      return { playerId: null, name: null, slug: null }
    }
    const isWinner = feed.result === 'W'
    const resolvedId = isWinner ? feederMatch.winnerId : getLoser(feederMatch)
    if (!resolvedId) return { playerId: null, name: null, slug: null }

    const player = resolvedId === feederMatch.player1Id ? feederMatch.player1 : feederMatch.player2
    return {
      playerId: resolvedId,
      name: `${player.firstName} ${player.lastName}`,
      slug: player.slug,
    }
  }

  const slots: BracketSlot[] = []

  for (let round = 1; round <= 4; round++) {
    for (let pos = 1; pos <= 8; pos++) {
      const match = matchMap.get(`${round}-${pos}`)

      if (match) {
        // Determine loser
        const loserId = match.played && match.winnerId
          ? (match.winnerId === match.player1Id ? match.player2Id : match.player1Id)
          : null

        slots.push({
          bracketRound: round,
          bracketPosition: pos,
          matchId: match.id,
          player1Id: match.player1Id,
          player2Id: match.player2Id,
          player1Name: `${match.player1.firstName} ${match.player1.lastName}`,
          player2Name: `${match.player2.firstName} ${match.player2.lastName}`,
          player1Slug: match.player1.slug,
          player2Slug: match.player2.slug,
          player1Seed: null,
          player2Seed: null,
          winnerId: match.winnerId,
          loserId,
          resultCode: match.resultCode,
          played: match.played,
          isWalkover: match.isWalkover,
          holes: match.holes,
          deadline: ROUND_DEADLINES[round] ?? '',
          placementLabel: round === 4 ? (PLACEMENT_LABELS[pos] ?? null) : null,
          player1Birdies: match.player1Birdies,
          player2Birdies: match.player2Birdies,
        })
      } else {
        // Placeholder — try to resolve from feeder matches
        const feeds = MATCH_FEEDS[round]?.[pos]
        let p1 = { playerId: null as number | null, name: null as string | null, slug: null as string | null }
        let p2 = { playerId: null as number | null, name: null as string | null, slug: null as string | null }

        if (feeds) {
          p1 = resolveFeeder(feeds.player1)
          p2 = resolveFeeder(feeds.player2)
        }

        slots.push({
          bracketRound: round,
          bracketPosition: pos,
          matchId: null,
          player1Id: p1.playerId,
          player2Id: p2.playerId,
          player1Name: p1.name,
          player2Name: p2.name,
          player1Slug: p1.slug,
          player2Slug: p2.slug,
          player1Seed: null,
          player2Seed: null,
          winnerId: null,
          loserId: null,
          resultCode: null,
          played: false,
          isWalkover: false,
          holes: null,
          deadline: ROUND_DEADLINES[round] ?? '',
          placementLabel: round === 4 ? (PLACEMENT_LABELS[pos] ?? null) : null,
          player1Birdies: 0,
          player2Birdies: 0,
        })
      }
    }
  }

  // Resolve seeds for round 1
  for (const slot of slots) {
    if (slot.bracketRound === 1 && slot.player1Id) {
      const gp1 = groupPlayers.find(gp => gp.playerId === slot.player1Id)
      const gp2 = groupPlayers.find(gp => gp.playerId === slot.player2Id)
      slot.player1Seed = gp1?.finalPosition ?? null
      slot.player2Seed = gp2?.finalPosition ?? null
    }
  }

  return slots
}

// ═══ HELPERS ═══

function getLoser(match: { player1Id: number; player2Id: number; winnerId: number | null }): number | null {
  if (!match.winnerId) return null
  return match.winnerId === match.player1Id ? match.player2Id : match.player1Id
}

// ═══ AUTO-ADVANCE ═══

/**
 * After a playoff match result is saved, check if any next-round matches
 * should be created based on the MATCH_FEEDS map.
 *
 * A match in round N feeds into potentially TWO matches in round N+1:
 * - One for the winner (W)
 * - One for the loser (L)
 */
export async function autoAdvancePlayoff(matchId: number): Promise<void> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      group: { include: { round: true } },
    },
  })

  if (!match || !match.bracketRound || !match.bracketPosition || !match.winnerId) return
  if (match.group.round.type !== 'PLAYOFF') return
  if (match.bracketRound >= 4) return // R4 = final placement matches, no further advancement

  const currentRound = match.bracketRound
  const currentPos = match.bracketPosition
  const nextRound = currentRound + 1
  const winnerId = match.winnerId
  const loserId = winnerId === match.player1Id ? match.player2Id : match.player1Id

  // Find all R(N+1) matches that feed from this match (both W and L paths)
  const nextRoundFeeds = MATCH_FEEDS[nextRound]
  if (!nextRoundFeeds) return

  for (const [posStr, feed] of Object.entries(nextRoundFeeds)) {
    const nextPos = parseInt(posStr)

    // Check if this feed references our match
    const p1FromUs = feed.player1.round === currentRound && feed.player1.position === currentPos
    const p2FromUs = feed.player2.round === currentRound && feed.player2.position === currentPos

    if (!p1FromUs && !p2FromUs) continue

    // Resolve both players for this next-round match
    const p1Feed = feed.player1
    const p2Feed = feed.player2

    const p1Id = resolvePlayerFromFeed(p1Feed, currentRound, currentPos, winnerId, loserId, match.groupId)
    const p2Id = resolvePlayerFromFeed(p2Feed, currentRound, currentPos, winnerId, loserId, match.groupId)

    // Both players must be resolved to create the match
    const resolvedP1 = await p1Id
    const resolvedP2 = await p2Id

    if (!resolvedP1 || !resolvedP2) continue

    // Check if match already exists
    const existing = await prisma.match.findFirst({
      where: {
        groupId: match.groupId,
        bracketRound: nextRound,
        bracketPosition: nextPos,
      },
    })

    if (existing) continue

    await prisma.match.create({
      data: {
        groupId: match.groupId,
        player1Id: resolvedP1,
        player2Id: resolvedP2,
        bracketRound: nextRound,
        bracketPosition: nextPos,
      },
    })
  }
}

async function resolvePlayerFromFeed(
  feed: FeedSource,
  triggerRound: number,
  triggerPos: number,
  triggerWinnerId: number,
  triggerLoserId: number,
  groupId: number
): Promise<number | null> {
  // If this feed is from the triggering match, resolve directly
  if (feed.round === triggerRound && feed.position === triggerPos) {
    return feed.result === 'W' ? triggerWinnerId : triggerLoserId
  }

  // Otherwise look up the match from DB
  const feederMatch = await prisma.match.findFirst({
    where: {
      groupId,
      bracketRound: feed.round,
      bracketPosition: feed.position,
      played: true,
    },
  })

  if (!feederMatch || !feederMatch.winnerId) return null

  if (feed.result === 'W') return feederMatch.winnerId
  return feederMatch.winnerId === feederMatch.player1Id ? feederMatch.player2Id : feederMatch.player1Id
}

// ═══ CASCADE DELETE ═══

/**
 * When a playoff match result is cleared, delete any downstream matches
 * that were created from this match's winner OR loser.
 */
export async function cascadeDeleteDownstream(matchId: number): Promise<void> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
  })

  if (!match || !match.bracketRound || !match.bracketPosition) return
  if (match.bracketRound >= 4) return

  const currentRound = match.bracketRound
  const currentPos = match.bracketPosition
  const nextRound = currentRound + 1

  const nextRoundFeeds = MATCH_FEEDS[nextRound]
  if (!nextRoundFeeds) return

  // Find all downstream matches that reference this match
  for (const [posStr, feed] of Object.entries(nextRoundFeeds)) {
    const nextPos = parseInt(posStr)
    const p1FromUs = feed.player1.round === currentRound && feed.player1.position === currentPos
    const p2FromUs = feed.player2.round === currentRound && feed.player2.position === currentPos

    if (!p1FromUs && !p2FromUs) continue

    const downstream = await prisma.match.findFirst({
      where: {
        groupId: match.groupId,
        bracketRound: nextRound,
        bracketPosition: nextPos,
      },
    })

    if (downstream) {
      // Recursively delete further downstream first
      await cascadeDeleteDownstream(downstream.id)
      await prisma.match.delete({ where: { id: downstream.id } })
    }
  }
}
