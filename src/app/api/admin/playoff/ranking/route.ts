// src/app/api/admin/playoff/ranking/route.ts
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { computeGlobalRanking } from '@/lib/playoff'

export async function GET() {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const activeSeason = await prisma.season.findFirst({
    where: { status: 'ACTIVE' },
  })

  if (!activeSeason) {
    return NextResponse.json({ error: 'Brak aktywnego sezonu' }, { status: 404 })
  }

  // Check if playoff already exists
  const existingPlayoff = await prisma.round.findFirst({
    where: { seasonId: activeSeason.id, type: 'PLAYOFF' },
  })

  if (existingPlayoff) {
    return NextResponse.json({ error: 'Playoff już istnieje' }, { status: 409 })
  }

  const ranking = await computeGlobalRanking(activeSeason.id)

  return NextResponse.json({
    seasonId: activeSeason.id,
    seasonName: activeSeason.name,
    ranking,
    brackets: {
      '1-16': ranking.slice(0, 16),
      '17-32': ranking.slice(16, 32),
      '33-48': ranking.slice(32, 48),
    },
  })
}
