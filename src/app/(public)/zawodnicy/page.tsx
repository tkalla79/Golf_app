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
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-4xl font-bold text-[var(--color-primary)]" style={{ fontFamily: 'Raleway, sans-serif' }}>
          {PL.nav.players}
        </h1>
        <div className="flex items-center gap-3 mt-3">
          <span className="inline-block w-12 h-0.5 bg-[var(--color-accent)]"></span>
          <p className="text-[var(--color-text-body)]">
            {players.length} zawodników w sezonie
          </p>
        </div>
      </div>

      {players.length === 0 ? (
        <p className="text-[var(--color-text-body)]">{PL.common.noData}</p>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="standings-table w-full text-sm">
            <thead>
              <tr>
                <th className="text-left">{PL.standings.player}</th>
                <th className="text-center hidden md:table-cell">{PL.standings.hcp}</th>
                <th className="text-center hidden md:table-cell">{PL.player.email}</th>
                <th className="text-center hidden md:table-cell">{PL.player.phone}</th>
              </tr>
            </thead>
            <tbody>
              {players.map((player) => (
                <tr key={player.id}>
                  <td>
                    <Link
                      href={`/zawodnik/${player.slug}`}
                      className="font-semibold text-[var(--color-text-dark)] hover:text-[var(--color-primary)] transition-colors"
                    >
                      {player.firstName} {player.lastName}
                    </Link>
                  </td>
                  <td className="text-center hidden md:table-cell text-[var(--color-text-body)]/70">
                    {player.hcp !== null ? Number(player.hcp).toFixed(1) : '–'}
                  </td>
                  <td className="text-center hidden md:table-cell text-[var(--color-text-body)]/50 text-xs">
                    {player.email || '–'}
                  </td>
                  <td className="text-center hidden md:table-cell text-[var(--color-text-body)]/50 text-xs">
                    {player.phone || '–'}
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
