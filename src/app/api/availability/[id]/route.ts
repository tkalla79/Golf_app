import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getPlayerSession } from '@/lib/player-auth'

// DELETE — cancel own open slot
export async function DELETE(
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

  // Atomic conditional update: only cancel if OPEN and owned by this player
  const result = await prisma.availabilitySlot.updateMany({
    where: {
      id: slotId,
      playerId: session.playerId,
      status: 'OPEN',
    },
    data: { status: 'CANCELLED' },
  })

  if (result.count === 0) {
    // Determine specific error
    const slot = await prisma.availabilitySlot.findUnique({
      where: { id: slotId },
      select: { playerId: true, status: true },
    })
    if (!slot) {
      return NextResponse.json({ error: 'Slot nie istnieje' }, { status: 404 })
    }
    if (slot.playerId !== session.playerId) {
      return NextResponse.json({ error: 'Możesz anulować tylko własne sloty' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Można anulować tylko otwarte sloty' }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
