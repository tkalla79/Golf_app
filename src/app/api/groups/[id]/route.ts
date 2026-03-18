import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const group = await prisma.group.findUnique({
    where: { id: parseInt(id) },
    include: {
      round: { include: { season: true } },
      players: { include: { player: true } },
      matches: { include: { player1: true, player2: true, winner: true } },
    },
  })

  if (!group) {
    return NextResponse.json({ error: 'Nie znaleziono' }, { status: 404 })
  }

  return NextResponse.json(group)
}
