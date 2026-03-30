import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ seasonId: string }> }
) {
  const { seasonId } = await params
  const id = parseInt(seasonId)
  if (isNaN(id)) return NextResponse.json({ error: 'Nieprawidłowe ID' }, { status: 400 })

  const docs = await prisma.seasonDocument.findMany({
    where: { seasonId: id },
    orderBy: { sortOrder: 'asc' },
  })
  return NextResponse.json(docs)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ seasonId: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { seasonId } = await params
  const id = parseInt(seasonId)
  if (isNaN(id)) return NextResponse.json({ error: 'Nieprawidłowe ID' }, { status: 400 })

  const body = await request.json()
  const { url, title, docType, sortOrder } = body

  if (!url || !title) {
    return NextResponse.json({ error: 'url i title są wymagane' }, { status: 400 })
  }

  const doc = await prisma.seasonDocument.create({
    data: {
      seasonId: id,
      url,
      title,
      docType: docType || 'image',
      sortOrder: sortOrder ? Number(sortOrder) : 0,
    },
  })

  return NextResponse.json(doc, { status: 201 })
}
