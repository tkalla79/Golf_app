import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const matches = await prisma.match.findMany({
    where: { groupId: parseInt(id) },
    include: { player1: true, player2: true, winner: true },
    orderBy: { id: 'asc' },
  })

  return NextResponse.json(matches)
}
