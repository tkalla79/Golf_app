import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { getPlayerSession } from '@/lib/player-auth'

export async function POST(request: Request) {
  const session = await getPlayerSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { password } = await request.json()

  if (!password || password.length < 6) {
    return NextResponse.json({ error: 'Hasło musi mieć minimum 6 znaków' }, { status: 400 })
  }

  const passwordHash = await bcrypt.hash(password, 12)

  await prisma.player.update({
    where: { id: session.playerId },
    data: { passwordHash },
  })

  return NextResponse.json({ success: true })
}
