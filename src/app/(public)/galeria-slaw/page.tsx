import { prisma } from '@/lib/db'
import { PL } from '@/constants/pl'
import Image from 'next/image'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: `${PL.hallOfFame.title} | Don Papa Match Play`,
  description: PL.hallOfFame.subtitle,
}

type SearchParams = { year?: string }

export default async function HallOfFamePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { year } = await searchParams
  const selectedYear = year && /^\d{4}$/.test(year) ? parseInt(year, 10) : null

  const entries = await prisma.hallOfFameEntry.findMany({
    where: selectedYear ? { year: selectedYear } : undefined,
    orderBy: [{ year: 'desc' }, { sortOrder: 'asc' }],
    include: {
      player: { select: { slug: true, firstName: true, lastName: true } },
    },
  })

  // Fetch unique years for the filter dropdown
  const allYears = await prisma.hallOfFameEntry.findMany({
    distinct: ['year'],
    orderBy: { year: 'desc' },
    select: { year: true },
  })

  // Group by year for display
  const grouped = new Map<number, typeof entries>()
  for (const e of entries) {
    const arr = grouped.get(e.year) ?? []
    arr.push(e)
    grouped.set(e.year, arr)
  }
  const years = Array.from(grouped.keys()).sort((a, b) => b - a)

  return (
    <div>
      {/* Header */}
      <div className="mb-10">
        <h1
          className="text-3xl font-bold text-[var(--color-text-dark)] mb-3"
          style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif' }}
        >
          {PL.hallOfFame.title}
        </h1>
        <span className="inline-block w-12 h-0.5 bg-[var(--color-accent)] mb-4" />
        <p className="text-[var(--color-text-body)] max-w-xl">{PL.hallOfFame.subtitle}</p>
      </div>

      {/* Year filter */}
      {allYears.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 mb-10">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-body)]/60 mr-2">
            {PL.hallOfFame.filter}:
          </span>
          <Link
            href="/galeria-slaw"
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
              !selectedYear
                ? 'bg-[var(--color-primary)] text-white'
                : 'bg-[var(--color-text-body)]/5 text-[var(--color-text-body)]/70 hover:bg-[var(--color-text-body)]/10'
            }`}
          >
            {PL.hallOfFame.allYears}
          </Link>
          {allYears.map((y) => (
            <Link
              key={y.year}
              href={`/galeria-slaw?year=${y.year}`}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                selectedYear === y.year
                  ? 'bg-[var(--color-accent)] text-[var(--color-primary-dark)]'
                  : 'bg-[var(--color-text-body)]/5 text-[var(--color-text-body)]/70 hover:bg-[var(--color-text-body)]/10'
              }`}
            >
              {y.year}
            </Link>
          ))}
        </div>
      )}

      {entries.length === 0 ? (
        /* Stan pusty */
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-24 h-24 rounded-full bg-[var(--color-bg-section)] flex items-center justify-center mb-6">
            <svg
              className="w-12 h-12 text-[var(--color-accent)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
              />
            </svg>
          </div>
          <h2
            className="text-xl font-semibold text-[var(--color-text-dark)] mb-2"
            style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif' }}
          >
            {PL.hallOfFame.noData}
          </h2>
          <p className="text-sm text-[var(--color-text-body)] opacity-60">
            {PL.hallOfFame.noDataHint}
          </p>
        </div>
      ) : (
        <div className="space-y-12">
          {years.map((year) => (
            <section key={year}>
              <h2
                className="text-2xl font-bold text-[var(--color-text-dark)] mb-6 flex items-center gap-3"
                style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif' }}
              >
                <span className="text-[var(--color-accent)]">{year}</span>
                <span className="h-px flex-1 bg-[var(--color-text-body)]/10" />
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {grouped.get(year)!.map((entry) => (
                  <EntryCard key={entry.id} entry={entry} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Subcomponent
// ---------------------------------------------------------------------------

type EntryWithPlayer = {
  id: number
  playerName: string
  seasonName: string
  year: number
  photoUrl: string | null
  description: string | null
  player: { slug: string; firstName: string; lastName: string } | null
}

function EntryCard({ entry }: { entry: EntryWithPlayer }) {
  const nameSlot = entry.player ? (
    <Link
      href={`/zawodnik/${entry.player.slug}`}
      className="hover:text-[var(--color-accent)] transition-colors"
    >
      {entry.playerName}
    </Link>
  ) : (
    <span>{entry.playerName}</span>
  )

  return (
    <div className="card overflow-hidden">
      {/* Złoty pasek na górze */}
      <div className="h-1 bg-[var(--color-accent)]" />

      {/* Zdjęcie */}
      <div className="relative h-64 bg-[var(--color-bg-section)]">
        {entry.photoUrl ? (
          <Image src={entry.photoUrl} alt={entry.playerName} fill className="object-cover" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dark)]">
            <svg
              className="w-16 h-16 text-[var(--color-accent)] opacity-60"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
              />
            </svg>
            <span className="text-white/30 text-xs mt-2 uppercase tracking-widest">
              {PL.hallOfFame.photoSoon}
            </span>
          </div>
        )}
      </div>

      {/* Dane */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3
            className="text-xl font-bold text-[var(--color-text-dark)] leading-tight"
            style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif' }}
          >
            {nameSlot}
          </h3>
          <span className="text-[var(--color-accent)] font-bold text-lg shrink-0">
            {entry.year}
          </span>
        </div>
        <p className="text-sm text-[var(--color-text-body)] opacity-70 mb-3">
          {PL.hallOfFame.season}: {entry.seasonName}
        </p>
        {entry.description && (
          <p className="text-sm text-[var(--color-text-body)] border-t border-[var(--color-border)] pt-3 mt-3">
            {entry.description}
          </p>
        )}
      </div>
    </div>
  )
}
