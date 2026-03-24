import { prisma } from '@/lib/db'
import { computeStandings } from '@/lib/standings'
import Link from 'next/link'
import { PL } from '@/constants/pl'
import SeasonSelector from '@/components/SeasonSelector'

export const dynamic = 'force-dynamic'

export default async function GrupyPage({
  searchParams,
}: {
  searchParams: Promise<{ runda?: string; sezon?: string }>
}) {
  const params = await searchParams
  const requestedRound = params.runda ? parseInt(params.runda) : null
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
          {PL.nav.groups}
        </h1>
        <p className="mt-4 text-[var(--color-text-body)]">{PL.common.noData}</p>
      </div>
    )
  }

  // Fetch the selected season with its rounds
  const season = await prisma.season.findUnique({
    where: { id: selectedSeasonId },
    include: {
      rounds: {
        where: {
          type: 'ROUND_ROBIN',
          status: { in: ['ACTIVE', 'COMPLETED'] },
        },
        include: {
          groups: {
            orderBy: { sortOrder: 'asc' },
            include: {
              players: { include: { player: true } },
              matches: { include: { player1: true, player2: true } },
            },
          },
        },
        orderBy: { roundNumber: 'asc' },
      },
    },
  })

  const allRounds = season?.rounds ?? []

  // Select requested round, or active round, or latest completed
  let selectedRound = requestedRound
    ? allRounds.find(r => r.roundNumber === requestedRound)
    : allRounds.find(r => r.status === 'ACTIVE') ?? allRounds[allRounds.length - 1]

  if (!selectedRound || selectedRound.groups.length === 0) {
    return (
      <div className="text-center py-20">
        <h1 className="text-3xl font-bold text-[var(--color-primary)]" style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif' }}>
          {PL.nav.groups}
        </h1>
        <SeasonSelector seasons={allSeasons} currentSeasonId={selectedSeasonId} />
        <p className="mt-4 text-[var(--color-text-body)]">{PL.common.noData}</p>
      </div>
    )
  }

  // Build round tab href preserving season param
  const roundHref = (roundNumber: number) => {
    const p = new URLSearchParams()
    if (requestedSeasonId) p.set('sezon', String(requestedSeasonId))
    p.set('runda', String(roundNumber))
    return `/grupy?${p.toString()}`
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 flex-wrap">
          <h1 className="text-4xl font-bold text-[var(--color-primary)]" style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif' }}>
            {season!.name}
          </h1>
          <SeasonSelector seasons={allSeasons} currentSeasonId={selectedSeasonId} />
        </div>
        <div className="flex items-center gap-3 mt-3">
          <span className="inline-block w-12 h-0.5 bg-[var(--color-accent)]"></span>
          <p className="text-[var(--color-text-body)] font-medium">
            {selectedRound.name}
            {selectedRound.dateStart && selectedRound.dateEnd && (
              <span className="ml-2 text-sm text-[var(--color-text-body)]/60">
                {new Date(selectedRound.dateStart).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' })}
                {' '}&ndash;{' '}
                {new Date(selectedRound.dateEnd).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Round tabs */}
      {allRounds.length > 1 && (
        <div className="flex gap-1 mb-8 border-b-2 border-[var(--color-border)] overflow-x-auto">
          {allRounds.map((round) => (
            <Link
              key={round.id}
              href={roundHref(round.roundNumber)}
              className={`px-4 py-2.5 font-bold text-sm uppercase tracking-wide border-b-[3px] -mb-[2px] transition-colors whitespace-nowrap ${
                round.id === selectedRound!.id
                  ? 'text-[var(--color-primary)] border-[var(--color-accent)]'
                  : 'text-[var(--color-text-body)]/40 border-transparent hover:text-[var(--color-primary)]'
              }`}
              style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif' }}
            >
              {round.name}
              {round.status === 'ACTIVE' && (
                <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-success)] align-middle" />
              )}
            </Link>
          ))}
        </div>
      )}

      {/* Groups grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {selectedRound.groups.map((group) => {
          const standings = computeStandings(group.players, group.matches)
          const playedCount = group.matches.filter((m) => m.played).length
          const totalMatches = group.matches.length

          return (
            <Link
              key={group.id}
              href={`/grupa/${group.id}`}
              className="card card-clickable p-0 overflow-hidden block"
            >
              {/* Group header */}
              <div className="bg-[var(--color-primary)] px-5 py-3 flex justify-between items-center">
                <h2 className="text-white font-bold tracking-wide" style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif' }}>
                  {group.name}
                </h2>
                <span className="text-white/50 text-xs font-medium">
                  {playedCount}/{totalMatches} meczów
                </span>
              </div>

              {/* Mini standings */}
              <div className="p-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[var(--color-text-body)]/50 text-xs uppercase tracking-wider">
                      <th className="text-left py-1.5 font-semibold">#</th>
                      <th className="text-left py-1.5 font-semibold">{PL.standings.player}</th>
                      <th className="text-center py-1.5 font-semibold">{PL.standings.bigPoints}</th>
                      <th className="text-center py-1.5 font-semibold">{PL.standings.smallPoints}</th>
                      <th className="text-center py-1.5 font-semibold">🐦</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((s, i) => (
                      <tr
                        key={s.playerId}
                        className={`border-t border-[var(--color-border)] ${
                          i === 0 ? 'bg-[var(--color-primary)]/[0.03]' : ''
                        }`}
                      >
                        <td className="py-2 text-[var(--color-primary)] font-bold text-xs w-6">
                          {s.position}
                        </td>
                        <td className="py-2 font-medium text-[var(--color-text-dark)]">
                          {s.firstName} {s.lastName}
                        </td>
                        <td className="py-2 text-center">
                          <span className="font-bold text-[var(--color-primary)]">{s.bigPoints}</span>
                        </td>
                        <td className="py-2 text-center text-sm text-[var(--color-text-body)]/60">
                          {s.smallPoints > 0 ? `+${s.smallPoints}` : s.smallPoints}
                        </td>
                        <td className="py-2 text-center text-sm text-[var(--color-text-body)]/60">
                          {s.birdies || 0}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
