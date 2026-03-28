import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const entries = await prisma.hallOfFameEntry.findMany({
    orderBy: [{ year: 'desc' }, { sortOrder: 'asc' }],
  })
  return NextResponse.json(entries)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { playerName, seasonName, year, photoUrl, description, sortOrder, playerId, seasonId } = body

  if (!playerName || !seasonName || !year) {
    return NextResponse.json({ error: 'playerName, seasonName i year są wymagane' }, { status: 400 })
  }

  const entry = await prisma.hallOfFameEntry.create({
    data: {
      playerName,
      seasonName,
      year: Number(year),
      photoUrl: photoUrl || null,
      description: description || null,
      sortOrder: sortOrder ? Number(sortOrder) : 0,
      playerId: playerId ? Number(playerId) : null,
      seasonId: seasonId ? Number(seasonId) : null,
    },
  })

  return NextResponse.json(entry, { status: 201 })
}
