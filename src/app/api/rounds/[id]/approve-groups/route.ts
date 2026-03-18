import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { generateRoundRobinPairings } from '@/lib/group-generator'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const roundId = parseInt(id)
  const body = await request.json()
  const { groups } = body

  const completedRound = await prisma.round.findUnique({
    where: { id: roundId },
    include: { season: true },
  })

  if (!completedRound) {
    return NextResponse.json({ error: 'Runda nie znaleziona' }, { status: 404 })
  }

  // Create next round
  const nextRoundNumber = completedRound.roundNumber + 1
  const newRound = await prisma.round.create({
    data: {
      seasonId: completedRound.seasonId,
      name: `Runda ${nextRoundNumber}`,
      roundNumber: nextRoundNumber,
      type: 'ROUND_ROBIN',
      holes: completedRound.holes,
      status: 'ACTIVE',
    },
  })

  // Create groups with players and matches
  for (let i = 0; i < groups.length; i++) {
    const groupData = groups[i]
    const group = await prisma.group.create({
      data: {
        roundId: newRound.id,
        name: groupData.name,
        sortOrder: i,
        status: 'ACTIVE',
      },
    })

    // Add players
    const playerIds: number[] = []
    for (const p of groupData.players) {
      await prisma.groupPlayer.create({
        data: {
          groupId: group.id,
          playerId: p.playerId,
          hcpAtStart: p.hcp,
        },
      })
      playerIds.push(p.playerId)
    }

    // Generate round-robin matches
    const pairings = generateRoundRobinPairings(playerIds)
    for (const [p1, p2] of pairings) {
      await prisma.match.create({
        data: {
          groupId: group.id,
          player1Id: p1,
          player2Id: p2,
        },
      })
    }
  }

  return NextResponse.json({ success: true, roundId: newRound.id })
}
