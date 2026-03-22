import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getPlayerSession } from '@/lib/player-auth'

export async function POST(request: NextRequest) {
  const session = await getPlayerSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { hcp } = body

  const player = await prisma.player.update({
    where: { id: session.playerId },
    data: {
      hcp: hcp !== undefined && hcp !== null && hcp !== '' ? parseFloat(hcp) : null,
    },
  })

  return NextResponse.json(player)
}
