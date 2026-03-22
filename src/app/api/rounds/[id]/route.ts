import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const roundId = parseInt(id)

  // Cascade delete handles groups, group_players, and matches
  await prisma.round.delete({ where: { id: roundId } })

  return NextResponse.json({ success: true })
}
