import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ seasonId: string; photoId: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { photoId } = await params
  const body = await request.json()
  const { caption, sortOrder } = body

  const photo = await prisma.seasonPhoto.update({
    where: { id: parseInt(photoId) },
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
  await prisma.seasonPhoto.delete({ where: { id: parseInt(photoId) } })

  return NextResponse.json({ success: true })
}
