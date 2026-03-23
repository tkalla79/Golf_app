import { prisma } from '@/lib/db'
import { PL } from '@/constants/pl'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPlayerSession } from '@/lib/player-auth'
import PlayerProfileEditor from '@/components/PlayerProfileEditor'

export const dynamic = 'force-dynamic'

export default async function ZawodnikPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug: rawSlug } = await params
  const slug = decodeURIComponent(rawSlug)

  // Try exact slug first, then normalize Polish chars
  let player = await prisma.player.findUnique({ where: { slug } })

  if (!player) {
    const POLISH: Record<string, string> = {
      'ą':'a','ć':'c','ę':'e','ł':'l','ń':'n','ó':'o','ś':'s','ź':'z','ż':'z',
    }
    const normalized = slug.toLowerCase().replace(/[ąćęłńóśźż]/g, (c) => POLISH[c] || c)
    player = await prisma.player.findUnique({ where: { slug: normalized } })
  }

  if (!player) return notFound()

  const playerSession = await getPlayerSession()
  const isLoggedIn = playerSession?.playerId === player.id

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

      {/* Player header with login/edit */}
      <PlayerProfileEditor
        playerId={player.id}
        slug={player.slug}
        firstName={player.firstName}
        lastName={player.lastName}
        hcp={player.hcp ? Number(player.hcp) : null}
        email={player.email}
        phone={player.phone}
        avatarUrl={player.avatarUrl}
        isLoggedIn={isLoggedIn}
        isAnyPlayerLoggedIn={!!playerSession}
        hasPassword={!!player.passwordHash}
      />

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
