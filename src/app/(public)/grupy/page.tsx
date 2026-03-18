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
      <div className="text-center py-16">
        <h1 className="text-2xl font-bold text-gray-700">{PL.nav.groups}</h1>
        <p className="mt-4 text-gray-500">{PL.common.noData}</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[var(--color-primary)]">
          {activeSeason!.name}
        </h1>
        <p className="text-gray-600 mt-1">
          {activeRound.name}
          {activeRound.dateStart && activeRound.dateEnd && (
            <span className="ml-2 text-sm">
              ({new Date(activeRound.dateStart).toLocaleDateString('pl-PL')} &ndash;{' '}
              {new Date(activeRound.dateEnd).toLocaleDateString('pl-PL')})
            </span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {activeRound.groups.map((group) => {
          const standings = computeStandings(group.players, group.matches)
          const playedCount = group.matches.filter((m) => m.played).length
          const totalMatches = group.matches.length

          return (
            <Link
              key={group.id}
              href={`/grupa/${group.id}`}
              className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-4 border border-gray-100"
            >
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-lg font-bold text-[var(--color-primary)]">
                  {group.name}
                </h2>
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                  {playedCount}/{totalMatches} meczów
                </span>
              </div>

              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-gray-500 text-xs">
                    <th className="text-left py-1">{PL.standings.position}</th>
                    <th className="text-left py-1">{PL.standings.player}</th>
                    <th className="text-center py-1">{PL.standings.bigPoints}</th>
                    <th className="text-center py-1">{PL.standings.smallPoints}</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((s) => (
                    <tr key={s.playerId} className="border-b border-gray-50">
                      <td className="py-1 text-gray-400">{s.position}</td>
                      <td className="py-1 font-medium">
                        {s.firstName} {s.lastName}
                      </td>
                      <td className="py-1 text-center font-bold">{s.bigPoints}</td>
                      <td className="py-1 text-center text-gray-600">
                        {s.smallPoints > 0 ? `+${s.smallPoints}` : s.smallPoints}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
