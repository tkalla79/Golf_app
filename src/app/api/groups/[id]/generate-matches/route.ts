import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { generateRoundRobinPairings } from '@/lib/group-generator'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const groupId = parseInt(id)

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { players: true },
  })

  if (!group) {
    return NextResponse.json({ error: 'Grupa nie znaleziona' }, { status: 404 })
  }

  // Remove existing matches
  await prisma.match.deleteMany({ where: { groupId } })

  // Generate round-robin pairings
  const playerIds = group.players.map((gp) => gp.playerId)
  const pairings = generateRoundRobinPairings(playerIds)

  for (const [p1, p2] of pairings) {
    await prisma.match.create({
      data: { groupId, player1Id: p1, player2Id: p2 },
    })
  }

  return NextResponse.json({ success: true, matchCount: pairings.length })
}
