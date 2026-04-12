// src/app/(public)/playoff/page.tsx
import type { Metadata } from 'next'
import { prisma } from '@/lib/db'
import { PL } from '@/constants/pl'
import { buildBracketSlots, BRACKET_NAMES } from '@/lib/playoff'
import PlayoffBracket from '@/components/PlayoffBracket'
import SeasonSelector from '@/components/SeasonSelector'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Playoff | Don Papa Match Play',
  description: 'Drabinki playoff ligi golfowej Don Papa Match Play - Karolinka Golf Park',
}

export default async function PlayoffPage({
  searchParams,
}: {
  searchParams: Promise<{ sezon?: string }>
}) {
  const params = await searchParams
  const requestedSeasonId = params.sezon ? parseInt(params.sezon) : null

  // Fetch all seasons for the selector
  const allSeasons = await prisma.season.findMany({
    orderBy: { year: 'desc' },
    select: { id: true, name: true, year: true, status: true },
  })

  // Determine which season to show
  const activeSeason = allSeasons.find(s => s.status === 'ACTIVE')
  const selectedSeasonId = requestedSeasonId ?? activeSeason?.id

  if (!selectedSeasonId) {
    return (
      <div className="text-center py-20">
        <h1 className="text-3xl font-bold text-[var(--color-primary)]" style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif' }}>
          {PL.playoff.title}
        </h1>
        <p className="mt-4 text-[var(--color-text-body)]">{PL.playoff.noPlayoff}</p>
      </div>
    )
  }

  // Fetch the selected season with playoff rounds
  const season = await prisma.season.findUnique({
    where: { id: selectedSeasonId },
    include: {
      rounds: {
        where: { type: 'PLAYOFF' },
        include: {
          groups: {
            orderBy: { sortOrder: 'asc' },
          },
        },
      },
    },
  })

  const playoffRound = season?.rounds[0]

  if (!playoffRound || playoffRound.groups.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <h1 className="text-3xl font-bold text-[var(--color-primary)]" style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif' }}>
            {PL.playoff.title}
          </h1>
          <SeasonSelector seasons={allSeasons} currentSeasonId={selectedSeasonId} />
        </div>
        <p className="mt-4 text-[var(--color-text-body)]">{PL.playoff.noPlayoff}</p>
      </div>
    )
  }

  // Build bracket data for each group
  const brackets = await Promise.all(
    playoffRound.groups.map(async (group, idx) => {
      const slots = await buildBracketSlots(group.id)
      return {
        groupId: group.id,
        name: group.name,
        bracketKey: BRACKET_NAMES[idx] ?? '',
        slots: JSON.parse(JSON.stringify(slots)), // serialize for client component
      }
    })
  )

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 flex-wrap">
          <h1 className="text-4xl font-bold text-[var(--color-primary)]" style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif' }}>
            {PL.playoff.title} {season!.year}
          </h1>
          <SeasonSelector seasons={allSeasons} currentSeasonId={selectedSeasonId} />
        </div>
        <div className="flex items-center gap-3 mt-3">
          <span className="inline-block w-12 h-0.5 bg-[var(--color-accent)]"></span>
          <p className="text-[var(--color-text-body)] font-medium">
            {season!.name} &middot; Karolinka Golf Park
          </p>
        </div>
      </div>

      <PlayoffBracket brackets={brackets} />
    </div>
  )
}
