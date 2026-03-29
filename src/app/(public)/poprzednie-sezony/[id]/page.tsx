import { prisma } from '@/lib/db'
import { computeStandings } from '@/lib/standings'
import { PL } from '@/constants/pl'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import SeasonPhotoGallery from '@/components/SeasonPhotoGallery'

export const dynamic = 'force-dynamic'

export default async function PoprzedniSezonPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const seasonId = parseInt(id)
  if (isNaN(seasonId)) return notFound()

  const season = await prisma.season.findUnique({
    where: { id: seasonId, status: 'COMPLETED' },
    include: {
      rounds: {
        where: { type: 'ROUND_ROBIN' },
        orderBy: { roundNumber: 'asc' },
        include: {
          groups: {
            orderBy: { sortOrder: 'asc' },
            include: {
              players: { include: { player: true } },
              matches: { include: { player1: true, player2: true, winner: true } },
            },
          },
        },
      },
      photos: { orderBy: { sortOrder: 'asc' } },
    },
  })

  if (!season) return notFound()

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link
          href="/poprzednie-sezony"
          className="text-sm text-[var(--color-primary)] hover:text-[var(--color-accent)] transition-colors font-medium"
        >
          &larr; {PL.previousSeasons.title}
        </Link>
      </div>

      {/* Header */}
      <div className="mb-10">
        <div className="flex items-baseline gap-4">
          <h1
            className="text-3xl font-bold text-[var(--color-text-dark)]"
            style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif' }}
          >
            {season.name}
          </h1>
          <span className="text-[var(--color-accent)] font-bold text-2xl">{season.year}</span>
        </div>
        <span className="inline-block w-12 h-0.5 bg-[var(--color-accent)] mt-3" />
      </div>

      {/* Rounds */}
      {season.rounds.map((round) => (
        <div key={round.id} className="mb-12">
          <h2
            className="text-xl font-bold text-[var(--color-text-dark)] mb-6 pb-2 border-b-2 border-[var(--color-accent)]/30"
            style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif' }}
          >
            {round.name}
          </h2>

          <div className="space-y-8">
            {round.groups.map((group) => {
              const standings = computeStandings(group.players, group.matches)

              return (
                <div key={group.id} className="card p-0 overflow-hidden">
                  {/* Group header */}
                  <div className="bg-[var(--color-primary)] px-5 py-3">
                    <h3
                      className="text-white font-bold tracking-wide"
                      style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif' }}
                    >
                      {group.name}
                    </h3>
                  </div>

                  <div className="p-5">
                    {/* Standings */}
                    <h4 className="text-sm font-semibold text-[var(--color-text-body)]/60 uppercase tracking-wider mb-3">
                      {PL.previousSeasons.finalStandings}
                    </h4>
                    <div className="overflow-x-auto mb-6">
                      <table className="standings-table w-full text-sm">
                        <thead>
                          <tr>
                            <th>{PL.standings.position}</th>
                            <th className="text-left">{PL.standings.player}</th>
                            <th>{PL.standings.played}</th>
                            <th>{PL.standings.won}</th>
                            <th>{PL.standings.drawn}</th>
                            <th>{PL.standings.lost}</th>
                            <th>{PL.standings.bigPoints}</th>
                            <th>{PL.standings.smallPoints}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {standings.map((s, i) => (
                            <tr
                              key={s.playerId}
                              className={i === 0 ? 'bg-[var(--color-primary)]/[0.04]' : ''}
                            >
                              <td className="text-center font-bold text-[var(--color-primary)]">
                                {s.position}
                              </td>
                              <td>
                                <Link
                                  href={`/zawodnik/${s.slug}`}
                                  className="font-medium text-[var(--color-text-dark)] hover:text-[var(--color-accent)] transition-colors"
                                >
                                  {s.firstName} {s.lastName}
                                </Link>
                              </td>
                              <td className="text-center">{s.played}</td>
                              <td className="text-center">{s.won}</td>
                              <td className="text-center">{s.drawn}</td>
                              <td className="text-center">{s.lost}</td>
                              <td className="text-center font-bold text-[var(--color-primary)]">
                                {s.bigPoints}
                              </td>
                              <td className="text-center text-[var(--color-text-body)]/60">
                                {s.smallPoints > 0 ? `+${s.smallPoints}` : s.smallPoints}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Played matches */}
                    {group.matches.filter(m => m.played).length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-[var(--color-text-body)]/60 uppercase tracking-wider mb-3">
                          {PL.previousSeasons.matchResults}
                        </h4>
                        <div className="space-y-2">
                          {group.matches.filter(m => m.played).map((match) => (
                            <div key={match.id} className="match-row text-sm">
                              <span className="flex-1">
                                <Link href={`/zawodnik/${match.player1.slug}`} className="text-[var(--color-primary)] hover:text-[var(--color-accent)]">
                                  {match.player1.firstName} {match.player1.lastName}
                                </Link>
                                <span className="text-[var(--color-text-body)]/40 mx-2">vs</span>
                                <Link href={`/zawodnik/${match.player2.slug}`} className="text-[var(--color-primary)] hover:text-[var(--color-accent)]">
                                  {match.player2.firstName} {match.player2.lastName}
                                </Link>
                              </span>
                              <span className={match.winnerId ? 'badge-win' : 'badge-draw'}>
                                {match.isWalkover ? 'W/O' : (match.resultCode ?? 'Remis')}
                              </span>
                              {match.winner && (
                                <span className="text-xs text-[var(--color-success)] font-medium ml-2">
                                  {match.winner.firstName} {match.winner.lastName}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* Photo gallery */}
      <div className="mt-12">
        <h2
          className="text-xl font-bold text-[var(--color-text-dark)] mb-6 pb-2 border-b-2 border-[var(--color-accent)]/30"
          style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif' }}
        >
          {PL.previousSeasons.gallery}
        </h2>
        {season.photos.length === 0 ? (
          <p className="text-[var(--color-text-body)]/50 italic">{PL.previousSeasons.noPhotos}</p>
        ) : (
          <SeasonPhotoGallery photos={season.photos} />
        )}
      </div>
    </div>
  )
}
