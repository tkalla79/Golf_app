import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { computePoints, SeasonConfig, DEFAULT_SEASON_CONFIG } from '@/lib/scoring'
import { autoAdvancePlayoff, cascadeDeleteDownstream } from '@/lib/playoff'

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
  if (isNaN(matchId)) {
    return NextResponse.json({ error: 'Invalid match ID' }, { status: 400 })
  }
  const body = await request.json()
  const { winnerId, resultCode, isWalkover, holes } = body

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

  const isPlayoff = match.group.round.type === 'PLAYOFF'

  // Block "Tied" result for playoff (sudden death resolves ties)
  if (isPlayoff && resultCode === 'Tied' && !isWalkover) {
    return NextResponse.json({ error: 'Remis nie jest dozwolony w play-off (nagła śmierć od dołka 1)' }, { status: 400 })
  }

  // Compute points only for group-stage matches
  let points = {
    player1BigPoints: 0,
    player2BigPoints: 0,
    player1SmallPoints: 0,
    player2SmallPoints: 0,
  }

  if (!isPlayoff) {
    const seasonConfig = (match.group.round.season.config as unknown as SeasonConfig) || DEFAULT_SEASON_CONFIG
    points = computePoints(
      {
        winnerId: winnerId ? parseInt(winnerId) : null,
        resultCode: resultCode || 'Tied',
        isWalkover: !!isWalkover,
      },
      match.player1Id,
      match.player2Id,
      seasonConfig
    )
  }

  const updated = await prisma.match.update({
    where: { id: matchId },
    data: {
      resultCode: isWalkover ? 'Walkover' : resultCode,
      winnerId: winnerId ? parseInt(winnerId) : null,
      isWalkover: !!isWalkover,
      played: true,
      holes: holes ? parseInt(holes) : undefined,
      ...points,
    },
    include: { player1: true, player2: true, winner: true },
  })

  // Auto-advance: create next-round playoff match if both feeders decided
  if (isPlayoff && updated.winnerId) {
    await autoAdvancePlayoff(matchId)
  }

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
  const matchId = parseInt(id)
  if (isNaN(matchId)) {
    return NextResponse.json({ error: 'Invalid match ID' }, { status: 400 })
  }

  // For playoff matches: cascade delete downstream matches first
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { group: { include: { round: true } } },
  })

  if (match?.group.round.type === 'PLAYOFF') {
    await cascadeDeleteDownstream(matchId)
  }

  const updated = await prisma.match.update({
    where: { id: matchId },
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
