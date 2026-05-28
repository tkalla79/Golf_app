import { prisma } from '@/lib/db'
import { PL } from '@/constants/pl'
import { getPlayerSession } from '@/lib/player-auth'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function ZawodnicyPage() {
  const [players, session] = await Promise.all([
    prisma.player.findMany({
      where: { active: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    }),
    getPlayerSession(),
  ])
  const viewerLoggedIn = !!session

  return (
    <div>
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-4xl font-bold text-[var(--color-primary)]" style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif' }}>
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
              </tr>
            </thead>
            <tbody>
              {players.map((player) => {
                const showContacts =
                  viewerLoggedIn && player.contactVisible && (player.phone || player.email)
                return (
                  <tr key={player.id}>
                    <td>
                      <Link
                        href={`/zawodnik/${player.slug}`}
                        className="flex items-center gap-3 font-semibold text-[var(--color-text-dark)] hover:text-[var(--color-primary)] transition-colors"
                      >
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-[var(--color-bg-section)] border border-[var(--color-border)] flex-shrink-0">
                          {player.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={player.avatarUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs font-bold text-[var(--color-primary)]/30">
                              {player.firstName[0]}{player.lastName[0]}
                            </div>
                          )}
                        </div>
                        {player.firstName} {player.lastName}
                      </Link>
                      {showContacts && (
                        <div className="ml-11 mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--color-text-body)]/70">
                          {player.phone && (
                            <a
                              href={`tel:${player.phone.replace(/\s/g, '')}`}
                              className="flex items-center gap-1 hover:text-[var(--color-primary)] transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                              </svg>
                              {player.phone}
                            </a>
                          )}
                          {player.email && (
                            <a
                              href={`mailto:${player.email}`}
                              className="flex items-center gap-1 hover:text-[var(--color-primary)] transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                              {player.email}
                            </a>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="text-center hidden md:table-cell text-[var(--color-text-body)]/70 align-top pt-3">
                      {player.hcp !== null ? Number(player.hcp).toFixed(1) : '–'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
