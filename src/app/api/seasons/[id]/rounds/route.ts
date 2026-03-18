import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()
  const { name, roundNumber, holes, dateStart, dateEnd } = body

  const round = await prisma.round.create({
    data: {
      seasonId: parseInt(id),
      name,
      roundNumber: parseInt(roundNumber),
      holes: parseInt(holes) || 9,
      dateStart: dateStart ? new Date(dateStart) : null,
      dateEnd: dateEnd ? new Date(dateEnd) : null,
      status: 'DRAFT',
    },
  })

  return NextResponse.json(round, { status: 201 })
}
