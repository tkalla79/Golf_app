import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { computeStandings } from '@/lib/standings'
import { getSeasonBirdies } from '@/lib/season-birdies'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const group = await prisma.group.findUnique({
    where: { id: parseInt(id) },
    include: {
      round: { select: { seasonId: true } },
      players: { include: { player: true } },
      matches: { include: { player1: true, player2: true } },
    },
  })

  if (!group) {
    return NextResponse.json({ error: 'Nie znaleziono' }, { status: 404 })
  }

  const seasonBirdies = await getSeasonBirdies(group.round.seasonId)
  const standings = computeStandings(group.players, group.matches, seasonBirdies)

  return NextResponse.json(standings)
}
