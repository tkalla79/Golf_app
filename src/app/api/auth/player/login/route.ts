import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { createPlayerSession } from '@/lib/player-auth'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  const { email, password } = await request.json()

  if (!email || !password) {
    return NextResponse.json({ error: 'Podaj email i hasło' }, { status: 400 })
  }

  // Rate limit: 5 attempts per 15 minutes per email
  const { allowed, remainingAttempts } = checkRateLimit(`login:${email.toLowerCase()}`)
  if (!allowed) {
    return NextResponse.json(
      { error: 'Zbyt wiele prób logowania. Spróbuj ponownie za 15 minut.' },
      { status: 429 }
    )
  }

  const player = await prisma.player.findFirst({
    where: { email, active: true },
  })

  if (!player || !player.passwordHash) {
    return NextResponse.json({ error: 'Nieprawidłowy email lub hasło' }, { status: 401 })
  }

  const valid = await bcrypt.compare(password, player.passwordHash)
  if (!valid) {
    return NextResponse.json(
      { error: `Nieprawidłowy email lub hasło (pozostało prób: ${remainingAttempts})` },
      { status: 401 }
    )
  }

  await createPlayerSession(player.id, player.slug)

  return NextResponse.json({ success: true, slug: player.slug })
}
