import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const groups = await prisma.group.findMany({
    where: { roundId: parseInt(id) },
    orderBy: { sortOrder: 'asc' },
    include: {
      players: { include: { player: true } },
      _count: { select: { matches: true } },
    },
  })

  return NextResponse.json(groups)
}
