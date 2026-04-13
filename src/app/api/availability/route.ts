import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getPlayerSession } from '@/lib/player-auth'

// GET — list open slots for a group (or player's groups)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const groupId = searchParams.get('groupId')

  if (!groupId) {
    return NextResponse.json({ error: 'groupId jest wymagany' }, { status: 400 })
  }

  const gid = parseInt(groupId)
  if (isNaN(gid)) {
    return NextResponse.json({ error: 'Nieprawidłowe groupId' }, { status: 400 })
  }

  const slots = await prisma.availabilitySlot.findMany({
    where: {
      status: 'OPEN',
      dateEnd: { gt: new Date() },
      match: {
        groupId: gid,
        played: false,
      },
    },
    include: {
      player: { select: { id: true, firstName: true, lastName: true, slug: true } },
      match: {
        select: {
          id: true,
          player1Id: true,
          player2Id: true,
          player1: { select: { id: true, firstName: true, lastName: true, slug: true } },
          player2: { select: { id: true, firstName: true, lastName: true, slug: true } },
        },
      },
    },
    orderBy: { dateStart: 'asc' },
  })

  return NextResponse.json(slots)
}

// POST — create a new availability slot
export async function POST(request: NextRequest) {
  const session = await getPlayerSession()
  if (!session) {
    return NextResponse.json({ error: 'Musisz być zalogowany' }, { status: 401 })
  }

  const body = await request.json()
  const { matchId, dateStart, dateEnd } = body

  if (!matchId || !dateStart || !dateEnd) {
    return NextResponse.json({ error: 'matchId, dateStart i dateEnd są wymagane' }, { status: 400 })
  }

  const parsedMatchId = parseInt(matchId)
  if (isNaN(parsedMatchId)) {
    return NextResponse.json({ error: 'Nieprawidłowe matchId' }, { status: 400 })
  }

  const start = new Date(dateStart)
  const end = new Date(dateEnd)

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return NextResponse.json({ error: 'Nieprawidłowy format daty' }, { status: 400 })
  }

  if (end <= start) {
    return NextResponse.json({ error: 'Data końcowa musi być po dacie początkowej' }, { status: 400 })
  }

  // Validate minimum 3 hours
  const diffHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
  if (diffHours < 3) {
    return NextResponse.json({ error: 'Minimalny przedział czasowy to 3 godziny' }, { status: 400 })
  }

  if (start <= new Date()) {
    return NextResponse.json({ error: 'Data musi być w przyszłości' }, { status: 400 })
  }

  // Verify match exists and player is a participant
  const match = await prisma.match.findUnique({
    where: { id: parsedMatchId },
    select: { id: true, player1Id: true, player2Id: true, played: true, scheduledDate: true },
  })

  if (!match) {
    return NextResponse.json({ error: 'Mecz nie istnieje' }, { status: 404 })
  }

  if (match.played) {
    return NextResponse.json({ error: 'Mecz już został rozegrany' }, { status: 400 })
  }

  if (match.scheduledDate) {
    return NextResponse.json({ error: 'Mecz ma już ustalony termin' }, { status: 400 })
  }

  const isParticipant = session.playerId === match.player1Id || session.playerId === match.player2Id
  if (!isParticipant) {
    return NextResponse.json({ error: 'Możesz zgłaszać dostępność tylko do swoich meczów' }, { status: 403 })
  }

  // Atomic check + create inside transaction to prevent duplicates
  try {
    const slot = await prisma.$transaction(async (tx) => {
      const existing = await tx.availabilitySlot.findFirst({
        where: { playerId: session.playerId, matchId: match.id, status: 'OPEN' },
      })

      if (existing) {
        throw new Error('DUPLICATE_SLOT')
      }

      return tx.availabilitySlot.create({
        data: {
          playerId: session.playerId,
          matchId: match.id,
          dateStart: start,
          dateEnd: end,
        },
        include: {
          player: { select: { id: true, firstName: true, lastName: true } },
        },
      })
    })

    return NextResponse.json(slot, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message === 'DUPLICATE_SLOT') {
      return NextResponse.json({ error: 'Masz już aktywny slot dla tego meczu' }, { status: 409 })
    }
    throw err
  }
}
