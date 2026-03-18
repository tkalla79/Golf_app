import { prisma } from '@/lib/db'
import { PL } from '@/constants/pl'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function ZawodnicyPage() {
  const players = await prisma.player.findMany({
    where: { active: true },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  })

  return (
    <div>
      <h1 className="text-3xl font-bold text-[var(--color-primary)] mb-6">
        {PL.nav.players}
      </h1>

      {players.length === 0 ? (
        <p className="text-gray-500">{PL.common.noData}</p>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--color-primary)] text-white">
                <th className="text-left py-3 px-4">{PL.standings.player}</th>
                <th className="text-center py-3 px-4 hidden md:table-cell">{PL.standings.hcp}</th>
                <th className="text-center py-3 px-4 hidden md:table-cell">{PL.player.email}</th>
              </tr>
            </thead>
            <tbody>
              {players.map((player, i) => (
                <tr
                  key={player.id}
                  className={`border-b hover:bg-green-50 transition-colors ${
                    i % 2 === 0 ? 'bg-gray-50' : ''
                  }`}
                >
                  <td className="py-3 px-4">
                    <Link
                      href={`/zawodnik/${player.slug}`}
                      className="font-medium text-[var(--color-primary)] hover:underline"
                    >
                      {player.firstName} {player.lastName}
                    </Link>
                  </td>
                  <td className="py-3 px-4 text-center hidden md:table-cell">
                    {player.hcp !== null ? Number(player.hcp).toFixed(1) : '-'}
                  </td>
                  <td className="py-3 px-4 text-center text-gray-500 hidden md:table-cell">
                    {player.email || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
