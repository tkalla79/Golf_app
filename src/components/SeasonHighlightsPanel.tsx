import Link from 'next/link'
import { PL } from '@/constants/pl'
import { getSeasonHighlights } from '@/lib/season-stats'

/**
 * Highlights panel shown at the top of the archive season page.
 * Shows champions per bracket, top scorers, biggest upset and core season metrics.
 *
 * Returns null when there are no played matches — keeps the page clean for empty seasons.
 */
export default async function SeasonHighlightsPanel({ seasonId }: { seasonId: number }) {
  const data = await getSeasonHighlights(seasonId)
  if (!data || data.playedMatches === 0) return null

  return (
    <div className="mb-10 space-y-6">
      {/* Champions strip */}
      {data.champions.length > 0 && (
        <div className="card p-6 sm:p-8">
          <h2
            className="text-lg font-bold text-[var(--color-text-dark)] mb-6 flex items-center gap-2"
            style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif' }}
          >
            <span className="text-2xl">🏆</span>
            {PL.seasonHighlights.championsTitle}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {data.champions.map((c, idx) => {
              const rankClass =
                idx === 0
                  ? 'from-[var(--color-accent)]/30 to-[var(--color-accent)]/5 border-[var(--color-accent)]/50'
                  : idx === 1
                  ? 'from-[var(--color-success)]/25 to-[var(--color-success)]/5 border-[var(--color-success)]/40'
                  : 'from-[var(--color-primary)]/20 to-[var(--color-primary)]/5 border-[var(--color-primary)]/40'
              return (
                <div
                  key={c.bracketName}
                  className={`rounded-xl bg-gradient-to-b border px-4 py-5 ${rankClass}`}
                >
                  <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-body)]/60 mb-2">
                    {c.bracketName}
                  </div>
                  <Link
                    href={`/zawodnik/${c.championSlug}`}
                    className="block text-lg font-bold text-[var(--color-text-dark)] hover:text-[var(--color-accent)] transition-colors"
                  >
                    {c.championName}
                  </Link>
                  {c.runnerUpName && (
                    <div className="text-xs text-[var(--color-text-body)]/60 mt-2">
                      {PL.seasonHighlights.finalVs}{' '}
                      <Link
                        href={`/zawodnik/${c.runnerUpSlug}`}
                        className="font-medium text-[var(--color-text-body)]/80 hover:text-[var(--color-primary)] transition-colors"
                      >
                        {c.runnerUpName}
                      </Link>
                      {c.finalResultCode && (
                        <span className="ml-1 font-semibold">({c.finalResultCode})</span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div className="card p-6 sm:p-8">
        <h2
          className="text-lg font-bold text-[var(--color-text-dark)] mb-6"
          style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif' }}
        >
          {PL.seasonHighlights.statsTitle}
        </h2>

        {/* Top scorers grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Top birdies */}
          {data.topBirdieScorers.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-body)]/60 mb-3">
                {PL.seasonHighlights.topBirdies}
              </h3>
              <ol className="space-y-2">
                {data.topBirdieScorers.map((s, i) => (
                  <li
                    key={s.playerId}
                    className="flex items-center justify-between px-3 py-2 rounded-md bg-[var(--color-text-body)]/[0.03]"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-[var(--color-accent)] w-5">
                        {i + 1}.
                      </span>
                      <Link
                        href={`/zawodnik/${s.playerSlug}`}
                        className="text-sm font-medium text-[var(--color-text-dark)] hover:text-[var(--color-accent)] transition-colors"
                      >
                        {s.playerName}
                      </Link>
                    </div>
                    <span className="text-sm font-bold tabular-nums text-[var(--color-text-dark)]">
                      {s.value}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Top win rate */}
          {data.topWinRate.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-body)]/60 mb-3">
                {PL.seasonHighlights.topWinRate}
              </h3>
              <ol className="space-y-2">
                {data.topWinRate.map((s, i) => (
                  <li
                    key={s.playerId}
                    className="flex items-center justify-between px-3 py-2 rounded-md bg-[var(--color-text-body)]/[0.03]"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-[var(--color-success)] w-5">
                        {i + 1}.
                      </span>
                      <Link
                        href={`/zawodnik/${s.playerSlug}`}
                        className="text-sm font-medium text-[var(--color-text-dark)] hover:text-[var(--color-accent)] transition-colors"
                      >
                        {s.playerName}
                      </Link>
                    </div>
                    <span className="text-sm font-bold tabular-nums text-[var(--color-success)]">
                      {s.value.toFixed(1)}%
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>

        {/* Biggest upset callout */}
        {data.biggestUpset && (
          <div className="rounded-lg border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5 px-4 py-4 mb-6">
            <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-primary)] mb-2">
              ⚡ {PL.seasonHighlights.biggestUpset}
            </div>
            <div className="text-sm">
              <Link
                href={`/zawodnik/${data.biggestUpset.winnerSlug}`}
                className="font-bold text-[var(--color-text-dark)] hover:text-[var(--color-accent)] transition-colors"
              >
                {data.biggestUpset.winnerName}
              </Link>
              <span className="text-[var(--color-text-body)]/60"> (HCP {data.biggestUpset.winnerHcp.toFixed(1)}) </span>
              <span className="font-semibold text-[var(--color-success)]">pokonał</span>{' '}
              <Link
                href={`/zawodnik/${data.biggestUpset.loserSlug}`}
                className="font-semibold text-[var(--color-text-dark)] hover:text-[var(--color-accent)] transition-colors"
              >
                {data.biggestUpset.loserName}
              </Link>
              <span className="text-[var(--color-text-body)]/60"> (HCP {data.biggestUpset.loserHcp.toFixed(1)}) </span>
              <span className="font-bold">{data.biggestUpset.resultCode}</span>
              <span className="text-[var(--color-text-body)]/50"> — różnica HCP {data.biggestUpset.hcpGap.toFixed(1)}</span>
            </div>
            <div className="text-xs text-[var(--color-text-body)]/50 mt-1">
              {data.biggestUpset.roundName} · {PL.seasonHighlights.group} {data.biggestUpset.groupName}
            </div>
          </div>
        )}

        {/* Core season metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label={PL.seasonHighlights.uniquePlayers} value={data.uniquePlayers} />
          <Stat label={PL.seasonHighlights.playedMatches} value={data.playedMatches} />
          <Stat
            label={PL.seasonHighlights.avgHcp}
            value={data.avgHcp !== null ? data.avgHcp.toFixed(1) : '—'}
          />
          <Stat label={PL.seasonHighlights.halvedRate} value={`${data.halvedRate.toFixed(1)}%`} />
        </div>

        {data.longestMatchCode && (
          <div className="mt-4 text-xs text-[var(--color-text-body)]/60 text-center">
            {PL.seasonHighlights.longestMatch}:{' '}
            <span className="font-semibold text-[var(--color-text-dark)]">
              {data.longestMatchCode}
            </span>{' '}
            ({data.longestMatchWinnerName})
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-bold tabular-nums text-[var(--color-text-dark)]">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-body)]/50 mt-1">
        {label}
      </div>
    </div>
  )
}
