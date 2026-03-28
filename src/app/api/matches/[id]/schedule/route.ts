import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getPlayerSession } from '@/lib/player-auth'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const matchId = Number(id)

  const playerSession = await getPlayerSession()
  if (!playerSession) {
    return NextResponse.json({ error: 'Musisz być zalogowany' }, { status: 401 })
  }

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { id: true, player1Id: true, player2Id: true, played: true },
  })

  if (!match) {
    return NextResponse.json({ error: 'Mecz nie istnieje' }, { status: 404 })
  }

  if (match.played) {
    return NextResponse.json({ error: 'Mecz już został rozegrany' }, { status: 400 })
  }

  const isParticipant =
    playerSession.playerId === match.player1Id ||
    playerSession.playerId === match.player2Id

  if (!isParticipant) {
    return NextResponse.json({ error: 'Możesz umawiać tylko swoje mecze' }, { status: 403 })
  }

  const body = await req.json()
  const { scheduledDate } = body

  const updated = await prisma.match.update({
    where: { id: matchId },
    data: {
      scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
    },
    select: { id: true, scheduledDate: true },
  })

  return NextResponse.json(updated)
}
