import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import {
  computePoints,
  DEFAULT_SEASON_CONFIG,
  RESULT_CODES,
  RESULT_CODES_18,
  type SeasonConfig,
  type MatchResultInput,
} from '@/lib/scoring'
import {
  generateNextRoundGroups,
  generateRoundRobinPairings,
} from '@/lib/group-generator'
import {
  computeGlobalRanking,
  BRACKET_SEEDS,
  BRACKET_NAMES,
  BRACKET_HOLES,
  autoAdvancePlayoff,
} from '@/lib/playoff'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomResult(
  player1Id: number,
  player2Id: number,
  config: SeasonConfig,
  resultCodes: readonly string[] = RESULT_CODES,
) {
  const isDraw = Math.random() < 0.15
  const resultCode = isDraw ? 'Tied' : pick(resultCodes.filter((c) => c !== 'Tied'))
  const winnerId = isDraw ? null : (Math.random() < 0.5 ? player1Id : player2Id)

  const input: MatchResultInput = { winnerId, resultCode, isWalkover: false }
  const pts = computePoints(input, player1Id, player2Id, config)

  return { winnerId, resultCode, ...pts }
}

async function simulateMatches(
  matches: { id: number; player1Id: number; player2Id: number }[],
  config: SeasonConfig,
  resultCodes: readonly string[] = RESULT_CODES,
): Promise<number> {
  let count = 0
  for (const m of matches) {
    const res = randomResult(m.player1Id, m.player2Id, config, resultCodes)
    await prisma.match.update({
      where: { id: m.id },
      data: {
        played: true,
        winnerId: res.winnerId,
        resultCode: res.resultCode,
        player1BigPoints: res.player1BigPoints,
        player2BigPoints: res.player2BigPoints,
        player1SmallPoints: res.player1SmallPoints,
        player2SmallPoints: res.player2SmallPoints,
      },
    })
    count++
  }
  return count
}

// ---------------------------------------------------------------------------
// Simulate current round
// ---------------------------------------------------------------------------

async function simulateCurrentRound(seasonId: number, config: SeasonConfig) {
  const round = await prisma.round.findFirst({
    where: { seasonId, type: 'ROUND_ROBIN', status: 'ACTIVE' },
    orderBy: { roundNumber: 'asc' },
  })
  if (!round) throw new Error('Brak aktywnej rundy do zasymulowania')

  const matches = await prisma.match.findMany({
    where: { group: { roundId: round.id }, played: false },
    select: { id: true, player1Id: true, player2Id: true },
  })

  const count = await simulateMatches(matches, config)

  await prisma.round.update({ where: { id: round.id }, data: { status: 'COMPLETED' } })

  return { matchesSimulated: count, roundsCreated: 0, playoffCreated: false }
}

// ---------------------------------------------------------------------------
// Generate and simulate next rounds until all RR done, then create playoff
// ---------------------------------------------------------------------------

async function simulateToPlayoff(seasonId: number, config: SeasonConfig) {
  let totalMatches = 0
  let roundsCreated = 0

  // First simulate any active round
  const activeRound = await prisma.round.findFirst({
    where: { seasonId, type: 'ROUND_ROBIN', status: 'ACTIVE' },
    orderBy: { roundNumber: 'asc' },
  })

  if (activeRound) {
    const matches = await prisma.match.findMany({
      where: { group: { roundId: activeRound.id }, played: false },
      select: { id: true, player1Id: true, player2Id: true },
    })
    totalMatches += await simulateMatches(matches, config)
    await prisma.round.update({ where: { id: activeRound.id }, data: { status: 'COMPLETED' } })
  }

  // Generate rounds 2-4 (or whatever remains)
  const existingRounds = await prisma.round.findMany({
    where: { seasonId, type: 'ROUND_ROBIN' },
    orderBy: { roundNumber: 'asc' },
  })
  const maxExistingRoundNumber = existingRounds.length > 0
    ? Math.max(...existingRounds.map((r) => r.roundNumber))
    : 1

  for (let rn = maxExistingRoundNumber + 1; rn <= 4; rn++) {
    const prevRound = await prisma.round.findFirst({
      where: { seasonId, type: 'ROUND_ROBIN', status: 'COMPLETED' },
      orderBy: { roundNumber: 'desc' },
    })
    if (!prevRound) break

    const newGroupDefs = await generateNextRoundGroups(prevRound.id)

    const round = await prisma.round.create({
      data: {
        seasonId,
        name: `Runda ${rn}`,
        roundNumber: rn,
        type: 'ROUND_ROBIN',
        status: 'ACTIVE',
        holes: 9,
      },
    })
    roundsCreated++

    for (let gi = 0; gi < newGroupDefs.length; gi++) {
      const gDef = newGroupDefs[gi]
      const group = await prisma.group.create({
        data: {
          roundId: round.id,
          name: gDef.name,
          sortOrder: gi,
          status: 'ACTIVE',
        },
      })

      for (const p of gDef.players) {
        await prisma.groupPlayer.create({
          data: {
            groupId: group.id,
            playerId: p.playerId,
            hcpAtStart: p.hcp,
          },
        })
      }

      const pids = gDef.players.map((p) => p.playerId)
      const pairings = generateRoundRobinPairings(pids)
      for (const [p1, p2] of pairings) {
        await prisma.match.create({
          data: { groupId: group.id, player1Id: p1, player2Id: p2 },
        })
      }
    }

    const matches = await prisma.match.findMany({
      where: { group: { roundId: round.id }, played: false },
      select: { id: true, player1Id: true, player2Id: true },
    })
    totalMatches += await simulateMatches(matches, config)

    await prisma.round.update({ where: { id: round.id }, data: { status: 'COMPLETED' } })
  }

  // Create playoff
  const playoffCreated = await createPlayoff(seasonId)

  return { matchesSimulated: totalMatches, roundsCreated, playoffCreated }
}

// ---------------------------------------------------------------------------
// Create playoff brackets
// ---------------------------------------------------------------------------

async function createPlayoff(seasonId: number): Promise<boolean> {
  const existing = await prisma.round.findFirst({
    where: { seasonId, type: 'PLAYOFF' },
  })
  if (existing) return false

  const ranking = await computeGlobalRanking(seasonId)
  if (ranking.length < 16) return false

  const round = await prisma.round.create({
    data: {
      seasonId,
      name: 'Play-off',
      roundNumber: 99,
      type: 'PLAYOFF',
      status: 'ACTIVE',
      config: { bracketHoles: BRACKET_HOLES },
    },
  })

  for (let bi = 0; bi < BRACKET_NAMES.length; bi++) {
    const bracketName = BRACKET_NAMES[bi]
    const seeds = BRACKET_SEEDS[bracketName]
    const bracketPlayers = ranking.slice(bi * 16, (bi + 1) * 16)

    const group = await prisma.group.create({
      data: {
        roundId: round.id,
        name: `Drabinka ${bracketName}`,
        sortOrder: bi,
        status: 'ACTIVE',
      },
    })

    for (const player of bracketPlayers) {
      await prisma.groupPlayer.create({
        data: {
          groupId: group.id,
          playerId: player.playerId,
          hcpAtStart: player.hcpAtStart !== null ? player.hcpAtStart : null,
          finalPosition: player.rank,
        },
      })
    }

    for (let i = 0; i < seeds.length; i++) {
      const [seed1, seed2] = seeds[i]
      const p1 = ranking.find((p) => p.rank === seed1)
      const p2 = ranking.find((p) => p.rank === seed2)

      if (p1 && p2) {
        await prisma.match.create({
          data: {
            groupId: group.id,
            player1Id: p1.playerId,
            player2Id: p2.playerId,
            bracketRound: 1,
            bracketPosition: i + 1,
          },
        })
      } else if (p1 && !p2) {
        const byeMatch = await prisma.match.create({
          data: {
            groupId: group.id,
            player1Id: p1.playerId,
            player2Id: p1.playerId,
            bracketRound: 1,
            bracketPosition: i + 1,
            played: true,
            winnerId: p1.playerId,
            resultCode: 'BYE',
          },
        })
        await autoAdvancePlayoff(byeMatch.id)
      }
    }

    const byeMatches = await prisma.match.findMany({
      where: { groupId: group.id, resultCode: 'BYE', bracketRound: 1 },
    })
    for (const byeMatch of byeMatches) {
      await autoAdvancePlayoff(byeMatch.id)
    }
  }

  return true
}

// ---------------------------------------------------------------------------
// Simulate full season (including playoff)
// ---------------------------------------------------------------------------

async function simulateFullSeason(seasonId: number, config: SeasonConfig) {
  const toPlayoffResult = await simulateToPlayoff(seasonId, config)

  // Now simulate all playoff matches
  const playoffRound = await prisma.round.findFirst({
    where: { seasonId, type: 'PLAYOFF' },
  })

  let playoffMatches = 0

  if (playoffRound) {
    const groups = await prisma.group.findMany({
      where: { roundId: playoffRound.id },
      orderBy: { sortOrder: 'asc' },
    })

    for (const group of groups) {
      const bracketName = group.name.replace('Drabinka ', '')
      const holes = BRACKET_HOLES[bracketName] ?? 9
      const codes = holes === 18 ? RESULT_CODES_18 : RESULT_CODES

      for (let br = 1; br <= 4; br++) {
        const unplayed = await prisma.match.findMany({
          where: {
            groupId: group.id,
            bracketRound: br,
            played: false,
          },
          select: { id: true, player1Id: true, player2Id: true },
        })

        for (const m of unplayed) {
          const res = randomResult(m.player1Id, m.player2Id, config, codes)
          await prisma.match.update({
            where: { id: m.id },
            data: {
              played: true,
              winnerId: res.winnerId ?? m.player1Id, // playoff must have a winner
              resultCode: res.resultCode === 'Tied'
                ? pick(codes.filter((c) => c !== 'Tied'))
                : res.resultCode,
              player1BigPoints: res.player1BigPoints,
              player2BigPoints: res.player2BigPoints,
              player1SmallPoints: res.player1SmallPoints,
              player2SmallPoints: res.player2SmallPoints,
            },
          })
          playoffMatches++
          await autoAdvancePlayoff(m.id)
        }
      }
    }
  }

  return {
    matchesSimulated: toPlayoffResult.matchesSimulated + playoffMatches,
    roundsCreated: toPlayoffResult.roundsCreated,
    playoffCreated: toPlayoffResult.playoffCreated,
  }
}

// ---------------------------------------------------------------------------
// Reset simulation
// ---------------------------------------------------------------------------

async function resetSimulation(seasonId: number) {
  const season = await prisma.season.findUnique({ where: { id: seasonId } })
  if (!season) throw new Error('Sezon nie znaleziony')

  // Delete all playoff data
  await prisma.match.deleteMany({ where: { bracketRound: { not: null } } })
  await prisma.groupPlayer.deleteMany({ where: { group: { round: { type: 'PLAYOFF' } } } })
  await prisma.group.deleteMany({ where: { round: { type: 'PLAYOFF' } } })
  await prisma.round.deleteMany({ where: { type: 'PLAYOFF' } })

  // Delete rounds 2+ (keep round 1)
  const firstRound = await prisma.round.findFirst({
    where: { seasonId: season.id },
    orderBy: { roundNumber: 'asc' },
  })

  if (firstRound) {
    // Delete matches in rounds > firstRound
    await prisma.match.deleteMany({
      where: { group: { round: { id: { not: firstRound.id }, seasonId: season.id } } },
    })
    await prisma.groupPlayer.deleteMany({
      where: { group: { round: { id: { not: firstRound.id }, seasonId: season.id } } },
    })
    await prisma.group.deleteMany({
      where: { round: { id: { not: firstRound.id }, seasonId: season.id } },
    })
    await prisma.round.deleteMany({
      where: { id: { not: firstRound.id }, seasonId: season.id },
    })

    // Reset results in round 1
    await prisma.match.updateMany({
      where: { group: { roundId: firstRound.id } },
      data: {
        resultCode: null,
        winnerId: null,
        played: false,
        isWalkover: false,
        player1BigPoints: 0,
        player2BigPoints: 0,
        player1SmallPoints: 0,
        player2SmallPoints: 0,
        bracketRound: null,
        bracketPosition: null,
      },
    })

    // Set round 1 back to ACTIVE
    await prisma.round.update({
      where: { id: firstRound.id },
      data: { status: 'ACTIVE' },
    })
  }

  return { matchesSimulated: 0, roundsCreated: 0, playoffCreated: false }
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { action } = body as { action: string }

  const season = await prisma.season.findFirst({ where: { status: 'ACTIVE' } })
  if (!season) {
    return NextResponse.json({ error: 'Brak aktywnego sezonu' }, { status: 400 })
  }

  const config = (season.config as unknown as SeasonConfig) ?? DEFAULT_SEASON_CONFIG

  try {
    let stats: { matchesSimulated: number; roundsCreated: number; playoffCreated: boolean }
    let message: string

    switch (action) {
      case 'current-round':
        stats = await simulateCurrentRound(season.id, config)
        message = `Zasymulowano ${stats.matchesSimulated} meczów w bieżącej rundzie.`
        break
      case 'to-playoff':
        stats = await simulateToPlayoff(season.id, config)
        message = `Zasymulowano ${stats.matchesSimulated} meczów, utworzono ${stats.roundsCreated} rund. Play-off ${stats.playoffCreated ? 'utworzony' : 'już istniał'}.`
        break
      case 'full-season':
        stats = await simulateFullSeason(season.id, config)
        message = `Zasymulowano cały sezon: ${stats.matchesSimulated} meczów, ${stats.roundsCreated} rund.`
        break
      case 'reset-simulation':
        stats = await resetSimulation(season.id)
        message = 'Reset zakończony. Runda 1 przywrócona do stanu początkowego.'
        break
      default:
        return NextResponse.json({ error: `Nieznana akcja: ${action}` }, { status: 400 })
    }

    return NextResponse.json({ success: true, message, stats })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Nieznany błąd'
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 })
  }
}
