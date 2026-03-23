import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getPlayerSession } from '@/lib/player-auth'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

export async function POST(request: NextRequest) {
  const session = await getPlayerSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('avatar') as File | null

  if (!file) {
    return NextResponse.json({ error: 'Brak pliku' }, { status: 400 })
  }

  // Validate file type
  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'Plik musi być obrazem' }, { status: 400 })
  }

  // Max 5MB
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'Plik jest za duży (max 5MB)' }, { status: 400 })
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const filename = `${session.slug}.${ext}`
  const uploadDir = path.join(process.cwd(), 'public', 'avatars')
  const filePath = path.join(uploadDir, filename)

  // Ensure directory exists
  await mkdir(uploadDir, { recursive: true })

  // Write file
  const bytes = await file.arrayBuffer()
  await writeFile(filePath, Buffer.from(bytes))

  const avatarUrl = `/api/avatars/${filename}`

  await prisma.player.update({
    where: { id: session.playerId },
    data: { avatarUrl },
  })

  return NextResponse.json({ avatarUrl })
}
