import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const playerId = parseInt(id)

  const matches = await prisma.match.findMany({
    where: {
      OR: [{ player1Id: playerId }, { player2Id: playerId }],
    },
    include: {
      player1: true,
      player2: true,
      winner: true,
      group: { include: { round: { include: { season: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(matches)
}
