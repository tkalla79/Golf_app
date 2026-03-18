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

  // Get active season
  const activeSeason = await prisma.season.findFirst({
    where: { status: 'ACTIVE' },
  })

  // Get all matches for this player in the active season
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
      <div className="mb-2">
        <Link href="/zawodnicy" className="text-sm text-[var(--color-primary)] hover:underline">
          &larr; {PL.common.back}
        </Link>
      </div>

      {/* Player header */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h1 className="text-3xl font-bold text-[var(--color-primary)]">
          {player.firstName} {player.lastName}
        </h1>
        <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-600">
          {player.hcp !== null && (
            <span>
              <strong>{PL.standings.hcp}:</strong> {Number(player.hcp).toFixed(1)}
            </span>
          )}
          {player.email && (
            <span>
              <strong>{PL.player.email}:</strong> {player.email}
            </span>
          )}
          {player.phone && (
            <span>
              <strong>{PL.player.phone}:</strong> {player.phone}
            </span>
          )}
        </div>
      </div>

      {/* Upcoming matches */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-bold text-gray-700 mb-4">
          {PL.player.upcomingMatches}
        </h2>
        {upcomingMatches.length === 0 ? (
          <p className="text-gray-500">{PL.player.noUpcoming}</p>
        ) : (
          <div className="space-y-2">
            {upcomingMatches.map((match) => {
              const opponent =
                match.player1Id === player.id ? match.player2 : match.player1

              return (
                <div
                  key={match.id}
                  className="flex items-center justify-between py-3 px-4 bg-yellow-50 rounded border border-yellow-200"
                >
                  <div>
                    <span className="font-medium">
                      {PL.match.vs}{' '}
                      <Link
                        href={`/zawodnik/${opponent.slug}`}
                        className="text-[var(--color-primary)] hover:underline"
                      >
                        {opponent.firstName} {opponent.lastName}
                      </Link>
                    </span>
                  </div>
                  <div className="text-sm text-gray-500">
                    <Link
                      href={`/grupa/${match.groupId}`}
                      className="hover:underline"
                    >
                      {match.group.round.name} &middot; {match.group.name}
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Match history */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-700 mb-4">
          {PL.player.matchHistory}
        </h2>
        {playedMatches.length === 0 ? (
          <p className="text-gray-500">{PL.player.noHistory}</p>
        ) : (
          <div className="space-y-2">
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
                  className={`flex items-center justify-between py-3 px-4 rounded border ${
                    won
                      ? 'bg-green-50 border-green-200'
                      : lost
                      ? 'bg-red-50 border-red-200'
                      : drawn
                      ? 'bg-yellow-50 border-yellow-200'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex-1">
                    <span className="font-medium">
                      {PL.match.vs}{' '}
                      <Link
                        href={`/zawodnik/${opponent.slug}`}
                        className="text-[var(--color-primary)] hover:underline"
                      >
                        {opponent.firstName} {opponent.lastName}
                      </Link>
                    </span>
                    <div className="text-xs text-gray-500 mt-1">
                      {match.group.round.name}
                    </div>
                  </div>
                  <div className="text-center mx-4">
                    <span
                      className={`text-sm font-bold px-2 py-1 rounded ${
                        won
                          ? 'bg-green-200 text-green-800'
                          : lost
                          ? 'bg-red-200 text-red-800'
                          : 'bg-yellow-200 text-yellow-800'
                      }`}
                    >
                      {match.isWalkover ? 'W/O' : match.resultCode}
                    </span>
                  </div>
                  <div className="text-right text-sm">
                    <span className="font-bold">{playerBigPts} pkt</span>
                    <span className="text-gray-500 ml-2">
                      ({playerSmallPts > 0 ? `+${playerSmallPts}` : playerSmallPts} m.pkt)
                    </span>
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
