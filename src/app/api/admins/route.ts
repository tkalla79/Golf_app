import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import bcrypt from 'bcryptjs'

export async function GET() {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admins = await prisma.admin.findMany({
    select: { id: true, email: true, firstName: true, lastName: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(admins)
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { email, password, firstName, lastName } = body

  if (!email || !password || !firstName || !lastName) {
    return NextResponse.json(
      { error: 'Wszystkie pola są wymagane' },
      { status: 400 }
    )
  }

  const existing = await prisma.admin.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json(
      { error: 'Admin z tym emailem już istnieje' },
      { status: 400 }
    )
  }

  const passwordHash = await bcrypt.hash(password, 10)

  const admin = await prisma.admin.create({
    data: { email, passwordHash, firstName, lastName },
    select: { id: true, email: true, firstName: true, lastName: true },
  })

  return NextResponse.json(admin, { status: 201 })
}

export async function DELETE(request: NextRequest) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await request.json()

  // Don't allow deleting self
  if (String(id) === session.user?.id) {
    return NextResponse.json(
      { error: 'Nie możesz usunąć samego siebie' },
      { status: 400 }
    )
  }

  await prisma.admin.delete({ where: { id: parseInt(id) } })

  return NextResponse.json({ success: true })
}
