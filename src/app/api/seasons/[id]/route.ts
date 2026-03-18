import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const season = await prisma.season.findUnique({
    where: { id: parseInt(id) },
    include: {
      rounds: {
        orderBy: { roundNumber: 'asc' },
        include: {
          groups: {
            orderBy: { sortOrder: 'asc' },
            include: {
              players: { include: { player: true } },
              _count: { select: { matches: true } },
            },
          },
        },
      },
    },
  })

  if (!season) {
    return NextResponse.json({ error: 'Nie znaleziono' }, { status: 404 })
  }

  return NextResponse.json(season)
}
