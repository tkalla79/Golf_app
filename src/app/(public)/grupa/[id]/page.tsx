import { prisma } from '@/lib/db'
import { computeStandings } from '@/lib/standings'
import { PL } from '@/constants/pl'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function GrupaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const groupId = parseInt(id)

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      round: { include: { season: true } },
      players: { include: { player: true }, orderBy: { createdAt: 'asc' } },
      matches: {
        include: { player1: true, player2: true, winner: true },
        orderBy: { id: 'asc' },
      },
    },
  })

  if (!group) return notFound()

  const standings = computeStandings(group.players, group.matches)
  const playedMatches = group.matches.filter((m) => m.played)
  const unplayedMatches = group.matches.filter((m) => !m.played)

  return (
    <div>
      <div className="mb-2">
        <Link href="/grupy" className="text-sm text-[var(--color-primary)] hover:underline">
          &larr; {PL.common.back}
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[var(--color-primary)]">
          {group.name}
        </h1>
        <p className="text-gray-600">
          {group.round.name} &middot; {group.round.season.name}
        </p>
      </div>

      {/* Standings table */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-8">
        <h2 className="text-lg font-bold mb-3 text-[var(--color-primary)]">
          {PL.group.standings}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-[var(--color-primary)] text-gray-600">
                <th className="text-left py-2 px-1">{PL.standings.position}</th>
                <th className="text-left py-2 px-1">{PL.standings.player}</th>
                <th className="text-center py-2 px-1">{PL.standings.played}</th>
                <th className="text-center py-2 px-1">{PL.standings.won}</th>
                <th className="text-center py-2 px-1">{PL.standings.drawn}</th>
                <th className="text-center py-2 px-1">{PL.standings.lost}</th>
                <th className="text-center py-2 px-1 font-bold">{PL.standings.bigPoints}</th>
                <th className="text-center py-2 px-1">{PL.standings.smallPoints}</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((s, i) => (
                <tr
                  key={s.playerId}
                  className={`border-b ${i < 1 ? 'bg-green-50' : ''}`}
                >
                  <td className="py-2 px-1 font-bold text-gray-400">{s.position}</td>
                  <td className="py-2 px-1">
                    <Link
                      href={`/zawodnik/${s.slug}`}
                      className="font-medium text-[var(--color-primary)] hover:underline"
                    >
                      {s.firstName} {s.lastName}
                    </Link>
                  </td>
                  <td className="py-2 px-1 text-center">{s.played}</td>
                  <td className="py-2 px-1 text-center text-green-600">{s.won}</td>
                  <td className="py-2 px-1 text-center text-yellow-600">{s.drawn}</td>
                  <td className="py-2 px-1 text-center text-red-600">{s.lost}</td>
                  <td className="py-2 px-1 text-center font-bold text-lg">{s.bigPoints}</td>
                  <td className="py-2 px-1 text-center text-gray-600">
                    {s.smallPoints > 0 ? `+${s.smallPoints}` : s.smallPoints}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Unplayed matches */}
      {unplayedMatches.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-4 mb-8">
          <h2 className="text-lg font-bold mb-3 text-gray-700">
            {PL.match.unplayed} ({unplayedMatches.length})
          </h2>
          <div className="space-y-2">
            {unplayedMatches.map((match) => (
              <div
                key={match.id}
                className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded"
              >
                <span className="font-medium">
                  {match.player1.firstName} {match.player1.lastName}
                </span>
                <span className="text-gray-400 text-sm mx-2">{PL.match.vs}</span>
                <span className="font-medium">
                  {match.player2.firstName} {match.player2.lastName}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Played matches */}
      {playedMatches.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-4">
          <h2 className="text-lg font-bold mb-3 text-gray-700">
            {PL.group.matches} ({playedMatches.length})
          </h2>
          <div className="space-y-2">
            {playedMatches.map((match) => {
              const p1Won = match.winnerId === match.player1Id
              const p2Won = match.winnerId === match.player2Id
              const isDraw = match.played && !match.winnerId

              return (
                <div
                  key={match.id}
                  className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded"
                >
                  <span
                    className={`font-medium ${p1Won ? 'text-green-700' : ''}`}
                  >
                    {match.player1.firstName} {match.player1.lastName}
                  </span>
                  <span
                    className={`text-sm font-bold px-3 py-1 rounded ${
                      isDraw
                        ? 'bg-yellow-100 text-yellow-700'
                        : match.isWalkover
                        ? 'bg-gray-200 text-gray-600'
                        : 'bg-[var(--color-primary)] text-white'
                    }`}
                  >
                    {match.isWalkover ? 'W/O' : match.resultCode}
                  </span>
                  <span
                    className={`font-medium ${p2Won ? 'text-green-700' : ''}`}
                  >
                    {match.player2.firstName} {match.player2.lastName}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
