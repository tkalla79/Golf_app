import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'

const SECRET = new TextEncoder().encode(process.env.NEXTAUTH_SECRET || 'fallback-secret')
const COOKIE_NAME = 'player-session'

export async function createPlayerSession(playerId: number, slug: string) {
  const token = await new SignJWT({ playerId, slug })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d')
    .sign(SECRET)

  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60, // 30 days
    path: '/',
  })
}

export async function getPlayerSession(): Promise<{ playerId: number; slug: string } | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, SECRET)
    return { playerId: payload.playerId as number, slug: payload.slug as string }
  } catch {
    return null
  }
}

export async function clearPlayerSession() {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}
