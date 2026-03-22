import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getPlayerSession } from '@/lib/player-auth'

export async function POST(request: NextRequest) {
  const session = await getPlayerSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const data: Record<string, unknown> = {}

  if ('hcp' in body) {
    data.hcp = body.hcp !== undefined && body.hcp !== null && body.hcp !== '' ? parseFloat(body.hcp) : null
  }

  if ('email' in body) {
    data.email = body.email?.trim() || null
  }

  if ('phone' in body) {
    data.phone = body.phone?.trim() || null
  }

  const player = await prisma.player.update({
    where: { id: session.playerId },
    data,
  })

  return NextResponse.json(player)
}
