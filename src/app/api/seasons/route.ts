import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { DEFAULT_SEASON_CONFIG } from '@/lib/scoring'

export async function GET() {
  const seasons = await prisma.season.findMany({
    orderBy: { year: 'desc' },
    include: { rounds: { orderBy: { roundNumber: 'asc' } } },
  })

  return NextResponse.json(seasons)
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { name, year } = body

  const season = await prisma.season.create({
    data: {
      name: name || `Don Papa Match Play ${year}`,
      year: parseInt(year),
      status: 'ACTIVE',
      config: JSON.parse(JSON.stringify(DEFAULT_SEASON_CONFIG)),
    },
  })

  return NextResponse.json(season, { status: 201 })
}
