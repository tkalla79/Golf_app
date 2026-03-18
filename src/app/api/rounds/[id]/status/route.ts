import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()
  const { status } = body

  if (!['DRAFT', 'ACTIVE', 'COMPLETED'].includes(status)) {
    return NextResponse.json({ error: 'Nieprawidłowy status' }, { status: 400 })
  }

  const round = await prisma.round.update({
    where: { id: parseInt(id) },
    data: { status },
  })

  return NextResponse.json(round)
}
