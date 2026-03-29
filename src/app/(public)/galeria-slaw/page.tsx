import { prisma } from '@/lib/db'
import { PL } from '@/constants/pl'
import Image from 'next/image'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: `${PL.hallOfFame.title} | Don Papa Match Play`,
  description: PL.hallOfFame.subtitle,
}

export default async function HallOfFamePage() {
  const entries = await prisma.hallOfFameEntry.findMany({
    orderBy: [{ year: 'desc' }, { sortOrder: 'asc' }],
  })

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
        <p className="text-[var(--color-text-body)] max-w-xl">
          {PL.hallOfFame.subtitle}
        </p>
      </div>

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {entries.map((entry) => (
            <div key={entry.id} className="card overflow-hidden">
              {/* Złoty pasek na górze */}
              <div className="h-1 bg-[var(--color-accent)]" />

              {/* Zdjęcie */}
              <div className="relative h-64 bg-[var(--color-bg-section)]">
                {entry.photoUrl ? (
                  <Image
                    src={entry.photoUrl}
                    alt={entry.playerName}
                    fill
                    className="object-cover"
                  />
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
                  <h2
                    className="text-xl font-bold text-[var(--color-text-dark)] leading-tight"
                    style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif' }}
                  >
                    {entry.playerName}
                  </h2>
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
          ))}
        </div>
      )}
    </div>
  )
}
