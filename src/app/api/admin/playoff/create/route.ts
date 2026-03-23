// src/app/api/admin/playoff/create/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { computeGlobalRanking, BRACKET_SEEDS, BRACKET_NAMES, BRACKET_HOLES, autoAdvancePlayoff } from '@/lib/playoff'

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { seasonId, overrides } = body as {
    seasonId: number
    overrides?: Record<number, number> // rank → playerId overrides
  }

  // Check no existing playoff
  const existing = await prisma.round.findFirst({
    where: { seasonId, type: 'PLAYOFF' },
  })
  if (existing) {
    return NextResponse.json({ error: 'Play-off już istnieje' }, { status: 409 })
  }

  // Get ranking
  const ranking = await computeGlobalRanking(seasonId)
  if (ranking.length < 16) {
    return NextResponse.json({
      error: `Za mało graczy (${ranking.length}/16). Potrzeba minimum 16 graczy z zakończoną fazą grupową.`,
    }, { status: 400 })
  }
  // Note: If fewer than 48 players, brackets with missing seeds will have BYE auto-advances

  // Apply overrides if any (admin swaps)
  if (overrides) {
    for (const [rankStr, playerId] of Object.entries(overrides)) {
      const rank = parseInt(rankStr)
      const idx = ranking.findIndex(p => p.rank === rank)
      const swapIdx = ranking.findIndex(p => p.playerId === playerId)
      if (idx >= 0 && swapIdx >= 0) {
        // Swap the two players' positions in ranking
        const tempRank = ranking[idx].rank
        ranking[idx].rank = ranking[swapIdx].rank
        ranking[swapIdx].rank = tempRank
        // Re-sort
        ranking.sort((a, b) => a.rank - b.rank)
      }
    }
  }

  // Create playoff round
  const round = await prisma.round.create({
    data: {
      seasonId,
      name: 'Play-off',
      roundNumber: 99, // high number to sort after group rounds
      type: 'PLAYOFF',
      status: 'ACTIVE',
      config: { bracketHoles: BRACKET_HOLES },
    },
  })

  const createdGroups = []

  for (let bracketIdx = 0; bracketIdx < BRACKET_NAMES.length; bracketIdx++) {
    const bracketName = BRACKET_NAMES[bracketIdx]
    const seeds = BRACKET_SEEDS[bracketName]
    const bracketPlayers = ranking.slice(bracketIdx * 16, (bracketIdx + 1) * 16)

    // Create group (bracket)
    const group = await prisma.group.create({
      data: {
        roundId: round.id,
        name: `Drabinka ${bracketName}`,
        sortOrder: bracketIdx,
        status: 'ACTIVE',
      },
    })

    // Add players to group with finalPosition = their global seed
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

    // Create Round 1 matches (8 per bracket)
    for (let i = 0; i < seeds.length; i++) {
      const [seed1, seed2] = seeds[i]
      const p1 = ranking.find(p => p.rank === seed1)
      const p2 = ranking.find(p => p.rank === seed2)

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
        // BYE: p1 auto-advances
        await prisma.match.create({
          data: {
            groupId: group.id,
            player1Id: p1.playerId,
            player2Id: p1.playerId, // placeholder — self-match for BYE
            bracketRound: 1,
            bracketPosition: i + 1,
            played: true,
            winnerId: p1.playerId,
            resultCode: 'BYE',
          },
        })
      }
    }

    // Trigger auto-advance for BYE matches
    const byeMatches = await prisma.match.findMany({
      where: { groupId: group.id, resultCode: 'BYE', bracketRound: 1 },
    })
    for (const byeMatch of byeMatches) {
      await autoAdvancePlayoff(byeMatch.id)
    }

    createdGroups.push(group)
  }

  return NextResponse.json({
    roundId: round.id,
    groups: createdGroups.map(g => ({ id: g.id, name: g.name })),
    message: 'Play-off utworzony pomyślnie',
  })
}
