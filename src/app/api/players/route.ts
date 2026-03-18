import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams.get('search')

  const players = await prisma.player.findMany({
    where: {
      active: true,
      ...(search
        ? {
            OR: [
              { firstName: { contains: search } },
              { lastName: { contains: search } },
            ],
          }
        : {}),
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  })

  return NextResponse.json(players)
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { firstName, lastName, email, phone, hcp } = body

  if (!firstName || !lastName) {
    return NextResponse.json(
      { error: 'Imię i nazwisko są wymagane' },
      { status: 400 }
    )
  }

  const slug = `${firstName}-${lastName}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')

  // Check for duplicate slug
  let finalSlug = slug
  const existing = await prisma.player.findUnique({ where: { slug } })
  if (existing) {
    finalSlug = `${slug}-${Date.now()}`
  }

  const player = await prisma.player.create({
    data: {
      firstName,
      lastName,
      email: email || null,
      phone: phone || null,
      hcp: hcp !== undefined && hcp !== null && hcp !== '' ? parseFloat(hcp) : null,
      slug: finalSlug,
    },
  })

  return NextResponse.json(player, { status: 201 })
}
