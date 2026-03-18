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
      players: { include: { player: true } },
      matches: { include: { player1: true, player2: true } },
    },
  })

  if (!group) {
    return NextResponse.json({ error: 'Nie znaleziono' }, { status: 404 })
  }

  const standings = computeStandings(group.players, group.matches)

  return NextResponse.json(standings)
}
