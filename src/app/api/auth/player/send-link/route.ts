import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { randomBytes } from 'crypto'
import { sendLoginEmail } from '@/lib/mail'

export async function POST(request: NextRequest) {
  const { playerId } = await request.json()

  const player = await prisma.player.findUnique({ where: { id: playerId } })
  if (!player || !player.email) {
    return NextResponse.json({ error: 'Gracz nie znaleziony lub brak emaila' }, { status: 400 })
  }

  // Generate token
  const token = randomBytes(32).toString('hex')
  const expiry = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

  await prisma.player.update({
    where: { id: playerId },
    data: { loginToken: token, loginTokenExpiry: expiry },
  })

  // Build login URL
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const loginUrl = `${baseUrl}/api/auth/player/verify?token=${token}`

  try {
    await sendLoginEmail(player.email, loginUrl, player.firstName)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Email send error:', error)
    return NextResponse.json({ error: 'Nie udało się wysłać emaila' }, { status: 500 })
  }
}
