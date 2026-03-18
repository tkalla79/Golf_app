import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { computePoints, SeasonConfig, DEFAULT_SEASON_CONFIG } from '@/lib/scoring'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const matchId = parseInt(id)
  const body = await request.json()
  const { winnerId, resultCode, isWalkover } = body

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      group: {
        include: {
          round: { include: { season: true } },
        },
      },
    },
  })

  if (!match) {
    return NextResponse.json({ error: 'Mecz nie znaleziony' }, { status: 404 })
  }

  const seasonConfig = (match.group.round.season.config as unknown as SeasonConfig) || DEFAULT_SEASON_CONFIG

  const points = computePoints(
    {
      winnerId: winnerId ? parseInt(winnerId) : null,
      resultCode: resultCode || 'Tied',
      isWalkover: !!isWalkover,
    },
    match.player1Id,
    match.player2Id,
    seasonConfig
  )

  const updated = await prisma.match.update({
    where: { id: matchId },
    data: {
      resultCode: isWalkover ? 'Walkover' : resultCode,
      winnerId: winnerId ? parseInt(winnerId) : null,
      isWalkover: !!isWalkover,
      played: true,
      ...points,
    },
    include: { player1: true, player2: true, winner: true },
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const updated = await prisma.match.update({
    where: { id: parseInt(id) },
    data: {
      resultCode: null,
      winnerId: null,
      isWalkover: false,
      played: false,
      player1BigPoints: 0,
      player2BigPoints: 0,
      player1SmallPoints: 0,
      player2SmallPoints: 0,
    },
  })

  return NextResponse.json(updated)
}
