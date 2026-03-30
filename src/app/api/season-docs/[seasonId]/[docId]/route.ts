import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ seasonId: string; docId: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { docId } = await params
  const body = await request.json()
  const { title, sortOrder } = body

  const doc = await prisma.seasonDocument.update({
    where: { id: parseInt(docId) },
    data: {
      title: title ?? undefined,
      sortOrder: sortOrder !== undefined ? Number(sortOrder) : undefined,
    },
  })

  return NextResponse.json(doc)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ seasonId: string; docId: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { docId } = await params
  await prisma.seasonDocument.delete({ where: { id: parseInt(docId) } })

  return NextResponse.json({ success: true })
}
