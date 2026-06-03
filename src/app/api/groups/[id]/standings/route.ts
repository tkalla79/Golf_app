import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { computeStandings } from '@/lib/standings'

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

  // Season-cumulative birdies (Sekcja 2): players see total birdies across all rounds.
  const seasonMatches = await prisma.match.findMany({
    where: { group: { round: { seasonId: group.round.seasonId } }, played: true },
    select: { player1Id: true, player2Id: true, player1Birdies: true, player2Birdies: true },
  })
  const seasonBirdies = new Map<number, number>()
  for (const m of seasonMatches) {
    seasonBirdies.set(m.player1Id, (seasonBirdies.get(m.player1Id) ?? 0) + m.player1Birdies)
    seasonBirdies.set(m.player2Id, (seasonBirdies.get(m.player2Id) ?? 0) + m.player2Birdies)
  }

  const standings = computeStandings(group.players, group.matches, seasonBirdies)

  return NextResponse.json(standings)
}
