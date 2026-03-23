import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { createPlayerSession } from '@/lib/player-auth'

export async function POST(request: NextRequest) {
  const { email, password } = await request.json()

  if (!email || !password) {
    return NextResponse.json({ error: 'Podaj email i hasło' }, { status: 400 })
  }

  const player = await prisma.player.findFirst({
    where: { email, active: true },
  })

  if (!player || !player.passwordHash) {
    return NextResponse.json({ error: 'Nieprawidłowy email lub hasło' }, { status: 401 })
  }

  const valid = await bcrypt.compare(password, player.passwordHash)
  if (!valid) {
    return NextResponse.json({ error: 'Nieprawidłowy email lub hasło' }, { status: 401 })
  }

  await createPlayerSession(player.id, player.slug)

  return NextResponse.json({ success: true, slug: player.slug })
}
