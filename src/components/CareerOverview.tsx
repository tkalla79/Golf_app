import Link from 'next/link'
import { PL } from '@/constants/pl'
import { getCareerStats } from '@/lib/player-stats'

/**
 * Career overview panel shown on the player profile page.
 * Server component — fetches stats directly via getCareerStats.
 *
 * Hidden entirely when the player has no played matches (clean first-time experience).
 */
export default async function CareerOverview({ playerId }: { playerId: number }) {
  const stats = await getCareerStats(playerId)

  if (stats.totalMatches === 0) return null

  const closeWinRate =
    stats.closeMatchesPlayed > 0
      ? Math.round((stats.closeMatchesWon / stats.closeMatchesPlayed) * 100)
      : null
  const upsetRate =
    stats.upsetAttempts > 0 ? Math.round((stats.upsets / stats.upsetAttempts) * 100) : null

  return (
    <div className="card p-6 sm:p-8 mb-8">
      <h2
        className="text-xl font-bold text-[var(--color-text-dark)] mb-6"
        style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif' }}
      >
        {PL.career.title}
      </h2>

      {/* Headline tiles — always visible */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mb-6">
        <StatTile label={PL.career.seasons} value={stats.totalSeasons} />
        <StatTile
          label={PL.career.championships}
          value={stats.championships}
          emphasis={stats.championships > 0 ? 'gold' : undefined}
        />
        <StatTile label={PL.career.finals} value={stats.finalsAppearances} />
        <StatTile
          label={PL.career.record}
          value={`${stats.wins}-${stats.losses}-${stats.halved}`}
        />
        <StatTile
          label={PL.career.winPct}
          value={`${stats.winPercentage.toFixed(1)}%`}
          emphasis={stats.winPercentage >= 50 ? 'green' : undefined}
        />
        <StatTile label={PL.career.birdies} value={stats.birdies} />
      </div>

      {/* Best finish + Longest streak */}
      {(stats.bestFinish || stats.longestWinStreak > 0) && (
        <div className="flex flex-wrap gap-4 mb-6 text-sm">
          {stats.bestFinish && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/25">
              <span className="text-[var(--color-text-body)]/60">{PL.career.bestFinish}:</span>
              <span className="font-semibold text-[var(--color-text-dark)]">
                {stats.bestFinish.position}.{' '}
                <span className="text-[var(--color-text-body)]/50">
                  ({stats.bestFinish.seasonName})
                </span>
              </span>
            </div>
          )}
          {stats.longestWinStreak > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--color-success)]/10 border border-[var(--color-success)]/25">
              <span className="text-[var(--color-text-body)]/60">{PL.career.longestStreak}:</span>
              <span className="font-semibold text-[var(--color-success)]">
                {stats.longestWinStreak}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Details accordion */}
      <details className="group">
        <summary className="cursor-pointer text-sm font-semibold text-[var(--color-primary)] hover:text-[var(--color-accent)] transition-colors select-none list-none flex items-center gap-2">
          <svg
            className="w-4 h-4 transition-transform group-open:rotate-90"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          {PL.career.moreStats}
        </summary>

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          {stats.avgMarginOfVictory !== null && (
            <Metric label={PL.career.avgMargin} value={stats.avgMarginOfVictory.toFixed(1)} />
          )}
          {stats.biggestWinCode && (
            <Metric label={PL.career.biggestWin} value={stats.biggestWinCode} />
          )}
          <Metric label={PL.career.halvedRate} value={`${stats.halvedRate.toFixed(1)}%`} />
          {closeWinRate !== null && (
            <Metric
              label={PL.career.closeMatches}
              value={`${stats.closeMatchesWon}/${stats.closeMatchesPlayed} (${closeWinRate}%)`}
            />
          )}
          {upsetRate !== null && (
            <Metric
              label={PL.career.upsets}
              value={`${stats.upsets}/${stats.upsetAttempts} (${upsetRate}%)`}
            />
          )}
          <Metric
            label={PL.career.walkovers}
            value={`${stats.walkoverWins}/${stats.walkoverLosses}`}
          />
          {(stats.retiredWins > 0 || stats.retiredLosses > 0) && (
            <Metric
              label={PL.career.retired}
              value={`${stats.retiredWins}/${stats.retiredLosses}`}
            />
          )}
          <Metric label={PL.career.semifinals} value={stats.semifinalAppearances} />
          <Metric label={PL.career.playoffAppearances} value={stats.playoffAppearances} />
          <Metric label={PL.career.bigPts} value={stats.bigPointsTotal} />
          <Metric
            label={PL.career.smallPts}
            value={stats.smallPointsTotal > 0 ? `+${stats.smallPointsTotal}` : `${stats.smallPointsTotal}`}
          />
        </div>

        {/* Head-to-head */}
        {stats.headToHead.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-bold text-[var(--color-text-dark)] mb-3">
              {PL.career.headToHead}
            </h3>
            <div className="space-y-2">
              {stats.headToHead.map((h) => (
                <Link
                  key={h.opponentId}
                  href={`/zawodnik/${h.opponentSlug}`}
                  className="flex items-center justify-between px-4 py-2 rounded-lg border border-[var(--color-text-body)]/10 hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-accent)]/5 transition-colors"
                >
                  <span className="text-sm font-medium text-[var(--color-text-dark)]">
                    {h.opponentName}
                  </span>
                  <span className="text-xs font-semibold tabular-nums">
                    <span className="text-[var(--color-success)]">{h.won}</span>
                    <span className="text-[var(--color-text-body)]/40 mx-1">-</span>
                    <span className="text-[var(--color-danger)]">{h.lost}</span>
                    <span className="text-[var(--color-text-body)]/40 mx-1">-</span>
                    <span className="text-[var(--color-accent)]">{h.halved}</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </details>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function StatTile({
  label,
  value,
  emphasis,
}: {
  label: string
  value: string | number
  emphasis?: 'gold' | 'green'
}) {
  const colorClass =
    emphasis === 'gold'
      ? 'text-[var(--color-accent)]'
      : emphasis === 'green'
      ? 'text-[var(--color-success)]'
      : 'text-[var(--color-text-dark)]'
  const bgClass =
    emphasis === 'gold'
      ? 'bg-[var(--color-accent)]/10 border-[var(--color-accent)]/30'
      : emphasis === 'green'
      ? 'bg-[var(--color-success)]/10 border-[var(--color-success)]/30'
      : 'bg-[var(--color-text-body)]/[0.03] border-[var(--color-text-body)]/10'

  return (
    <div className={`rounded-lg border px-3 py-3 text-center ${bgClass}`}>
      <div className={`text-2xl font-bold tabular-nums ${colorClass}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-body)]/50 mt-1">
        {label}
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 rounded-md bg-[var(--color-text-body)]/[0.02]">
      <span className="text-[var(--color-text-body)]/60">{label}</span>
      <span className="font-semibold tabular-nums text-[var(--color-text-dark)]">{value}</span>
    </div>
  )
}
