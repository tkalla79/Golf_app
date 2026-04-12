import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getPlayerSession } from '@/lib/player-auth'
import { sendMatchConfirmation } from '@/lib/mail'

// POST — opponent joins an open slot
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getPlayerSession()
  if (!session) {
    return NextResponse.json({ error: 'Musisz być zalogowany' }, { status: 401 })
  }

  const { id } = await params
  const slotId = parseInt(id)
  if (isNaN(slotId)) {
    return NextResponse.json({ error: 'Nieprawidłowe ID' }, { status: 400 })
  }

  // Pre-fetch slot for early validation (non-transactional)
  const slot = await prisma.availabilitySlot.findUnique({
    where: { id: slotId },
    include: {
      player: { select: { id: true, firstName: true, lastName: true, email: true } },
      match: {
        select: {
          id: true,
          player1Id: true,
          player2Id: true,
          played: true,
          scheduledDate: true,
          group: {
            select: {
              name: true,
              round: { select: { name: true, type: true } },
            },
          },
        },
      },
    },
  })

  if (!slot) {
    return NextResponse.json({ error: 'Slot nie istnieje' }, { status: 404 })
  }

  if (slot.playerId === session.playerId) {
    return NextResponse.json({ error: 'Nie możesz dołączyć do własnego slotu' }, { status: 400 })
  }

  if (!slot.match) {
    return NextResponse.json({ error: 'Slot nie jest powiązany z meczem' }, { status: 400 })
  }

  if (slot.match.played) {
    return NextResponse.json({ error: 'Mecz już został rozegrany' }, { status: 400 })
  }

  // Verify the joining player is the opponent in this match
  const isParticipant = session.playerId === slot.match.player1Id || session.playerId === slot.match.player2Id
  if (!isParticipant) {
    return NextResponse.json({ error: 'Nie jesteś uczestnikiem tego meczu' }, { status: 403 })
  }

  // Get the joining player info
  const joiningPlayer = await prisma.player.findUnique({
    where: { id: session.playerId },
    select: { id: true, firstName: true, lastName: true, email: true },
  })

  if (!joiningPlayer) {
    return NextResponse.json({ error: 'Gracz nie istnieje' }, { status: 404 })
  }

  // Interactive transaction with re-check to prevent race conditions
  const matchId = slot.match.id
  try {
    await prisma.$transaction(async (tx) => {
      // Re-read slot inside transaction to verify it's still OPEN
      const freshSlot = await tx.availabilitySlot.findUnique({
        where: { id: slotId },
        select: { status: true },
      })
      if (!freshSlot || freshSlot.status !== 'OPEN') {
        throw new Error('SLOT_NOT_AVAILABLE')
      }

      // Re-check match doesn't already have a scheduled date
      const freshMatch = await tx.match.findUnique({
        where: { id: matchId },
        select: { scheduledDate: true, played: true },
      })
      if (!freshMatch || freshMatch.scheduledDate || freshMatch.played) {
        throw new Error('MATCH_ALREADY_SCHEDULED')
      }

      // Mark slot as paired
      await tx.availabilitySlot.update({
        where: { id: slotId },
        data: {
          status: 'PAIRED',
          pairedById: session.playerId,
        },
      })

      // Set match scheduled date to slot start
      await tx.match.update({
        where: { id: matchId },
        data: { scheduledDate: slot.dateStart },
      })

      // Cancel all other open slots for this match
      await tx.availabilitySlot.updateMany({
        where: {
          matchId,
          status: 'OPEN',
          id: { not: slotId },
        },
        data: { status: 'CANCELLED' },
      })
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    if (msg === 'SLOT_NOT_AVAILABLE') {
      return NextResponse.json({ error: 'Ten slot nie jest już dostępny' }, { status: 409 })
    }
    if (msg === 'MATCH_ALREADY_SCHEDULED') {
      return NextResponse.json({ error: 'Mecz ma już ustalony termin' }, { status: 409 })
    }
    throw err
  }

  // Send confirmation emails (fire-and-forget, don't block response)
  const groupName = slot.match.group.name
  const roundName = slot.match.group.round.name
  const isPlayoff = slot.match.group.round.type === 'PLAYOFF'

  const slotOwnerName = `${slot.player.firstName} ${slot.player.lastName}`
  const joinerName = `${joiningPlayer.firstName} ${joiningPlayer.lastName}`

  const matchDate = slot.dateStart.toLocaleString('pl-PL', {
    timeZone: 'Europe/Warsaw',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  // Fire-and-forget: don't await emails
  if (slot.player.email) {
    sendMatchConfirmation(
      slot.player.email,
      slotOwnerName,
      joinerName,
      groupName,
      roundName,
      matchDate,
      isPlayoff,
    ).catch((err) => console.error('Email error (slot owner):', err))
  }

  if (joiningPlayer.email) {
    sendMatchConfirmation(
      joiningPlayer.email,
      joinerName,
      slotOwnerName,
      groupName,
      roundName,
      matchDate,
      isPlayoff,
    ).catch((err) => console.error('Email error (joiner):', err))
  }

  return NextResponse.json({ success: true, scheduledDate: slot.dateStart })
}
