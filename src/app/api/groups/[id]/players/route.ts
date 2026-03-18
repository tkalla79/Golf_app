import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const groupId = parseInt(id)
  const body = await request.json()
  const { playerIds } = body as { playerIds: number[] }

  // Remove existing players from group
  await prisma.groupPlayer.deleteMany({ where: { groupId } })

  // Also remove existing matches for this group
  await prisma.match.deleteMany({ where: { groupId } })

  // Add new players
  for (const playerId of playerIds) {
    const player = await prisma.player.findUnique({ where: { id: playerId } })
    await prisma.groupPlayer.create({
      data: {
        groupId,
        playerId,
        hcpAtStart: player?.hcp,
      },
    })
  }

  return NextResponse.json({ success: true })
}
