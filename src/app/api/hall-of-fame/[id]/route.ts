import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { playerName, seasonName, year, photoUrl, description, sortOrder, playerId, seasonId } = body

  const entry = await prisma.hallOfFameEntry.update({
    where: { id: Number(id) },
    data: {
      ...(playerName !== undefined && { playerName }),
      ...(seasonName !== undefined && { seasonName }),
      ...(year !== undefined && { year: Number(year) }),
      ...(photoUrl !== undefined && { photoUrl: photoUrl || null }),
      ...(description !== undefined && { description: description || null }),
      ...(sortOrder !== undefined && { sortOrder: Number(sortOrder) }),
      ...(playerId !== undefined && { playerId: playerId ? Number(playerId) : null }),
      ...(seasonId !== undefined && { seasonId: seasonId ? Number(seasonId) : null }),
    },
  })

  return NextResponse.json(entry)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await prisma.hallOfFameEntry.delete({ where: { id: Number(id) } })

  return NextResponse.json({ success: true })
}
