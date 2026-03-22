import { NextResponse } from 'next/server'
import { clearPlayerSession } from '@/lib/player-auth'

export async function POST() {
  await clearPlayerSession()
  return NextResponse.json({ success: true })
}
