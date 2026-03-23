import { prisma } from './db'
import { computeStandings } from './standings'

// ═══ CONSTANTS ═══

/** Seeding pairs per bracket: [seed1, seed2] in bracketPosition order */
export const BRACKET_SEEDS: Record<string, [number, number][]> = {
  '1-16': [
    [1, 16], [8, 9],    // → QF1
    [4, 13], [5, 12],   // → QF2
    [2, 15], [7, 10],   // → QF3
    [3, 14], [6, 11],   // → QF4
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
  2: 'Ćwierćfinał',
  3: 'Półfinał',
  4: 'Finał',
}

export const ROUND_DEADLINES: Record<number, string> = {
  1: '06.09.2026',
  2: '25.09.2026',
  3: '11.10.2026',
  4: '31.10.2026',
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
  resultCode: string | null
  played: boolean
  isWalkover: boolean
  holes: number | null
  deadline: string
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
 * No head-to-head across groups.
 */
export async function computeGlobalRanking(seasonId: number): Promise<RankedPlayer[]> {
  // Find the latest completed or active ROUND_ROBIN round
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

  // Compute standings per group
  const allPlayers: RankedPlayer[] = []

  for (const group of lastRound.groups) {
    const standings = computeStandings(group.players, group.matches)
    for (const s of standings) {
      allPlayers.push({
        rank: 0, // will be assigned below
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

  // Sort: position in group ASC → BP DESC → SP DESC → HCP DESC
  allPlayers.sort((a, b) => {
    if (a.positionInGroup !== b.positionInGroup) return a.positionInGroup - b.positionInGroup
    if (b.bigPoints !== a.bigPoints) return b.bigPoints - a.bigPoints
    if (b.smallPoints !== a.smallPoints) return b.smallPoints - a.smallPoints
    const aHcp = a.hcpAtStart ?? 0
    const bHcp = b.hcpAtStart ?? 0
    return bHcp - aHcp
  })

  // Assign ranks
  allPlayers.forEach((p, i) => { p.rank = i + 1 })

  return allPlayers
}

// ═══ BUILD BRACKET VIEW ═══

/**
 * Build the full 15-slot bracket array for a playoff group.
 * Merges real Match records with computed placeholder slots.
 */
export async function buildBracketSlots(groupId: number): Promise<BracketSlot[]> {
  // Fetch all playoff matches for this group
  const matches = await prisma.match.findMany({
    where: {
      groupId,
      bracketRound: { not: null },
    },
    include: { player1: true, player2: true },
    orderBy: [{ bracketRound: 'asc' }, { bracketPosition: 'asc' }],
  })

  // Fetch group players for seed mapping
  const groupPlayers = await prisma.groupPlayer.findMany({
    where: { groupId },
    include: { player: true },
  })

  // Build seed map: finalPosition → player
  const seedMap = new Map<number, typeof groupPlayers[0]>()
  for (const gp of groupPlayers) {
    if (gp.finalPosition) seedMap.set(gp.finalPosition, gp)
  }

  // Build match lookup: "round-position" → match
  const matchMap = new Map<string, typeof matches[0]>()
  for (const m of matches) {
    if (m.bracketRound && m.bracketPosition) {
      matchMap.set(`${m.bracketRound}-${m.bracketPosition}`, m)
    }
  }

  const slots: BracketSlot[] = []
  const roundSizes = [8, 4, 2, 1] // matches per round

  for (let round = 1; round <= 4; round++) {
    for (let pos = 1; pos <= roundSizes[round - 1]; pos++) {
      const match = matchMap.get(`${round}-${pos}`)

      if (match) {
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
          player1Seed: null, // resolved below for round 1
          player2Seed: null,
          winnerId: match.winnerId,
          resultCode: match.resultCode,
          played: match.played,
          isWalkover: match.isWalkover,
          holes: match.holes,
          deadline: ROUND_DEADLINES[round] ?? '',
        })
      } else {
        // Placeholder — match not yet created
        // Try to resolve player names from feeder matches
        const feeder1Pos = pos * 2 - 1
        const feeder2Pos = pos * 2
        const feeder1 = matchMap.get(`${round - 1}-${feeder1Pos}`)
        const feeder2 = matchMap.get(`${round - 1}-${feeder2Pos}`)

        slots.push({
          bracketRound: round,
          bracketPosition: pos,
          matchId: null,
          player1Id: feeder1?.winnerId ?? null,
          player2Id: feeder2?.winnerId ?? null,
          player1Name: feeder1?.winnerId
            ? feeder1.winnerId === feeder1.player1Id
              ? `${feeder1.player1.firstName} ${feeder1.player1.lastName}`
              : `${feeder1.player2.firstName} ${feeder1.player2.lastName}`
            : null,
          player2Name: feeder2?.winnerId
            ? feeder2.winnerId === feeder2.player1Id
              ? `${feeder2.player1.firstName} ${feeder2.player1.lastName}`
              : `${feeder2.player2.firstName} ${feeder2.player2.lastName}`
            : null,
          player1Slug: null,
          player2Slug: null,
          player1Seed: null,
          player2Seed: null,
          winnerId: null,
          resultCode: null,
          played: false,
          isWalkover: false,
          holes: null,
          deadline: ROUND_DEADLINES[round] ?? '',
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

// ═══ AUTO-ADVANCE ═══

/**
 * After a playoff match result is saved, check if the next-round match should be created.
 * Called by the result API route.
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
  if (match.bracketRound >= 4) return // Final — no next round

  const nextRound = match.bracketRound + 1
  const nextPosition = Math.ceil(match.bracketPosition / 2)
  const isTopSlot = match.bracketPosition % 2 === 1 // odd = top (player1), even = bottom (player2)

  // Find the sibling match
  const siblingPosition = isTopSlot ? match.bracketPosition + 1 : match.bracketPosition - 1
  const siblingMatch = await prisma.match.findFirst({
    where: {
      groupId: match.groupId,
      bracketRound: match.bracketRound,
      bracketPosition: siblingPosition,
      played: true,
    },
  })

  if (!siblingMatch || !siblingMatch.winnerId) return // Sibling not played yet

  // Both feeders decided — create next-round match
  const topWinnerId = isTopSlot ? match.winnerId : siblingMatch.winnerId
  const bottomWinnerId = isTopSlot ? siblingMatch.winnerId : match.winnerId

  // Check if next match already exists
  const existing = await prisma.match.findFirst({
    where: {
      groupId: match.groupId,
      bracketRound: nextRound,
      bracketPosition: nextPosition,
    },
  })

  if (existing) return // Already created (idempotent)

  await prisma.match.create({
    data: {
      groupId: match.groupId,
      player1Id: topWinnerId,
      player2Id: bottomWinnerId,
      bracketRound: nextRound,
      bracketPosition: nextPosition,
    },
  })
}

// ═══ CASCADE DELETE ═══

/**
 * When a playoff match result is cleared, delete any downstream matches
 * that were created from this match's winner.
 */
export async function cascadeDeleteDownstream(matchId: number): Promise<void> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
  })

  if (!match || !match.bracketRound || !match.bracketPosition) return
  if (match.bracketRound >= 4) return

  const nextRound = match.bracketRound + 1
  const nextPosition = Math.ceil(match.bracketPosition / 2)

  const downstream = await prisma.match.findFirst({
    where: {
      groupId: match.groupId,
      bracketRound: nextRound,
      bracketPosition: nextPosition,
    },
  })

  if (downstream) {
    // Recursively delete further downstream first
    await cascadeDeleteDownstream(downstream.id)
    // Then delete this downstream match
    await prisma.match.delete({ where: { id: downstream.id } })
  }
}
