import { prisma } from '@/lib/db'
import { PL } from '@/constants/pl'
import Link from 'next/link'
import { getSeasonHighlights } from '@/lib/season-stats'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: `${PL.previousSeasons.title} | Don Papa Match Play`,
  description: PL.previousSeasons.subtitle,
}

export default async function PoprzedneSezonyPage() {
  const seasons = await prisma.season.findMany({
    where: { status: 'COMPLETED' },
    orderBy: { year: 'desc' },
    include: {
      rounds: {
        where: { type: 'ROUND_ROBIN' },
        include: {
          groups: {
            include: {
              players: { select: { playerId: true } },
            },
          },
        },
      },
      _count: { select: { photos: true } },
    },
  })

  // Fetch highlights for each season in parallel — cheap for a short list of COMPLETED seasons.
  const highlightsMap = new Map(
    (
      await Promise.all(
        seasons.map(async (s) => [s.id, await getSeasonHighlights(s.id)] as const),
      )
    ),
  )

  return (
    <div>
      {/* Header */}
      <div className="mb-10">
        <h1
          className="text-3xl font-bold text-[var(--color-text-dark)] mb-3"
          style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif' }}
        >
          {PL.previousSeasons.title}
        </h1>
        <span className="inline-block w-12 h-0.5 bg-[var(--color-accent)] mb-4" />
        <p className="text-[var(--color-text-body)]">{PL.previousSeasons.subtitle}</p>
      </div>

      {seasons.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-[var(--color-text-body)]/50 italic">
            {PL.previousSeasons.noCompletedSeasons}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {seasons.map((season) => {
            const playerIds = new Set<number>()
            for (const round of season.rounds) {
              for (const group of round.groups) {
                for (const gp of group.players) {
                  playerIds.add(gp.playerId)
                }
              }
            }
            const uniquePlayers = playerIds.size

            return (
              <Link
                key={season.id}
                href={`/poprzednie-sezony/${season.id}`}
                className="card card-clickable p-0 overflow-hidden block"
              >
                {/* Gold accent top bar */}
                <div className="h-1 bg-[var(--color-accent)]" />

                {/* Season header */}
                <div className="bg-[var(--color-primary)] px-5 py-4">
                  <div className="flex items-center justify-between">
                    <h2
                      className="text-white font-bold text-lg"
                      style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif' }}
                    >
                      {season.name}
                    </h2>
                    <span className="text-[var(--color-accent)] font-bold text-2xl">
                      {season.year}
                    </span>
                  </div>
                </div>

                {/* Stats */}
                <div className="p-5">
                  <div className="flex gap-6 text-sm">
                    <div>
                      <div className="text-[var(--color-text-body)]/50 text-xs uppercase tracking-wide mb-0.5">
                        {PL.previousSeasons.rounds}
                      </div>
                      <div className="font-bold text-[var(--color-primary)] text-lg">
                        {season.rounds.length}
                      </div>
                    </div>
                    <div>
                      <div className="text-[var(--color-text-body)]/50 text-xs uppercase tracking-wide mb-0.5">
                        {PL.previousSeasons.players}
                      </div>
                      <div className="font-bold text-[var(--color-primary)] text-lg">
                        {uniquePlayers}
                      </div>
                    </div>
                    {season._count.photos > 0 && (
                      <div>
                        <div className="text-[var(--color-text-body)]/50 text-xs uppercase tracking-wide mb-0.5">
                          {PL.previousSeasons.photos}
                        </div>
                        <div className="font-bold text-[var(--color-accent)] text-lg flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {season._count.photos}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Season teaser highlights — champion + top scorer */}
                  {(() => {
                    const h = highlightsMap.get(season.id)
                    if (!h || h.playedMatches === 0) return null
                    const topChampion = h.champions[0]
                    const topBirdie = h.topBirdieScorers[0]
                    return (
                      <div className="mt-4 pt-4 border-t border-[var(--color-text-body)]/10 space-y-1.5">
                        {topChampion && (
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-[var(--color-accent)]">🏆</span>
                            <span className="text-[var(--color-text-body)]/60">
                              {PL.previousSeasons.champion}:
                            </span>
                            <span className="font-semibold text-[var(--color-text-dark)]">
                              {topChampion.championName}
                            </span>
                          </div>
                        )}
                        {topBirdie && (
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-[var(--color-success)]">🎯</span>
                            <span className="text-[var(--color-text-body)]/60">
                              {PL.previousSeasons.topBirdie}:
                            </span>
                            <span className="font-semibold text-[var(--color-text-dark)]">
                              {topBirdie.playerName}
                            </span>
                            <span className="text-[var(--color-text-body)]/50">
                              ({topBirdie.value})
                            </span>
                          </div>
                        )}
                      </div>
                    )
                  })()}

                  <div className="mt-4 text-xs text-[var(--color-primary)] font-semibold flex items-center gap-1">
                    {PL.previousSeasons.viewResults} &rarr;
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
