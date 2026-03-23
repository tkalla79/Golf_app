import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { DEFAULT_SEASON_CONFIG, SeasonConfig } from '@/lib/scoring'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const season = await prisma.season.findUnique({ where: { id: parseInt(id) } })
  if (!season) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const config = (season.config as unknown as SeasonConfig) || DEFAULT_SEASON_CONFIG
  return NextResponse.json(config)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const config = await request.json() as SeasonConfig

  // Basic validation
  if (!config.scoring || !config.small_points_map) {
    return NextResponse.json({ error: 'Invalid config structure' }, { status: 400 })
  }

  await prisma.season.update({
    where: { id: parseInt(id) },
    data: { config: config as any },
  })

  return NextResponse.json({ success: true })
}
