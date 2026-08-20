import { prisma } from '@/lib/db'
import Link from 'next/link'
import { PL } from '@/constants/pl'
import SeasonSelector from '@/components/SeasonSelector'
import { getBirdieRanking } from '@/lib/season-birdies'

export const dynamic = 'force-dynamic'

export default async function KlasyfikacjaBirdiePage({
  searchParams,
}: {
  searchParams: Promise<{ sezon?: string }>
}) {
  const params = await searchParams
  const requestedSeasonId = params.sezon ? parseInt(params.sezon) : null

  if (params.sezon && isNaN(requestedSeasonId!)) {
    return <EmptyState />
  }

  const allSeasons = await prisma.season.findMany({
    orderBy: { year: 'desc' },
    select: { id: true, name: true, year: true, status: true },
  })

  const activeSeason = allSeasons.find((s) => s.status === 'ACTIVE')
  const selectedSeasonId = requestedSeasonId ?? activeSeason?.id

  if (!selectedSeasonId) return <EmptyState />

  const season = allSeasons.find((s) => s.id === selectedSeasonId)
  const ranking = await getBirdieRanking(selectedSeasonId)

  // Rozbicie na fazy pokazujemy tylko wtedy, gdy playoff faktycznie się zaczął —
  // w trakcie fazy grupowej kolumna byłaby pustym słupkiem zer.
  const hasPlayoffBirdies = ranking.some((r) => r.playoff > 0)
  const totalBirdies = ranking.reduce((sum, r) => sum + r.total, 0)

  return (
    <div>
      <div className="mb-10">
        <div className="flex items-center gap-4 flex-wrap">
          <h1
            className="text-3xl font-bold text-[var(--color-primary)]"
            style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif' }}
          >
            {PL.nav.birdieRanking}
          </h1>
          <SeasonSelector seasons={allSeasons} currentSeasonId={selectedSeasonId} />
        </div>
        <div className="flex items-center gap-3 mt-3">
          <span className="inline-block w-12 h-0.5 bg-[var(--color-accent)]"></span>
          <p className="text-[var(--color-text-body)] font-medium">
            {season?.name}
            {totalBirdies > 0 && (
              <span className="text-[var(--color-text-body)]/50 font-normal">
                {' '}&middot; {totalBirdies} birdie w sezonie
              </span>
            )}
          </p>
        </div>
        <p className="mt-3 text-sm text-[var(--color-text-body)]/60">
          Suma birdie ze wszystkich rozegranych meczów — faza grupowa i playoff razem.
        </p>
      </div>

      {ranking.length === 0 ? (
        <p className="text-[var(--color-text-body)]/60 py-10">{PL.common.noData}</p>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="standings-table w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left !rounded-none">#</th>
                  <th className="text-left !rounded-none">{PL.standings.player}</th>
                  <th className="text-center !rounded-none">🐦 Razem</th>
                  {hasPlayoffBirdies && (
                    <>
                      <th className="text-center !rounded-none">Grupy</th>
                      <th className="text-center !rounded-none">Playoff</th>
                    </>
                  )}
                  <th className="text-center !rounded-none">Meczów</th>
                  <th className="text-center !rounded-none">Średnia</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((row) => (
                  <tr key={row.playerId}>
                    <td className="font-bold text-[var(--color-primary)]/50">{row.position}</td>
                    <td>
                      <Link
                        href={`/zawodnik/${row.slug}`}
                        className="font-semibold text-[var(--color-text-dark)] hover:text-[var(--color-primary)] transition-colors"
                      >
                        {row.firstName} {row.lastName}
                      </Link>
                    </td>
                    <td className="text-center font-bold text-[var(--color-primary)]">{row.total}</td>
                    {hasPlayoffBirdies && (
                      <>
                        <td className="text-center text-[var(--color-text-body)]/70">{row.groupPhase}</td>
                        <td className="text-center text-[var(--color-text-body)]/70">
                          {row.playoff > 0 ? (
                            <span className="font-semibold text-[var(--color-accent)]">+{row.playoff}</span>
                          ) : (
                            '—'
                          )}
                        </td>
                      </>
                    )}
                    <td className="text-center text-[var(--color-text-body)]/60">{row.matchesPlayed}</td>
                    <td className="text-center text-[var(--color-text-body)]/60">
                      {row.perMatch.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="mt-6 text-xs text-[var(--color-text-body)]/45">
        Kolejność: liczba birdie malejąco. Przy równej liczbie wyżej gracz z mniejszą liczbą
        rozegranych meczów (lepsza średnia).
      </p>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="text-center py-20">
      <h1
        className="text-3xl font-bold text-[var(--color-primary)]"
        style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif' }}
      >
        {PL.nav.birdieRanking}
      </h1>
      <p className="mt-4 text-[var(--color-text-body)]">{PL.common.noData}</p>
    </div>
  )
}
