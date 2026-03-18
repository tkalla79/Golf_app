import { prisma } from '@/lib/db'
import { computeStandings } from '@/lib/standings'
import Link from 'next/link'
import { PL } from '@/constants/pl'

export const dynamic = 'force-dynamic'

export default async function GrupyPage() {
  const activeSeason = await prisma.season.findFirst({
    where: { status: 'ACTIVE' },
    include: {
      rounds: {
        where: { status: 'ACTIVE' },
        include: {
          groups: {
            orderBy: { sortOrder: 'asc' },
            include: {
              players: { include: { player: true } },
              matches: { include: { player1: true, player2: true } },
            },
          },
        },
        orderBy: { roundNumber: 'desc' },
        take: 1,
      },
    },
  })

  const activeRound = activeSeason?.rounds[0]

  if (!activeRound || activeRound.groups.length === 0) {
    return (
      <div className="text-center py-20">
        <h1 className="text-3xl font-bold text-[var(--color-primary)]" style={{ fontFamily: 'Raleway, sans-serif' }}>
          {PL.nav.groups}
        </h1>
        <p className="mt-4 text-[var(--color-text-body)]">{PL.common.noData}</p>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-4xl font-bold text-[var(--color-primary)]" style={{ fontFamily: 'Raleway, sans-serif' }}>
          {activeSeason!.name}
        </h1>
        <div className="flex items-center gap-3 mt-3">
          <span className="inline-block w-12 h-0.5 bg-[var(--color-accent)]"></span>
          <p className="text-[var(--color-text-body)] font-medium">
            {activeRound.name}
            {activeRound.dateStart && activeRound.dateEnd && (
              <span className="ml-2 text-sm text-[var(--color-text-body)]/60">
                {new Date(activeRound.dateStart).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' })}
                {' '}&ndash;{' '}
                {new Date(activeRound.dateEnd).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Groups grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {activeRound.groups.map((group) => {
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
                <h2 className="text-white font-bold tracking-wide" style={{ fontFamily: 'Raleway, sans-serif' }}>
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
