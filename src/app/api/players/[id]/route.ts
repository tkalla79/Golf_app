import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const player = await prisma.player.findUnique({
    where: { id: parseInt(id) },
  })

  if (!player) {
    return NextResponse.json({ error: 'Nie znaleziono' }, { status: 404 })
  }

  return NextResponse.json(player)
}

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
  const { firstName, lastName, email, phone, hcp } = body

  const player = await prisma.player.update({
    where: { id: parseInt(id) },
    data: {
      ...(firstName && { firstName }),
      ...(lastName && { lastName }),
      email: email || null,
      phone: phone || null,
      hcp: hcp !== undefined && hcp !== null && hcp !== '' ? parseFloat(hcp) : null,
    },
  })

  return NextResponse.json(player)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  await prisma.player.update({
    where: { id: parseInt(id) },
    data: { active: false },
  })

  return NextResponse.json({ success: true })
}
