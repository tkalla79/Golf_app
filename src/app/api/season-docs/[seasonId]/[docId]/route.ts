import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { unlink } from 'fs/promises'
import path from 'path'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ seasonId: string; docId: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { docId } = await params
  const id = parseInt(docId)
  if (isNaN(id)) return NextResponse.json({ error: 'Nieprawidłowe ID' }, { status: 400 })

  const body = await request.json()
  const { title, sortOrder } = body

  const doc = await prisma.seasonDocument.update({
    where: { id },
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
  const id = parseInt(docId)
  if (isNaN(id)) return NextResponse.json({ error: 'Nieprawidłowe ID' }, { status: 400 })

  const doc = await prisma.seasonDocument.findUnique({ where: { id } })
  if (!doc) return NextResponse.json({ error: 'Nie znaleziono' }, { status: 404 })

  await prisma.seasonDocument.delete({ where: { id } })

  // Clean up file from disk
  if (doc.url.startsWith('/api/uploads/')) {
    const relativePath = doc.url.replace('/api/uploads/', '')
    const filePath = path.join(process.cwd(), 'uploads', relativePath)
    try { await unlink(filePath) } catch { /* file may not exist */ }
  }

  return NextResponse.json({ success: true })
}
