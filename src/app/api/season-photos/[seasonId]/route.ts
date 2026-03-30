import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ seasonId: string }> }
) {
  const { seasonId } = await params
  const photos = await prisma.seasonPhoto.findMany({
    where: { seasonId: parseInt(seasonId) },
    orderBy: { sortOrder: 'asc' },
  })
  return NextResponse.json(photos)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ seasonId: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { seasonId } = await params
  const body = await request.json()
  const { url, caption, sortOrder } = body

  if (!url) {
    return NextResponse.json({ error: 'url jest wymagany' }, { status: 400 })
  }

  const photo = await prisma.seasonPhoto.create({
    data: {
      seasonId: parseInt(seasonId),
      url,
      caption: caption || null,
      sortOrder: sortOrder ? Number(sortOrder) : 0,
    },
  })

  return NextResponse.json(photo, { status: 201 })
}
