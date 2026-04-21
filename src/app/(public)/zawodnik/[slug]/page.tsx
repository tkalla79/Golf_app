import { prisma } from '@/lib/db'
import { PL } from '@/constants/pl'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPlayerSession } from '@/lib/player-auth'
import PlayerProfileEditor from '@/components/PlayerProfileEditor'
import MatchScheduler from '@/components/MatchScheduler'
import AvailabilityPanel from '@/components/AvailabilityPanel'
import CareerOverview from '@/components/CareerOverview'
import SeasonHistoryTable from '@/components/SeasonHistoryTable'

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

  // Find all unique group IDs from upcoming matches (for availability panel)
  const activeGroupIds = [...new Set(upcomingMatches.map((m) => m.groupId))]

  // Prepare upcoming matches data for AvailabilityPanel
  const upcomingMatchesForPanel = upcomingMatches.map((m) => ({
    id: m.id,
    player1Id: m.player1Id,
    player2Id: m.player2Id,
    player1: { id: m.player1.id, firstName: m.player1.firstName, lastName: m.player1.lastName, slug: m.player1.slug },
    player2: { id: m.player2.id, firstName: m.player2.firstName, lastName: m.player2.lastName, slug: m.player2.slug },
  }))

  // Total birdies in season
  const totalBirdies = playedMatches.reduce((sum, m) => {
    return sum + (m.player1Id === player.id ? m.player1Birdies : m.player2Birdies)
  }, 0)

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link href="/zawodnicy" className="text-sm text-[var(--color-primary)] hover:text-[var(--color-accent)] transition-colors font-medium">
          &larr; {PL.common.allPlayers}
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
        totalBirdies={totalBirdies}
      />

      {/* Career overview (hidden when no played matches) */}
      <CareerOverview playerId={player.id} />

      {/* Upcoming matches */}
      <div className="card p-6 sm:p-8 mb-8">
        <h2 className="text-xl font-bold text-[var(--color-text-dark)] mb-6" style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif' }}>
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
                  className="flex flex-col border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/[0.04] rounded-lg px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
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
                  {isLoggedIn && (
                    <MatchScheduler
                      matchId={match.id}
                      scheduledDate={match.scheduledDate}
                    />
                  )}
                  {!isLoggedIn && match.scheduledDate && (
                    <div className="mt-2">
                      <span className="inline-flex items-center gap-1.5 bg-[var(--color-accent)]/15 text-[var(--color-primary-dark)] text-xs font-semibold px-3 py-1 rounded-full border border-[var(--color-accent)]/30">
                        <svg className="w-3 h-3 text-[var(--color-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {new Date(match.scheduledDate).toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw', weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Availability panel */}
      {activeGroupIds.length > 0 && (
        <AvailabilityPanel
          playerId={player.id}
          isLoggedIn={isLoggedIn}
          upcomingMatches={upcomingMatchesForPanel}
          groupIds={activeGroupIds}
        />
      )}

      {/* Match history */}
      <div className="card p-6 sm:p-8">
        <h2 className="text-xl font-bold text-[var(--color-text-dark)] mb-6" style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif' }}>
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
                    <span className="font-semibold">
                      <span className={`text-xs font-bold mr-1.5 ${
                        won ? 'text-[var(--color-success)]' : lost ? 'text-[var(--color-danger)]' : 'text-[var(--color-accent)]'
                      }`}>
                        {won ? 'W' : lost ? 'L' : 'R'}
                      </span>
                      vs{' '}
                      <Link
                        href={`/zawodnik/${opponent.slug}`}
                        className={`hover:text-[var(--color-accent)] transition-colors ${
                          won ? 'text-[var(--color-success)]' : lost ? 'text-[var(--color-danger)]' : 'text-[var(--color-primary)]'
                        }`}
                      >
                        {opponent.firstName} {opponent.lastName}
                      </Link>
                    </span>
                    <div className="text-xs text-[var(--color-text-body)]/40 mt-0.5">
                      {match.group.round.name}
                    </div>
                  </div>
                  <span className={`mx-3 ${
                    won ? 'badge-win' : drawn ? 'badge-draw' : match.isWalkover ? 'badge-walkover' : 'badge-unplayed'
                  }`}>
                    {match.isWalkover ? 'W/O' : match.resultCode}
                  </span>
                  <div className="text-right text-sm min-w-[80px]">
                    <span className={`font-bold ${
                      won ? 'text-[var(--color-success)]' : lost ? 'text-[var(--color-danger)]' : 'text-[var(--color-accent)]'
                    }`}>{playerBigPts} pkt</span>
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

      {/* Season-by-season history (hidden when no historical seasons) */}
      <SeasonHistoryTable playerId={player.id} />
    </div>
  )
}
