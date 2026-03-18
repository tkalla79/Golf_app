import { prisma } from '@/lib/db'
import { PL } from '@/constants/pl'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function ZawodnikPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const player = await prisma.player.findUnique({
    where: { slug },
  })

  if (!player) return notFound()

  const activeSeason = await prisma.season.findFirst({
    where: { status: 'ACTIVE' },
  })

  const matches = activeSeason
    ? await prisma.match.findMany({
        where: {
          group: { round: { seasonId: activeSeason.id } },
          OR: [{ player1Id: player.id }, { player2Id: player.id }],
        },
        include: {
          player1: true,
          player2: true,
          winner: true,
          group: { include: { round: true } },
        },
        orderBy: [{ group: { round: { roundNumber: 'asc' } } }, { id: 'asc' }],
      })
    : []

  const upcomingMatches = matches.filter((m) => !m.played)
  const playedMatches = matches.filter((m) => m.played)

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link href="/zawodnicy" className="text-sm text-[var(--color-primary)] hover:text-[var(--color-accent)] transition-colors font-medium">
          &larr; Wszyscy zawodnicy
        </Link>
      </div>

      {/* Player header */}
      <div className="card p-8 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[var(--color-primary)]" style={{ fontFamily: 'Raleway, sans-serif' }}>
              {player.firstName} {player.lastName}
            </h1>
            <div className="flex items-center gap-3 mt-2">
              <span className="inline-block w-8 h-0.5 bg-[var(--color-accent)]"></span>
              <span className="text-[var(--color-text-body)]/60 text-sm">Profil zawodnika</span>
            </div>
          </div>
          {player.hcp !== null && (
            <div className="bg-[var(--color-primary)] text-white px-6 py-3 rounded-lg text-center">
              <div className="text-xs uppercase tracking-wider text-white/60 font-semibold">HCP</div>
              <div className="text-2xl font-bold">{Number(player.hcp).toFixed(1)}</div>
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-6 text-sm text-[var(--color-text-body)]">
          {player.email && (
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-[var(--color-primary)]/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              {player.email}
            </div>
          )}
          {player.phone && (
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-[var(--color-primary)]/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              {player.phone}
            </div>
          )}
        </div>
      </div>

      {/* Upcoming matches */}
      <div className="card p-6 sm:p-8 mb-8">
        <h2 className="text-xl font-bold text-[var(--color-text-dark)] mb-6" style={{ fontFamily: 'Raleway, sans-serif' }}>
          {PL.player.upcomingMatches}
          {upcomingMatches.length > 0 && (
            <span className="ml-2 bg-[var(--color-accent)] text-[var(--color-primary-dark)] text-xs font-bold px-2 py-0.5 rounded-full">
              {upcomingMatches.length}
            </span>
          )}
        </h2>
        {upcomingMatches.length === 0 ? (
          <p className="text-[var(--color-text-body)]/50 italic">{PL.player.noUpcoming}</p>
        ) : (
          <div className="space-y-3">
            {upcomingMatches.map((match) => {
              const opponent =
                match.player1Id === player.id ? match.player2 : match.player1

              return (
                <div
                  key={match.id}
                  className="match-row border-[var(--color-accent)]/30 bg-[var(--color-accent)]/[0.04]"
                >
                  <div className="flex-1">
                    <span className="font-semibold text-[var(--color-text-dark)]">
                      vs{' '}
                      <Link
                        href={`/zawodnik/${opponent.slug}`}
                        className="text-[var(--color-primary)] hover:text-[var(--color-accent)] transition-colors"
                      >
                        {opponent.firstName} {opponent.lastName}
                      </Link>
                    </span>
                  </div>
                  <Link
                    href={`/grupa/${match.groupId}`}
                    className="text-xs text-[var(--color-text-body)]/50 hover:text-[var(--color-primary)] transition-colors"
                  >
                    {match.group.round.name} &middot; {match.group.name}
                  </Link>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Match history */}
      <div className="card p-6 sm:p-8">
        <h2 className="text-xl font-bold text-[var(--color-text-dark)] mb-6" style={{ fontFamily: 'Raleway, sans-serif' }}>
          {PL.player.matchHistory}
        </h2>
        {playedMatches.length === 0 ? (
          <p className="text-[var(--color-text-body)]/50 italic">{PL.player.noHistory}</p>
        ) : (
          <div className="space-y-3">
            {playedMatches.map((match) => {
              const opponent =
                match.player1Id === player.id ? match.player2 : match.player1
              const won = match.winnerId === player.id
              const lost = match.winnerId && match.winnerId !== player.id
              const drawn = match.played && !match.winnerId

              const playerBigPts =
                match.player1Id === player.id
                  ? match.player1BigPoints
                  : match.player2BigPoints
              const playerSmallPts =
                match.player1Id === player.id
                  ? match.player1SmallPoints
                  : match.player2SmallPoints

              return (
                <div
                  key={match.id}
                  className={`match-row ${
                    won
                      ? 'border-[var(--color-success)]/20 bg-[var(--color-success)]/[0.03]'
                      : lost
                      ? 'border-[var(--color-danger)]/20 bg-[var(--color-danger)]/[0.03]'
                      : drawn
                      ? 'border-[var(--color-accent)]/20 bg-[var(--color-accent)]/[0.03]'
                      : ''
                  }`}
                >
                  <div className="flex-1">
                    <span className="font-semibold text-[var(--color-text-dark)]">
                      vs{' '}
                      <Link
                        href={`/zawodnik/${opponent.slug}`}
                        className="text-[var(--color-primary)] hover:text-[var(--color-accent)] transition-colors"
                      >
                        {opponent.firstName} {opponent.lastName}
                      </Link>
                    </span>
                    <div className="text-xs text-[var(--color-text-body)]/40 mt-0.5">
                      {match.group.round.name}
                    </div>
                  </div>
                  <span className={`mx-3 ${
                    won ? 'badge-win' : drawn ? 'badge-draw' : match.isWalkover ? 'badge-walkover' : 'badge-win'
                  }`}>
                    {match.isWalkover ? 'W/O' : match.resultCode}
                  </span>
                  <div className="text-right text-sm min-w-[80px]">
                    <span className="font-bold text-[var(--color-primary)]">{playerBigPts} pkt</span>
                    <div className="text-xs text-[var(--color-text-body)]/40">
                      {playerSmallPts > 0 ? `+${playerSmallPts}` : playerSmallPts} m.pkt
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
