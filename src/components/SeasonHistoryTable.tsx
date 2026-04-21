import Link from 'next/link'
import { PL } from '@/constants/pl'
import { getSeasonHistory } from '@/lib/player-stats'

/**
 * Per-season breakdown table shown below the match history on the player profile.
 * Server component — fetches from getSeasonHistory.
 *
 * Hidden when the player has only the active season (no historical rows beyond current).
 */
export default async function SeasonHistoryTable({ playerId }: { playerId: number }) {
  const rows = await getSeasonHistory(playerId)
  if (rows.length === 0) return null

  return (
    <div className="card p-6 sm:p-8 mt-8">
      <h2
        className="text-xl font-bold text-[var(--color-text-dark)] mb-6"
        style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif' }}
      >
        {PL.career.historyTitle}
      </h2>

      <div className="overflow-x-auto -mx-6 sm:-mx-8">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-[var(--color-text-body)]/50 border-b border-[var(--color-text-body)]/10">
              <th className="text-left py-2 px-6 sm:px-8">{PL.career.col.season}</th>
              <th className="text-center py-2">{PL.career.col.position}</th>
              <th className="text-center py-2">{PL.career.col.matches}</th>
              <th className="text-center py-2">{PL.career.col.record}</th>
              <th className="text-right py-2">{PL.career.col.points}</th>
              <th className="text-right py-2 px-6 sm:px-8">{PL.career.col.playoffResult}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.seasonId}
                className="border-b border-[var(--color-text-body)]/5 hover:bg-[var(--color-accent)]/[0.03] transition-colors"
              >
                <td className="py-3 px-6 sm:px-8">
                  <Link
                    href={`/poprzednie-sezony/${row.seasonId}`}
                    className="font-medium text-[var(--color-primary)] hover:text-[var(--color-accent)] transition-colors"
                  >
                    {row.seasonName}
                  </Link>
                  <div className="text-xs text-[var(--color-text-body)]/50">{row.year}</div>
                </td>
                <td className="text-center py-3 tabular-nums font-semibold text-[var(--color-text-dark)]">
                  {row.finalPosition ?? '—'}
                </td>
                <td className="text-center py-3 tabular-nums text-[var(--color-text-body)]/70">
                  {row.matchesPlayed}
                </td>
                <td className="text-center py-3 tabular-nums text-xs">
                  <span className="text-[var(--color-success)] font-semibold">{row.wins}</span>
                  <span className="text-[var(--color-text-body)]/40 mx-1">-</span>
                  <span className="text-[var(--color-danger)] font-semibold">{row.losses}</span>
                  <span className="text-[var(--color-text-body)]/40 mx-1">-</span>
                  <span className="text-[var(--color-accent)] font-semibold">{row.halved}</span>
                </td>
                <td className="text-right py-3 tabular-nums font-semibold text-[var(--color-text-dark)]">
                  {row.bigPoints}
                </td>
                <td className="text-right py-3 px-6 sm:px-8 text-xs">
                  {row.playoffResult ? (
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full font-semibold ${
                        row.playoffResult === 'Mistrz'
                          ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]'
                          : row.playoffResult === 'Finalista'
                          ? 'bg-[var(--color-success)]/15 text-[var(--color-success)]'
                          : 'bg-[var(--color-text-body)]/5 text-[var(--color-text-body)]/70'
                      }`}
                    >
                      {row.playoffResult}
                      {row.playoffBracket && (
                        <span className="ml-1 font-normal opacity-70">
                          · {shortBracket(row.playoffBracket)}
                        </span>
                      )}
                    </span>
                  ) : row.playoffBracket ? (
                    <span className="text-[var(--color-text-body)]/50">
                      {shortBracket(row.playoffBracket)}
                    </span>
                  ) : (
                    <span className="text-[var(--color-text-body)]/30">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function shortBracket(name: string): string {
  if (name.toLowerCase().includes('pierwsza')) return 'L1'
  if (name.toLowerCase().includes('druga')) return 'L2'
  if (name.toLowerCase().includes('trzecia')) return 'L3'
  return name
}
