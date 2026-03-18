import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const season = await prisma.season.findFirst({
    where: { status: 'ACTIVE' },
    include: {
      rounds: {
        orderBy: { roundNumber: 'asc' },
        include: {
          groups: {
            orderBy: { sortOrder: 'asc' },
            include: { _count: { select: { players: true, matches: true } } },
          },
        },
      },
    },
  })

  if (!season) {
    return NextResponse.json({ error: 'Brak aktywnego sezonu' }, { status: 404 })
  }

  return NextResponse.json(season)
}
