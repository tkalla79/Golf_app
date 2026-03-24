/**
 * Full season simulation script for the Golf league app.
 *
 * Usage:  cd /tmp/Golf_app && npx tsx scripts/simulate-full-season.ts
 *
 * Phases:
 *   1. Simulate Round 1 (existing 225 unplayed matches)
 *   2. Generate Rounds 2-4 with regrouping, simulate each
 *   3. Create Play-off brackets from global ranking
 *   4. Simulate all Play-off rounds (auto-advancing brackets)
 */

import { PrismaClient } from '@prisma/client'
import {
  computePoints,
  RESULT_CODES,
  DEFAULT_SEASON_CONFIG,
  type SeasonConfig,
  type MatchResultInput,
} from '../src/lib/scoring'
import { computeStandings } from '../src/lib/standings'
import {
  generateNextRoundGroups,
  generatePromotionRelegation,
  generateRoundRobinPairings,
} from '../src/lib/group-generator'
import {
  computeGlobalRanking,
  BRACKET_SEEDS,
  BRACKET_NAMES,
  BRACKET_HOLES,
  ROUND_NAMES,
  autoAdvancePlayoff,
} from '../src/lib/playoff'

const prisma = new PrismaClient()

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/** Generates a random match result (non-walkover). ~15 % chance of draw. */
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

let totalMatchesSimulated = 0

async function simulateMatches(
  matches: { id: number; player1Id: number; player2Id: number }[],
  config: SeasonConfig,
  resultCodes: readonly string[] = RESULT_CODES,
) {
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
    totalMatchesSimulated++
  }
}

// ---------------------------------------------------------------------------
// Phase 1 -- Simulate existing Round 1 matches
// ---------------------------------------------------------------------------

async function phase1(seasonId: number, config: SeasonConfig) {
  console.log('\n=== PHASE 1: Simulate Round 1 matches ===')

  const round = await prisma.round.findFirst({
    where: { seasonId, roundNumber: 1 },
  })
  if (!round) throw new Error('Round 1 not found')

  const matches = await prisma.match.findMany({
    where: { group: { roundId: round.id }, played: false },
    select: { id: true, player1Id: true, player2Id: true },
  })

  console.log(`  Simulating ${matches.length} matches...`)
  await simulateMatches(matches, config)

  // Mark round completed
  await prisma.round.update({ where: { id: round.id }, data: { status: 'COMPLETED' } })
  console.log('  Round 1 completed.')
}

// ---------------------------------------------------------------------------
// Phase 2 -- Generate & simulate Rounds 2-4
// ---------------------------------------------------------------------------

async function phase2(seasonId: number, config: SeasonConfig) {
  console.log('\n=== PHASE 2: Generate & simulate Rounds 2-4 ===')

  for (let rn = 2; rn <= 4; rn++) {
    // Get the most recently completed round
    const prevRound = await prisma.round.findFirst({
      where: { seasonId, type: 'ROUND_ROBIN', status: 'COMPLETED' },
      orderBy: { roundNumber: 'desc' },
    })
    if (!prevRound) throw new Error(`No completed round found before round ${rn}`)

    console.log(`\n  --- Round ${rn} ---`)

    // Round 1→2: full regrouping. Round 2+→3+: promotion/relegation
    const newGroupDefs = prevRound.roundNumber <= 1
      ? await generateNextRoundGroups(prevRound.id)
      : await generatePromotionRelegation(prevRound.id)
    console.log(`  ${prevRound.roundNumber <= 1 ? 'Regrouped' : 'Promotion/relegation'} into ${newGroupDefs.length} groups`)

    // Create round
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

    let matchesCreated = 0

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

      // Assign players
      for (const p of gDef.players) {
        await prisma.groupPlayer.create({
          data: {
            groupId: group.id,
            playerId: p.playerId,
            hcpAtStart: p.hcp,
          },
        })
      }

      // Generate round-robin pairings & create matches
      const pids = gDef.players.map((p) => p.playerId)
      const pairings = generateRoundRobinPairings(pids)
      for (const [p1, p2] of pairings) {
        await prisma.match.create({
          data: { groupId: group.id, player1Id: p1, player2Id: p2 },
        })
        matchesCreated++
      }
    }

    console.log(`  Created ${matchesCreated} matches`)

    // Simulate all matches for this round
    const matches = await prisma.match.findMany({
      where: { group: { roundId: round.id }, played: false },
      select: { id: true, player1Id: true, player2Id: true },
    })
    await simulateMatches(matches, config)

    // Mark round completed
    await prisma.round.update({ where: { id: round.id }, data: { status: 'COMPLETED' } })
    console.log(`  Round ${rn} completed (${matches.length} matches simulated)`)
  }
}

// ---------------------------------------------------------------------------
// Phase 3 -- Create Play-off
// ---------------------------------------------------------------------------

async function phase3(seasonId: number): Promise<number> {
  console.log('\n=== PHASE 3: Create Play-off ===')

  const ranking = await computeGlobalRanking(seasonId)
  console.log(`  Global ranking computed: ${ranking.length} players`)

  if (ranking.length < 16) {
    throw new Error(`Not enough players for play-off: ${ranking.length}`)
  }

  // Print top-10
  console.log('\n  Top 10 global ranking:')
  for (const p of ranking.slice(0, 10)) {
    console.log(
      `    #${String(p.rank).padStart(2)} ${(p.firstName + ' ' + p.lastName).padEnd(25)} ` +
        `BP=${String(p.bigPoints).padStart(3)}  SP=${String(p.smallPoints).padStart(4)}  ` +
        `Group=${p.groupName}  Pos=${p.positionInGroup}`,
    )
  }

  // Create playoff round
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

    // Add players
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

    // Create Round 1 matches
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
        // BYE
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

    const r1Matches = await prisma.match.count({
      where: { groupId: group.id, bracketRound: 1 },
    })
    console.log(`  Bracket ${bracketName}: ${r1Matches} Round-1 matches created`)
  }

  return round.id
}

// ---------------------------------------------------------------------------
// Phase 4 -- Simulate Play-off matches round-by-round
// ---------------------------------------------------------------------------

async function phase4(playoffRoundId: number, seasonId: number) {
  console.log('\n=== PHASE 4: Simulate Play-off ===')

  // Load season config (for scoring) - playoff uses 18-hole codes for bracket 1-16
  const season = await prisma.season.findUnique({ where: { id: seasonId } })
  const config = (season?.config as SeasonConfig) ?? DEFAULT_SEASON_CONFIG

  const groups = await prisma.group.findMany({
    where: { roundId: playoffRoundId },
    orderBy: { sortOrder: 'asc' },
  })

  const bracketWinners: { bracket: string; winner: string }[] = []

  for (const group of groups) {
    const bracketName = group.name.replace('Drabinka ', '')
    const holes = BRACKET_HOLES[bracketName] ?? 9
    // Use extended result codes for 18-hole matches
    const { RESULT_CODES_18 } = await import('../src/lib/scoring')
    const codes = holes === 18 ? RESULT_CODES_18 : RESULT_CODES

    console.log(`\n  --- Bracket ${bracketName} (${holes} holes) ---`)

    // Process bracket rounds 1 through 4
    for (let br = 1; br <= 4; br++) {
      const roundLabel = ROUND_NAMES[br] ?? `Round ${br}`
      const unplayed = await prisma.match.findMany({
        where: {
          groupId: group.id,
          bracketRound: br,
          played: false,
        },
        select: { id: true, player1Id: true, player2Id: true },
      })

      if (unplayed.length === 0) {
        // Check if matches exist (they may all be BYEs already played)
        const total = await prisma.match.count({
          where: { groupId: group.id, bracketRound: br },
        })
        if (total > 0) {
          console.log(`    ${roundLabel}: ${total} matches (all pre-decided / BYE)`)
        }
        continue
      }

      console.log(`    ${roundLabel}: simulating ${unplayed.length} matches`)

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
        totalMatchesSimulated++

        // Re-read match to get the saved winnerId for auto-advance
        await autoAdvancePlayoff(m.id)
      }
    }

    // Determine bracket winner (R4 position 1 = places 1-2 final)
    const finalMatch = await prisma.match.findFirst({
      where: { groupId: group.id, bracketRound: 4, bracketPosition: 1, played: true },
      include: { winner: true },
    })
    if (finalMatch?.winner) {
      bracketWinners.push({
        bracket: bracketName,
        winner: `${finalMatch.winner.firstName} ${finalMatch.winner.lastName}`,
      })
    }

    // Count total matches for this bracket
    const bracketTotal = await prisma.match.count({ where: { groupId: group.id } })
    console.log(`    Total matches in bracket: ${bracketTotal}`)
  }

  return bracketWinners
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('========================================')
  console.log('  FULL SEASON SIMULATION')
  console.log('========================================')

  const season = await prisma.season.findFirst({ where: { status: 'ACTIVE' } })
  if (!season) throw new Error('No active season found')

  const config = (season.config as SeasonConfig) ?? DEFAULT_SEASON_CONFIG
  console.log(`\nSeason: ${season.name} (id=${season.id})`)

  // Phase 1
  await phase1(season.id, config)

  // Phase 2
  await phase2(season.id, config)

  // Phase 3
  const playoffRoundId = await phase3(season.id)

  // Phase 4
  const bracketWinners = await phase4(playoffRoundId, season.id)

  // Final ranking from the last RR round
  const ranking = await computeGlobalRanking(season.id)

  // Summary
  console.log('\n========================================')
  console.log('  SIMULATION SUMMARY')
  console.log('========================================')
  console.log(`\n  Total matches simulated: ${totalMatchesSimulated}`)

  console.log('\n  Top 10 Global Ranking (after all group rounds):')
  for (const p of ranking.slice(0, 10)) {
    console.log(
      `    #${String(p.rank).padStart(2)} ${(p.firstName + ' ' + p.lastName).padEnd(25)} ` +
        `BP=${String(p.bigPoints).padStart(3)}  SP=${String(p.smallPoints).padStart(4)}`,
    )
  }

  console.log('\n  Play-off Bracket Winners:')
  for (const bw of bracketWinners) {
    console.log(`    Bracket ${bw.bracket}: ${bw.winner}`)
  }

  const totalMatchesInDb = await prisma.match.count()
  const playedInDb = await prisma.match.count({ where: { played: true } })
  console.log(`\n  Total matches in DB: ${totalMatchesInDb}  (played: ${playedInDb})`)

  console.log('\n  DONE.')
}

main()
  .catch((err) => {
    console.error('ERROR:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
