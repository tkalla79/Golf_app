import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getPlayerSession } from '@/lib/player-auth'
import { auth } from '@/lib/auth'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const matchId = Number(id)
  if (isNaN(matchId)) {
    return NextResponse.json({ error: 'Nieprawidłowe ID meczu' }, { status: 400 })
  }

  // Check admin auth OR player auth
  const adminSession = await auth()
  const playerSession = await getPlayerSession()

  if (!adminSession && !playerSession) {
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

  // If not admin, check that player is a participant
  if (!adminSession && playerSession) {
    const isParticipant =
      playerSession.playerId === match.player1Id ||
      playerSession.playerId === match.player2Id

    if (!isParticipant) {
      return NextResponse.json({ error: 'Możesz umawiać tylko swoje mecze' }, { status: 403 })
    }
  }

  const body = await req.json()
  const { scheduledDate } = body

  if (scheduledDate !== null && scheduledDate !== undefined) {
    const parsed = new Date(scheduledDate)
    if (isNaN(parsed.getTime())) {
      return NextResponse.json({ error: 'Nieprawidłowy format daty' }, { status: 400 })
    }
  }

  const updated = await prisma.match.update({
    where: { id: matchId },
    data: {
      scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
    },
    select: { id: true, scheduledDate: true },
  })

  return NextResponse.json(updated)
}
