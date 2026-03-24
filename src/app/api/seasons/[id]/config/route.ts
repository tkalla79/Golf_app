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

function isValidConfig(config: unknown): config is SeasonConfig {
  if (!config || typeof config !== 'object') return false
  const c = config as Record<string, unknown>

  // Validate scoring object
  if (!c.scoring || typeof c.scoring !== 'object') return false
  const s = c.scoring as Record<string, unknown>
  const requiredScoring = ['win', 'draw', 'loss', 'unplayed', 'walkover_winner', 'walkover_loser']
  for (const key of requiredScoring) {
    if (typeof s[key] !== 'number') return false
  }

  // Validate small_points_map
  if (!c.small_points_map || typeof c.small_points_map !== 'object') return false
  const spm = c.small_points_map as Record<string, unknown>
  for (const [key, val] of Object.entries(spm)) {
    if (typeof key !== 'string') return false
    if (!Array.isArray(val) || val.length !== 2) return false
    if (typeof val[0] !== 'number' || typeof val[1] !== 'number') return false
  }

  // Reject any extra top-level keys
  const allowedKeys = ['scoring', 'small_points_map']
  for (const key of Object.keys(c)) {
    if (!allowedKeys.includes(key)) return false
  }

  return true
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const config = await request.json()

  if (!isValidConfig(config)) {
    return NextResponse.json({ error: 'Nieprawidłowa struktura konfiguracji' }, { status: 400 })
  }

  // Only save validated scoring and small_points_map (strip anything else)
  const safeConfig = {
    scoring: config.scoring,
    small_points_map: config.small_points_map,
  }

  await prisma.season.update({
    where: { id: parseInt(id) },
    data: { config: JSON.parse(JSON.stringify(safeConfig)) },
  })

  return NextResponse.json({ success: true })
}
