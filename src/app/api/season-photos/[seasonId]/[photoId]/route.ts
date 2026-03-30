import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { unlink } from 'fs/promises'
import path from 'path'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ seasonId: string; photoId: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { photoId } = await params
  const id = parseInt(photoId)
  if (isNaN(id)) return NextResponse.json({ error: 'Nieprawidłowe ID' }, { status: 400 })

  const body = await request.json()
  const { caption, sortOrder } = body

  const photo = await prisma.seasonPhoto.update({
    where: { id },
    data: {
      caption: caption ?? undefined,
      sortOrder: sortOrder !== undefined ? Number(sortOrder) : undefined,
    },
  })

  return NextResponse.json(photo)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ seasonId: string; photoId: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { photoId } = await params
  const id = parseInt(photoId)
  if (isNaN(id)) return NextResponse.json({ error: 'Nieprawidłowe ID' }, { status: 400 })

  const photo = await prisma.seasonPhoto.findUnique({ where: { id } })
  if (!photo) return NextResponse.json({ error: 'Nie znaleziono' }, { status: 404 })

  await prisma.seasonPhoto.delete({ where: { id } })

  // Clean up file from disk
  if (photo.url.startsWith('/api/uploads/')) {
    const relativePath = photo.url.replace('/api/uploads/', '')
    const filePath = path.join(process.cwd(), 'uploads', relativePath)
    try { await unlink(filePath) } catch { /* file may not exist */ }
  }

  return NextResponse.json({ success: true })
}
