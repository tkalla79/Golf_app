import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createPlayerSession } from '@/lib/player-auth'

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')

  if (!token) {
    return NextResponse.redirect(new URL('/auth/player?error=no-token', request.url))
  }

  const player = await prisma.player.findUnique({
    where: { loginToken: token },
  })

  if (!player || !player.loginTokenExpiry || player.loginTokenExpiry < new Date()) {
    return NextResponse.redirect(new URL('/auth/player?error=expired', request.url))
  }

  // Token valid - clear it
  await prisma.player.update({
    where: { id: player.id },
    data: { loginToken: null, loginTokenExpiry: null },
  })

  // Create session
  await createPlayerSession(player.id, player.slug)

  return NextResponse.redirect(new URL(`/zawodnik/${player.slug}`, request.url))
}
